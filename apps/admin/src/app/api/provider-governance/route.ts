import { NextRequest, NextResponse } from "next/server";
import { revalidateProvidersCatalog } from "@/lib/providers-revalidate";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  getProviderQualityProfile,
  getProviderQualityWarnings,
  normalizeProviderUrlDomain,
  slugifyProviderName,
} from "@locateflow/shared";

const CUSTOM_REVIEW_PRIORITY: Record<string, number> = {
  NEEDS_REVIEW: 0,
  PROMOTION_CANDIDATE: 1,
  NOT_REVIEWED: 2,
  REJECTED: 3,
  LINKED_TO_GLOBAL_PROVIDER: 4,
  REVIEWED: 5,
};

async function uniqueProviderSlug(baseName: string): Promise<string> {
  const base = slugifyProviderName(baseName) || "provider";
  let candidate = base;
  let suffix = 1;
  // Cap iterations to avoid runaway loops on pathological input.
  while (suffix < 50) {
    const existing = await prisma.serviceProvider.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

function buildDomainCounts(providers: Array<{ website: string | null }>) {
  const counts = new Map<string, number>();
  for (const provider of providers) {
    const domain = normalizeProviderUrlDomain(provider.website);
    if (!domain) continue;
    counts.set(domain, (counts.get(domain) || 0) + 1);
  }
  return counts;
}

function warningTypeToQueue(code: string) {
  if (code.includes("duplicate")) return "duplicateReview";
  if (code.includes("phone") || code.includes("contact")) return "missingContact";
  if (code.includes("coverage") || code.includes("address")) return "broadCoverage";
  if (code.includes("logo") || code.includes("description") || code.includes("marketing")) return "providerQuality";
  return "sourceValidation";
}

function asMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadataStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function issueOccurrenceCount(issue: { metadata?: unknown }): number {
  const metadata = asMetadata(issue.metadata);
  return typeof metadata.occurrenceCount === "number" && Number.isFinite(metadata.occurrenceCount)
    ? metadata.occurrenceCount
    : 1;
}

function sourceGapAction(metadata: Record<string, unknown>): string {
  const category = typeof metadata.category === "string" ? metadata.category : "";
  if (category === "UTILITY_ELECTRIC") return "review_alias_or_add_electric_provider";
  if (category === "UTILITY_INTERNET") return "review_fcc_brand_or_add_isp";
  return "review_source_or_dismiss";
}

function sourceGapFieldsToCollect(metadata: Record<string, unknown>): string[] {
  const category = typeof metadata.category === "string" ? metadata.category : "";
  if (category === "UTILITY_ELECTRIC") {
    return ["official utility name", "service territory", "customer support URL", "phone", "catalog alias"];
  }
  if (category === "UTILITY_INTERNET") {
    return ["official brand name", "availability URL", "phone", "FCC provider ID", "speed/technology evidence"];
  }
  return ["official name", "website", "phone", "coverage evidence"];
}

function buildAuditReport(input: {
  queues: Record<string, any[]>;
  issues: Array<{ issueType: string; severity: string; title: string; metadata?: unknown; createdAt: Date; updatedAt: Date }>;
}) {
  const sourceIssues = input.issues.filter((issue) => issue.issueType === "SOURCE_PROVIDER_MISSING");
  const sourceHealthIssues = input.issues.filter((issue) => issue.issueType === "SOURCE_HEALTH_WARNING");
  const repeatedSourceIssues = sourceIssues.filter((issue) => issueOccurrenceCount(issue) > 1);
  const bySource = sourceIssues.reduce<Record<string, number>>((acc, issue) => {
    const source = String(asMetadata(issue.metadata).source || "UNKNOWN");
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const byCategory = sourceIssues.reduce<Record<string, number>>((acc, issue) => {
    const category = String(asMetadata(issue.metadata).category || "UNKNOWN");
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const reviewCandidates = sourceIssues
    .slice()
    .sort((a, b) => issueOccurrenceCount(b) - issueOccurrenceCount(a))
    .slice(0, 12)
    .map((issue) => {
      const metadata = asMetadata(issue.metadata);
      return {
        title: issue.title,
        severity: issue.severity,
        providerName: String(metadata.providerName || "Unknown provider"),
        source: String(metadata.source || "UNKNOWN"),
        category: String(metadata.category || "UNKNOWN"),
        occurrenceCount: issueOccurrenceCount(issue),
        states: metadataStringList(metadata.states),
        zips: metadataStringList(metadata.zips),
        sampleLocations: metadataStringList(metadata.sampleLocations),
        evidenceUrl: typeof metadata.evidenceUrl === "string" ? metadata.evidenceUrl : null,
        suggestedAction: sourceGapAction(metadata),
        fieldsToCollect: metadataStringList(metadata.fieldsToCollect).length > 0
          ? metadataStringList(metadata.fieldsToCollect)
          : sourceGapFieldsToCollect(metadata),
        qualityProfile: asMetadata(metadata.qualityProfile),
      };
    });

  const recommendations: string[] = [];
  if ((bySource.OPENEI_URDB || 0) > 0) {
    recommendations.push("Prioritize electric utility alias mapping before adding new catalog rows; OpenEI names often use legal utility names.");
  }
  if ((bySource.FCC_BDC || 0) > 0) {
    recommendations.push("Review FCC provider brands against existing internet catalog rows; add aliases before creating duplicate ISP providers.");
  }
  if (sourceHealthIssues.length > 0) {
    recommendations.push("Fix live source health issues before judging provider coverage completeness; failed FCC/OpenEI lookups mean recommendations are falling back to catalog evidence.");
  }
  if (repeatedSourceIssues.length > 0) {
    recommendations.push("Repeated source gaps should become operator tasks, because they affect multiple user recommendation sessions.");
  }
  if ((input.queues.userCreatedProviderReview?.length || 0) > 0) {
    recommendations.push("Review user-submitted providers separately from source gaps; private custom providers should not auto-promote.");
  }
  if (recommendations.length === 0) {
    recommendations.push("No urgent source-backed provider gaps are open. Keep monitoring live data readiness and broad coverage warnings.");
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: "deterministic_ai_ready",
    estimatedLlmCostUsd: 0,
    summary: {
      openQueueCount: Object.values(input.queues).reduce((sum, rows) => sum + rows.length, 0),
      sourceGapCount: sourceIssues.length,
      sourceHealthIssueCount: sourceHealthIssues.length,
      repeatedSourceGapCount: repeatedSourceIssues.length,
      highSeveritySourceGapCount: sourceIssues.filter((issue) => issue.severity === "HIGH").length,
      bySource,
      byCategory,
    },
    recommendations,
    reviewCandidates,
  };
}

async function writeAdminAudit(adminId: string, action: string, entityType: string, entityId: string, changes: unknown) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: adminId,
      action: action.slice(0, 20),
      entityType,
      entityId,
      changes: JSON.stringify(changes),
    },
  });
}

export async function GET() {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });

    const [providers, customProviders, issues] = await Promise.all([
      prisma.serviceProvider.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          description: true,
          website: true,
          phone: true,
          logoUrl: true,
          scope: true,
          states: true,
          zipCodes: true,
          coverageModel: true,
          isActive: true,
          updatedAt: true,
        },
        take: 2000,
      }),
      prisma.userCustomProvider.findMany({
        where: { deletedAt: null },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          linkedServiceProvider: { select: { id: true, name: true, slug: true } },
          _count: { select: { services: true, moveTasks: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.providerGovernanceIssue.findMany({
        where: { status: { not: "DISMISSED" } },
        include: {
          provider: { select: { id: true, name: true, slug: true, category: true } },
          customProvider: { select: { id: true, name: true, category: true, userId: true } },
          reviewedByAdmin: { select: { id: true, email: true } },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
    ]);

    const domainCounts = buildDomainCounts(providers);
    const queues: Record<string, any[]> = {
      providerQuality: [],
      coverageGap: [],
      duplicateReview: [],
      missingContact: [],
      broadCoverage: [],
      sourceValidation: [],
      userCreatedProviderReview: [],
    };

    for (const provider of providers) {
      const domain = normalizeProviderUrlDomain(provider.website);
      const providerQualityInput = {
        ...provider,
        duplicateDomainCount: domain ? domainCounts.get(domain) || 0 : 0,
      };
      const warnings = getProviderQualityWarnings(providerQualityInput);
      const qualityProfile = getProviderQualityProfile(providerQualityInput);
      for (const warning of warnings) {
        queues[warningTypeToQueue(warning.code)].push({
          provider: { ...provider, qualityProfile },
          warning,
          domain,
          qualityProfile,
        });
      }
    }

    for (const provider of customProviders) {
      if (provider.adminReviewStatus !== "REVIEWED" && provider.adminReviewStatus !== "LINKED_TO_GLOBAL_PROVIDER") {
        const isUserSubmission = provider.adminReviewStatus === "NEEDS_REVIEW";
        // Coverage is derived from the storage shape: NEEDS_REVIEW + state ⇒
        // STATEWIDE, NEEDS_REVIEW + no state ⇒ NATIONWIDE, otherwise LOCAL.
        // The POST route enforces these invariants at create time.
        const coverage: "LOCAL" | "STATEWIDE" | "NATIONWIDE" = isUserSubmission
          ? provider.state
            ? "STATEWIDE"
            : "NATIONWIDE"
          : "LOCAL";
        queues.userCreatedProviderReview.push({
          provider: { ...provider, coverage },
          warning: {
            code: isUserSubmission ? "user_submitted_for_review" : "user_custom_review",
            label: isUserSubmission
              ? "User submitted for listed-directory review"
              : "User-created provider review",
            message: isUserSubmission
              ? "User asked us to verify and add this provider to the listed directory."
              : "Private user-created provider — kept for audit; no promotion requested.",
          },
        });
      }
    }

    for (const issue of issues) {
      const metadata = issue.metadata && typeof issue.metadata === "object"
        ? issue.metadata as Record<string, unknown>
        : {};
      const sourceProviderName =
        typeof metadata.providerName === "string" && metadata.providerName.trim()
          ? metadata.providerName.trim()
          : issue.provider?.name || issue.customProvider?.name || "Unknown provider";
      const category =
        typeof metadata.category === "string" && metadata.category.trim()
          ? metadata.category.trim()
          : issue.provider?.category || issue.customProvider?.category || "Unknown category";
      const queueKey = issue.issueType === "SOURCE_PROVIDER_MISSING" ? "coverageGap" : "sourceValidation";

      queues[queueKey].push({
        issue,
        provider: {
          id: issue.provider?.id || issue.customProvider?.id || issue.id,
          name: sourceProviderName,
          category,
          scope: typeof metadata.source === "string" ? metadata.source : "Source-backed",
          website: typeof metadata.evidenceUrl === "string" ? metadata.evidenceUrl : null,
        },
        warning: {
          code: issue.issueType,
          label: issue.title,
          message: issue.description || "Source-backed provider data needs admin review.",
        },
        metadata: {
          ...metadata,
          suggestedAction: typeof metadata.suggestedAction === "string" ? metadata.suggestedAction : sourceGapAction(metadata),
          fieldsToCollect: metadataStringList(metadata.fieldsToCollect).length > 0
            ? metadataStringList(metadata.fieldsToCollect)
            : sourceGapFieldsToCollect(metadata),
        },
      });
    }

    queues.userCreatedProviderReview.sort((a, b) => {
      const aPriority = CUSTOM_REVIEW_PRIORITY[a.provider.adminReviewStatus] ?? 99;
      const bPriority = CUSTOM_REVIEW_PRIORITY[b.provider.adminReviewStatus] ?? 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aDate = a.provider.createdAt ? new Date(a.provider.createdAt).getTime() : 0;
      const bDate = b.provider.createdAt ? new Date(b.provider.createdAt).getTime() : 0;
      return bDate - aDate;
    });

    const summary = Object.fromEntries(
      Object.entries(queues).map(([key, value]) => [key, value.length]),
    );

    return NextResponse.json({
      queues,
      issues,
      summary,
      auditReport: buildAuditReport({ queues, issues }),
      metadata: {
        providerDataTrust: "listed_unverified",
        noOfficialVerificationWorkflow: true,
        customProvidersPrivateByDefault: true,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to load provider governance:", error);
    return NextResponse.json({ error: "Failed to load provider governance" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePermission("providers", "canUpdate", { minimumRole: "MODERATOR" });
    const body = await request.json();
    const action = String(body.action || "");

    if (body.customProviderId) {
      const customProvider = await prisma.userCustomProvider.findUnique({
        where: { id: String(body.customProviderId) },
      });
      if (!customProvider || customProvider.deletedAt) {
        return NextResponse.json({ error: "Custom provider not found" }, { status: 404 });
      }

      const data: any = {};
      if (action === "mark_reviewed") data.adminReviewStatus = "REVIEWED";
      if (action === "needs_review") data.adminReviewStatus = "NEEDS_REVIEW";
      if (action === "promotion_candidate") data.adminReviewStatus = "PROMOTION_CANDIDATE";
      if (action === "reject") data.adminReviewStatus = "REJECTED";
      if (action === "link_global") {
        const serviceProviderId = typeof body.serviceProviderId === "string" ? body.serviceProviderId : null;
        if (!serviceProviderId) {
          return NextResponse.json({ error: "serviceProviderId is required" }, { status: 400 });
        }
        const provider = await prisma.serviceProvider.findFirst({
          where: { id: serviceProviderId, deletedAt: null },
        });
        if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
        data.adminReviewStatus = "LINKED_TO_GLOBAL_PROVIDER";
        data.linkedServiceProviderId = serviceProviderId;
      }

      if (action === "promote_to_listed") {
        // Promotes a user-submitted custom provider to a new listed ServiceProvider.
        // Requires MODERATOR; reuses admin's overrides if present, falls back to
        // the user's submission. Slug uniqueness is enforced via suffixing.
        const overrideName = typeof body.name === "string" ? body.name.trim() : "";
        const overrideCategory = typeof body.category === "string" ? body.category.trim() : "";
        const overrideWebsite = typeof body.website === "string" ? body.website.trim() : "";
        const overridePhone = typeof body.phone === "string" ? body.phone.trim() : "";
        const overrideDescription = typeof body.description === "string" ? body.description.trim() : "";
        const overrideScope = typeof body.scope === "string" ? body.scope.trim().toUpperCase() : "";
        const overrideStatesRaw = Array.isArray(body.states) ? body.states : null;

        const name = (overrideName || customProvider.name || "").slice(0, 200);
        const category = (overrideCategory || customProvider.category || "OTHER").toUpperCase().slice(0, 50);
        if (!name) {
          return NextResponse.json({ error: "Provider name is required to promote" }, { status: 400 });
        }

        const website = overrideWebsite || customProvider.website || null;
        if (website) {
          try {
            const parsed = new URL(website);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
              return NextResponse.json({ error: "Provider website must be http(s)" }, { status: 400 });
            }
          } catch {
            return NextResponse.json({ error: "Provider website is not a valid URL" }, { status: 400 });
          }
        }

        const stateFromSubmission = customProvider.state ? customProvider.state.toUpperCase() : null;
        const states = overrideStatesRaw
          ? overrideStatesRaw
              .filter((value: unknown): value is string => typeof value === "string")
              .map((value: string) => value.trim().toUpperCase())
              .filter((value: string) => /^[A-Z]{2}$/.test(value))
          : stateFromSubmission
            ? [stateFromSubmission]
            : [];
        const scope = (overrideScope === "FEDERAL" || overrideScope === "STATE")
          ? overrideScope
          : (states.length > 0 ? "STATE" : "FEDERAL");

        const slug = await uniqueProviderSlug(name);

        const newProvider = await prisma.$transaction(async (tx) => {
          const created = await tx.serviceProvider.create({
            data: {
              name: name.slice(0, 200),
              slug,
              category,
              description: (overrideDescription || customProvider.description || "").slice(0, 2000) || null,
              website: website ? website.slice(0, 500) : null,
              phone: (overridePhone || customProvider.phone || "").slice(0, 20) || null,
              scope,
              states: JSON.stringify(states),
              zipCodes: JSON.stringify([]),
              isActive: true,
              lastUpdatedBy: session.adminId,
            },
          });
          await tx.userCustomProvider.update({
            where: { id: customProvider.id },
            data: {
              adminReviewStatus: "LINKED_TO_GLOBAL_PROVIDER",
              linkedServiceProviderId: created.id,
            },
          });
          return created;
        });

        await writeAdminAudit(session.adminId, "GOV_PROMOTE", "UserCustomProvider", customProvider.id, {
          action: "promote_to_listed",
          newServiceProviderId: newProvider.id,
          slug: newProvider.slug,
        });
        // A promoted custom provider becomes a public listing — bust the
        // cached provider set like every other provider mutation does.
        revalidateProvidersCatalog();
        return NextResponse.json({ provider: newProvider, promoted: true });
      }

      if (!Object.keys(data).length) {
        return NextResponse.json({ error: "Unsupported custom provider action" }, { status: 400 });
      }

      const updated = await prisma.userCustomProvider.update({
        where: { id: customProvider.id },
        data,
      });
      await writeAdminAudit(session.adminId, "GOV_REVIEW", "UserCustomProvider", updated.id, { action, data });
      return NextResponse.json({ provider: updated });
    }

    if (body.issueId) {
      const issue = await prisma.providerGovernanceIssue.findUnique({
        where: { id: String(body.issueId) },
      });
      if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

      const status =
        action === "dismiss_issue"
          ? "DISMISSED"
          : action === "mark_reviewed"
            ? "REVIEWED"
            : action === "reopen_issue"
              ? "OPEN"
              : null;
      if (!status) return NextResponse.json({ error: "Unsupported issue action" }, { status: 400 });

      const updated = await prisma.providerGovernanceIssue.update({
        where: { id: issue.id },
        data: {
          status,
          reviewedByAdminId: session.adminId,
          reviewedAt: status === "REVIEWED" ? new Date() : issue.reviewedAt,
          dismissedAt: status === "DISMISSED" ? new Date() : null,
        },
      });
      await writeAdminAudit(session.adminId, "GOV_REVIEW", "ProviderGovernanceIssue", updated.id, { action, status });
      return NextResponse.json({ issue: updated });
    }

    return NextResponse.json({ error: "No supported governance target provided" }, { status: 400 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to update provider governance:", error);
    return NextResponse.json({ error: "Failed to update provider governance" }, { status: 500 });
  }
}

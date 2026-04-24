import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  getProviderQualityWarnings,
  normalizeProviderUrlDomain,
} from "@locateflow/shared";

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
          isActive: true,
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
      const warnings = getProviderQualityWarnings({
        ...provider,
        duplicateDomainCount: domain ? domainCounts.get(domain) || 0 : 0,
      });
      for (const warning of warnings) {
        queues[warningTypeToQueue(warning.code)].push({
          provider,
          warning,
          domain,
        });
      }
    }

    for (const provider of customProviders) {
      if (provider.adminReviewStatus !== "REVIEWED") {
        queues.userCreatedProviderReview.push({
          provider,
          warning: {
            code: "user_custom_review",
            label: "User-created provider review",
            message: "Private user-created provider needs support/governance review.",
          },
        });
      }
    }

    const summary = Object.fromEntries(
      Object.entries(queues).map(([key, value]) => [key, value.length]),
    );

    return NextResponse.json({
      queues,
      issues,
      summary,
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

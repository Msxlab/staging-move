import { NextRequest, NextResponse } from "next/server";
import { revalidateProvidersCatalog } from "@/lib/providers-revalidate";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta } from "@/lib/audit";
import { isHttpsUrl } from "@/lib/url-safety";
import { parseClampedPositiveInt, parsePaginationParams } from "@/lib/pagination";
import { validateCsvFileMetadata } from "@/lib/privacy";
import { rebuildProviderCoverage } from "@locateflow/db";
import {
  findProviderConflicts,
  getProviderQualityWarnings,
  normalizeProviderRecord,
  normalizeProviderUrlDomain,
  slugifyProviderName,
} from "@locateflow/shared";

// Affiliate fields live outside normalizeProviderRecord. Validate them once for
// both the single-create and CSV-import paths so they can't drift: an external
// affiliate link must be https, and an offer can't be active without one.
function extractAffiliateFields(
  raw: Record<string, unknown>,
): { affiliateUrl: string | null; affiliateNetwork: string | null; affiliateActive: boolean } | { error: string } {
  const urlRaw = typeof raw.affiliateUrl === "string" ? raw.affiliateUrl.trim() : "";
  if (urlRaw && !isHttpsUrl(urlRaw)) return { error: "affiliateUrl must be an https URL." };
  const affiliateUrl = urlRaw || null;
  const affiliateNetwork =
    typeof raw.affiliateNetwork === "string" && raw.affiliateNetwork.trim()
      ? raw.affiliateNetwork.trim().slice(0, 40)
      : null;
  const affiliateActive = raw.affiliateActive === true || raw.affiliateActive === "true";
  if (affiliateActive && !isHttpsUrl(affiliateUrl)) {
    return { error: "Set a valid https affiliateUrl before activating the affiliate offer." };
  }
  return { affiliateUrl, affiliateNetwork, affiliateActive };
}

function parseIncomingProvider(raw: Record<string, unknown>) {
  return normalizeProviderRecord({
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    slug: typeof raw.slug === "string" && raw.slug.trim() ? raw.slug.trim() : slugifyProviderName(String(raw.name || "")),
    category: typeof raw.category === "string" ? raw.category.trim().toUpperCase() : "",
    subCategory: typeof raw.subCategory === "string" && raw.subCategory.trim() ? raw.subCategory.trim() : null,
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : null,
    website: typeof raw.website === "string" && raw.website.trim() ? raw.website.trim() : null,
    phone: typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : null,
    logoUrl: typeof raw.logoUrl === "string" && raw.logoUrl.trim() ? raw.logoUrl.trim() : null,
    scope: typeof raw.scope === "string" ? raw.scope : "FEDERAL",
    states: raw.states as string[] | string | null | undefined,
    zipCodes: raw.zipCodes as string[] | string | null | undefined,
    tags: raw.tags as string[] | string | null | undefined,
    popularityScore: Number(raw.popularityScore) || 0,
    isActive: raw.isActive !== "false" && raw.isActive !== false,
    displayOrder: Number(raw.displayOrder) || 0,
  });
}

async function loadComparableProviders() {
  return prisma.serviceProvider.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      website: true,
    },
  });
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

function attachQualityWarnings(provider: any, domainCounts: Map<string, number>) {
  const domain = normalizeProviderUrlDomain(provider.website);
  const qualityWarnings = getProviderQualityWarnings({
    ...provider,
    duplicateDomainCount: domain ? domainCounts.get(domain) || 0 : 0,
  });
  return {
    ...provider,
    qualityWarnings,
    qualityWarningCount: qualityWarnings.length,
  };
}

function summarizeQuality(providers: Array<{ qualityWarnings?: Array<{ code: string }> }>) {
  const counts: Record<string, number> = {};
  for (const provider of providers) {
    for (const warning of provider.qualityWarnings || []) {
      counts[warning.code] = (counts[warning.code] || 0) + 1;
    }
  }
  return counts;
}

function getConflictMessage(conflictType: string, name: string, slug: string) {
  if (conflictType === "slug") {
    return `Provider slug already exists: ${slug}`;
  }
  if (conflictType === "website-category") {
    return `Provider website already exists in this category: ${name}`;
  }
  return `Provider already exists in this category: ${name}`;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { searchParams } = new URL(request.url);
    const page = parseClampedPositiveInt(searchParams.get("page"), 1);
    const grouped = searchParams.get("grouped") === "true";
    const { perPage: requestedPerPage } = parsePaginationParams(searchParams, {
      defaultPerPage: 100,
    });
    const perPage = grouped ? 2000 : requestedPerPage;
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const scope = searchParams.get("scope") || "";
    const status = searchParams.get("status") || "";
    const states = searchParams.get("states") || "";
    const scoreMin = searchParams.get("scoreMin") || "";
    const scoreMax = searchParams.get("scoreMax") || "";
    const tags = (searchParams.get("tags") || "").trim().slice(0, 64);

    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }
    if (category) where.category = category;
    if (scope) where.scope = scope;
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;
    if (scoreMin) where.popularityScore = { ...(where.popularityScore || {}), gte: parseInt(scoreMin) };
    if (scoreMax) where.popularityScore = { ...(where.popularityScore || {}), lte: parseInt(scoreMax) };
    if (states) where.states = { contains: states };
    if (tags) where.tags = { contains: tags };

    const [providers, total, categoryStats, comparableProviders] = await Promise.all([
      prisma.serviceProvider.findMany({
        where,
        orderBy: [{ category: "asc" }, { popularityScore: "desc" }, { name: "asc" }],
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      prisma.serviceProvider.count({ where }),
      prisma.serviceProvider.groupBy({
        by: ["category"],
        _count: { id: true },
        _avg: { popularityScore: true },
        where,
      }),
      loadComparableProviders(),
    ]);

    const scopeStats = await prisma.serviceProvider.groupBy({
      by: ["scope"],
      _count: { id: true },
      where,
    });

    const activeCount = await prisma.serviceProvider.count({ where: { ...where, isActive: true } });
    const inactiveCount = total - activeCount;
    const domainCounts = buildDomainCounts(comparableProviders);
    const providersWithQuality = providers.map((provider: any) =>
      attachQualityWarnings(provider, domainCounts),
    );
    const qualitySummary = summarizeQuality(providersWithQuality);

    if (grouped) {
      const groups: Record<string, any[]> = {};
      providersWithQuality.forEach((provider: any) => {
        if (!groups[provider.category]) groups[provider.category] = [];
        groups[provider.category].push(provider);
      });

      return NextResponse.json({
        groups,
        total,
        categoryStats: categoryStats.map((item: any) => ({
          category: item.category,
          count: item._count.id,
          avgScore: Math.round((item._avg.popularityScore || 0) * 10) / 10,
        })),
        scopeStats: scopeStats.map((item: any) => ({ scope: item.scope, count: item._count.id })),
        qualitySummary,
        activeCount,
        inactiveCount,
        page,
        perPage,
      });
    }

    return NextResponse.json({ providers: providersWithQuality, total, page, perPage, categoryStats, qualitySummary, activeCount, inactiveCount });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to fetch providers:", error?.message, error);
    return NextResponse.json(
      {
        error: "Failed to fetch providers",
        detail: process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission("providers", "canCreate", { minimumRole: "MODERATOR" });
    const body = await request.json();
    const { providers: rows, sourceFile } = body;

    if (!sourceFile) {
      return NextResponse.json({ error: "CSV import requires file metadata." }, { status: 415 });
    }

    const fileValidation = validateCsvFileMetadata(sourceFile);
    if (!fileValidation.ok) {
      return NextResponse.json({ error: fileValidation.error }, { status: fileValidation.status });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No providers to import" }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const knownProviders = await loadComparableProviders();

    for (const row of rows) {
      const normalized = parseIncomingProvider(row);
      if (!normalized.name || !normalized.category) {
        skipped++;
        continue;
      }

      const conflicts = findProviderConflicts(knownProviders, normalized);
      if (conflicts.length > 0) {
        skipped++;
        const firstConflict = conflicts[0];
        errors.push(getConflictMessage(firstConflict.type, firstConflict.existingName, firstConflict.existingSlug));
        continue;
      }

      const affiliate = extractAffiliateFields(row);
      if ("error" in affiliate) {
        skipped++;
        errors.push(`${normalized.name}: ${affiliate.error}`);
        continue;
      }

      try {
        const createdProvider = await prisma.$transaction(async (tx: any) => {
          const provider = await tx.serviceProvider.create({
            data: {
              name: normalized.name,
              slug: normalized.slug,
              category: normalized.category,
              subCategory: normalized.subCategory,
              description: normalized.description,
              website: normalized.website,
              phone: normalized.phone,
              logoUrl: normalized.logoUrl,
              scope: normalized.scope,
              states: JSON.stringify(normalized.states),
              zipCodes: JSON.stringify(normalized.zipCodes),
              tags: JSON.stringify(normalized.tags),
              popularityScore: normalized.popularityScore || 0,
              isActive: normalized.isActive ?? true,
              displayOrder: normalized.displayOrder || 0,
              affiliateUrl: affiliate.affiliateUrl,
              affiliateNetwork: affiliate.affiliateNetwork,
              affiliateActive: affiliate.affiliateActive,
            },
          });
          await rebuildProviderCoverage(tx, {
            providerId: provider.id,
            scope: normalized.scope,
            states: normalized.states,
            zipCodes: normalized.zipCodes,
          });
          return provider;
        });

        knownProviders.push({
          id: createdProvider.id,
          name: createdProvider.name,
          slug: createdProvider.slug,
          category: createdProvider.category,
          website: createdProvider.website,
        });
        created++;
      } catch (error: any) {
        errors.push(`${normalized.name}: ${error.message?.slice(0, 80)}`);
      }
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BULK_IMPORT_PROVIDERS",
        entityType: "ServiceProvider",
        entityId: "bulk",
        changes: JSON.stringify({ created, skipped, errors: errors.length }),
        ipAddress: getAuditRequestMeta(request).ipAddress || "unknown",
      },
    });

    if (created > 0) revalidateProvidersCatalog();

    return NextResponse.json({ created, skipped, errors: errors.slice(0, 10), total: rows.length });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("providers", "canCreate", { minimumRole: "MODERATOR" });
    const body = await request.json();
    const normalized = parseIncomingProvider(body);

    if (!normalized.name || !normalized.category) {
      return NextResponse.json({ error: "Name and category are required" }, { status: 400 });
    }

    const affiliate = extractAffiliateFields(body);
    if ("error" in affiliate) {
      return NextResponse.json({ error: affiliate.error }, { status: 400 });
    }

    const conflicts = findProviderConflicts(await loadComparableProviders(), normalized);
    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      return NextResponse.json(
        { error: getConflictMessage(firstConflict.type, firstConflict.existingName, firstConflict.existingSlug) },
        { status: 409 }
      );
    }

    const provider = await prisma.$transaction(async (tx: any) => {
      const createdProvider = await tx.serviceProvider.create({
        data: {
          name: normalized.name,
          slug: normalized.slug,
          category: normalized.category,
          subCategory: normalized.subCategory,
          description: normalized.description,
          website: normalized.website,
          phone: normalized.phone,
          logoUrl: normalized.logoUrl,
          scope: normalized.scope,
          states: JSON.stringify(normalized.states),
          zipCodes: JSON.stringify(normalized.zipCodes),
          tags: JSON.stringify(normalized.tags),
          popularityScore: normalized.popularityScore || 0,
          isActive: normalized.isActive ?? true,
          displayOrder: normalized.displayOrder || 0,
          affiliateUrl: affiliate.affiliateUrl,
          affiliateNetwork: affiliate.affiliateNetwork,
          affiliateActive: affiliate.affiliateActive,
        },
      });
      await rebuildProviderCoverage(tx, {
        providerId: createdProvider.id,
        scope: normalized.scope,
        states: normalized.states,
        zipCodes: normalized.zipCodes,
      });
      return createdProvider;
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE_PROVIDER",
        entityType: "ServiceProvider",
        entityId: provider.id,
        changes: JSON.stringify({ name: provider.name }),
        ipAddress: getAuditRequestMeta(request).ipAddress || "unknown",
      },
    });

    revalidateProvidersCatalog();

    return NextResponse.json({ provider }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to create provider:", error);
    return NextResponse.json({ error: "Failed to create provider" }, { status: 500 });
  }
}

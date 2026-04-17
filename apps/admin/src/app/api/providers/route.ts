import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { rebuildProviderCoverage } from "@locateflow/db";

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const grouped = searchParams.get("grouped") === "true";
    const perPage = grouped ? 2000 : Math.min(parseInt(searchParams.get("perPage") || "100"), 100);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const scope = searchParams.get("scope") || "";
    const status = searchParams.get("status") || "";
    const states = searchParams.get("states") || "";
    const scoreMin = searchParams.get("scoreMin") || "";
    const scoreMax = searchParams.get("scoreMax") || "";
    const tags = searchParams.get("tags") || "";

    const where: any = {};
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

    const [providers, total, categoryStats] = await Promise.all([
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
    ]);

    const scopeStats = await prisma.serviceProvider.groupBy({
      by: ["scope"],
      _count: { id: true },
      where,
    });

    const activeCount = await prisma.serviceProvider.count({ where: { ...where, isActive: true } });
    const inactiveCount = total - activeCount;

    if (grouped) {
      const groups: Record<string, any[]> = {};
      providers.forEach((p: any) => {
        if (!groups[p.category]) groups[p.category] = [];
        groups[p.category].push(p);
      });
      return NextResponse.json({
        groups,
        total,
        categoryStats: categoryStats.map((c: any) => ({
          category: c.category,
          count: c._count.id,
          avgScore: Math.round((c._avg.popularityScore || 0) * 10) / 10,
        })),
        scopeStats: scopeStats.map((s: any) => ({ scope: s.scope, count: s._count.id })),
        activeCount,
        inactiveCount,
        page,
        perPage,
      });
    }

    return NextResponse.json({ providers, total, page, perPage, categoryStats, activeCount, inactiveCount });
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

// PUT - Bulk CSV import
export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission("providers", "canCreate", { minimumRole: "MODERATOR" });
    const body = await request.json();
    const { providers: rows } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No providers to import" }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.name || !row.category) {
        skipped++;
        continue;
      }
      const slug = row.slug || row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      try {
        const existing = await prisma.serviceProvider.findUnique({ where: { slug } });
        if (existing) { skipped++; continue; }

        const scope = row.scope || "FEDERAL";
        const states = parseArray(row.states);
        const zipCodes = parseArray(row.zipCodes);

        await prisma.$transaction(async (tx) => {
          const prov = await tx.serviceProvider.create({
            data: {
              name: row.name,
              slug,
              category: row.category,
              subCategory: row.subCategory || null,
              description: row.description || null,
              website: row.website || null,
              phone: row.phone || null,
              scope,
              states: JSON.stringify(states),
              zipCodes: JSON.stringify(zipCodes),
              tags: row.tags ? (typeof row.tags === "string" ? row.tags : JSON.stringify(row.tags)) : "[]",
              popularityScore: parseInt(row.popularityScore) || 0,
              isActive: row.isActive !== "false" && row.isActive !== false,
            },
          });
          await rebuildProviderCoverage(tx, { providerId: prov.id, scope, states, zipCodes });
        });
        created++;
      } catch (e: any) {
        errors.push(`${row.name}: ${e.message?.slice(0, 80)}`);
      }
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BULK_IMPORT_PROVIDERS",
        entityType: "ServiceProvider",
        entityId: "bulk",
        changes: JSON.stringify({ created, skipped, errors: errors.length }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    if (created > 0) revalidateTag("providers");

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

    const scope = body.scope || "FEDERAL";
    const states = parseArray(body.states);
    const zipCodes = parseArray(body.zipCodes);

    const provider = await prisma.$transaction(async (tx) => {
      const prov = await tx.serviceProvider.create({
        data: {
          name: body.name,
          slug: body.slug,
          category: body.category,
          subCategory: body.subCategory || null,
          description: body.description || null,
          website: body.website || null,
          phone: body.phone || null,
          logoUrl: body.logoUrl || null,
          scope,
          states: JSON.stringify(states),
          zipCodes: JSON.stringify(zipCodes),
          tags: body.tags ? JSON.stringify(body.tags) : "[]",
          popularityScore: body.popularityScore || 0,
          isActive: body.isActive ?? true,
          displayOrder: body.displayOrder || 0,
        },
      });
      await rebuildProviderCoverage(tx, { providerId: prov.id, scope, states, zipCodes });
      return prov;
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE_PROVIDER",
        entityType: "ServiceProvider",
        entityId: provider.id,
        changes: JSON.stringify({ name: provider.name }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    revalidateTag("providers");

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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Backfill listing — active providers with NULL or empty logoUrl. Returns
 * up to 200 at a time so the page can paginate without loading the entire
 * dataset (231 active providers today, but this scales).
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const perPage = Math.min(
      200,
      Math.max(10, parseInt(searchParams.get("perPage") || "50", 10) || 50),
    );
    const onlyWithWebsite = searchParams.get("onlyWithWebsite") !== "false";

    const where: any = {
      isActive: true,
      logoUrl: null,
    };
    if (onlyWithWebsite) {
      where.website = { not: null };
    }

    const [providers, total] = await Promise.all([
      prisma.serviceProvider.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          website: true,
          phone: true,
          scope: true,
          popularityScore: true,
          logoCandidates: {
            where: { status: "PENDING" },
            select: {
              id: true,
              source: true,
              sourceUrl: true,
              publicUrl: true,
              contentType: true,
              bytes: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      prisma.serviceProvider.count({ where }),
    ]);

    return NextResponse.json({
      providers,
      total,
      page,
      perPage,
      onlyWithWebsite,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[ADMIN] needs-logo listing failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch providers needing logos" },
      { status: 500 },
    );
  }
}

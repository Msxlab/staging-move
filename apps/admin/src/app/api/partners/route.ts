import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

/**
 * GET /api/partners — the generic-partner verification queue (R4c). Defaults to
 * the open lifecycle (PENDING + IN_REVIEW + NEEDS_INFO). Read at providers:canRead
 * (VIEWER floor), mirroring the mover-applications queue.
 */
const STATUSES = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "NEEDS_INFO"] as const;
const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });

    const statusParam = request.nextUrl.searchParams.get("status");
    const where =
      statusParam && (STATUSES as readonly string[]).includes(statusParam)
        ? { status: statusParam }
        : { status: { in: ["PENDING", "IN_REVIEW", "NEEDS_INFO"] } };

    const [partners, totals] = await Promise.all([
      prisma.partner.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        select: {
          id: true,
          category: true,
          companyName: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          website: true,
          serviceStates: true,
          status: true,
          decisionMessage: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
      prisma.partner.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const summary: Record<string, number> = {};
    for (const row of totals) summary[row.status] = row._count._all;

    return NextResponse.json({ partners, summary });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to list partners:", error);
    return NextResponse.json({ error: "Failed to list partners" }, { status: 500 });
  }
}

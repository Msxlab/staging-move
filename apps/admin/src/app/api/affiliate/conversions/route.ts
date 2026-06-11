import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

/**
 * GET /api/affiliate/conversions — actionable affiliate-commission conversions
 * for the admin reconciliation queue (default the open lifecycle: PENDING +
 * APPROVED). These are commissions LocateFlow EARNS from provider networks; the
 * status flow (PENDING → APPROVED → PAID, or REJECTED) is reconciled here as a
 * network settles. Read at providers:canRead (VIEWER floor).
 */

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "PAID"] as const;
const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });

    const statusParam = request.nextUrl.searchParams.get("status");
    const where =
      statusParam && (STATUSES as readonly string[]).includes(statusParam)
        ? { status: statusParam }
        : { status: { in: ["PENDING", "APPROVED"] } };

    const [conversions, totals] = await Promise.all([
      prisma.affiliateConversion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        select: {
          id: true,
          network: true,
          externalTransactionId: true,
          status: true,
          amountCents: true,
          currency: true,
          occurredAt: true,
          createdAt: true,
          provider: { select: { name: true } },
        },
      }),
      prisma.affiliateConversion.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountCents: true } }),
    ]);

    const summary: Record<string, { count: number; amountCents: number }> = {};
    for (const row of totals) summary[row.status] = { count: row._count._all, amountCents: row._sum.amountCents ?? 0 };

    return NextResponse.json({
      conversions: conversions.map((c) => ({
        id: c.id,
        network: c.network,
        externalTransactionId: c.externalTransactionId,
        status: c.status,
        amountCents: c.amountCents,
        currency: c.currency,
        occurredAt: c.occurredAt,
        createdAt: c.createdAt,
        providerName: c.provider?.name ?? "—",
      })),
      summary,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to list affiliate conversions:", error);
    return NextResponse.json({ error: "Failed to list affiliate conversions" }, { status: 500 });
  }
}

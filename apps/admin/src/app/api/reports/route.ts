export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { normalizeMovingPlanStatus } from "@locateflow/shared";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "VIEWER", fallbackResources: ["audit_logs"] });
    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const type = url.searchParams.get("type") || "overview";

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const prevDuration = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - prevDuration);
    const prevEnd = new Date(start);

    if (type === "overview" || type === "all") {
      const [
        usersInRange, usersPrev, subsInRange, subsPrev,
        movingInRange, movingPrev, providersTotal,
      ] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.user.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
        prisma.subscription.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.subscription.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
        prisma.movingPlan.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.movingPlan.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
        prisma.serviceProvider.count({ where: { isActive: true } }),
      ]);

      const calcChange = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;

      const dailyUsers: Record<string, number> = {};
      const allUsersInRange = await prisma.user.findMany({ where: { createdAt: { gte: start, lte: end } }, select: { createdAt: true } });
      allUsersInRange.forEach((u) => { const d = u.createdAt.toISOString().split("T")[0]; dailyUsers[d] = (dailyUsers[d] || 0) + 1; });

      const movingByStatus = await prisma.movingPlan.groupBy({
        by: ["status"],
        where: { createdAt: { gte: start, lte: end } },
        _count: { _all: true },
      });
      const movingStatusCounts = new Map<string, number>();
      movingByStatus.forEach((m) => {
        const status = normalizeMovingPlanStatus(m.status);
        movingStatusCounts.set(status, (movingStatusCounts.get(status) || 0) + m._count._all);
      });

      const [topStates, topProviders] = await Promise.all([
        prisma.address.groupBy({
          by: ["state"],
          where: { createdAt: { gte: start, lte: end } },
          _count: { _all: true },
          orderBy: { _count: { state: "desc" } },
          take: 10,
        }),
        prisma.serviceProvider.findMany({
          where: { isActive: true },
          orderBy: { popularityScore: "desc" },
          take: 10,
          select: { name: true, popularityScore: true },
        }),
      ]);

      return NextResponse.json({
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        metrics: [
          { label: "New Users", current: usersInRange, previous: usersPrev, change: calcChange(usersInRange, usersPrev) },
          { label: "New Subscriptions", current: subsInRange, previous: subsPrev, change: calcChange(subsInRange, subsPrev) },
          { label: "Moving Plans", current: movingInRange, previous: movingPrev, change: calcChange(movingInRange, movingPrev) },
          { label: "Active Providers", current: providersTotal, previous: providersTotal, change: 0 },
        ],
        dailyUsers,
        movingByStatus: Array.from(movingStatusCounts, ([status, count]) => ({ status, count })),
        topProviders: topProviders.map((p) => ({ name: p.name, popularityScore: p.popularityScore })),
        topStates: topStates.map((s) => ({ state: s.state, count: s._count._all })),
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[Reports API Error]", e.message, e.stack);
    // Don't leak the raw exception message to the client — gate behind dev
    // like the sibling admin routes (providers/moving). Server log keeps it.
    return NextResponse.json(
      { error: "Internal error", ...(process.env.NODE_ENV === "development" ? { detail: e.message } : {}) },
      { status: 500 },
    );
  }
}

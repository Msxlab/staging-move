export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

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
        _count: true,
      });

      const topStates = await prisma.address.groupBy({
        by: ["state"],
        where: { createdAt: { gte: start, lte: end } },
        _count: true,
        orderBy: { _count: { state: "desc" } },
        take: 10,
      });

      return NextResponse.json({
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        metrics: [
          { label: "New Users", current: usersInRange, previous: usersPrev, change: calcChange(usersInRange, usersPrev) },
          { label: "New Subscriptions", current: subsInRange, previous: subsPrev, change: calcChange(subsInRange, subsPrev) },
          { label: "Moving Plans", current: movingInRange, previous: movingPrev, change: calcChange(movingInRange, movingPrev) },
          { label: "Active Providers", current: providersTotal, previous: providersTotal, change: 0 },
        ],
        dailyUsers,
        movingByStatus: movingByStatus.map((m) => ({ status: m.status, count: m._count })),
        topStates: topStates.map((s) => ({ state: s.state, count: s._count })),
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[Reports API Error]", e.message, e.stack);
    return NextResponse.json({ error: "Internal error", detail: e.message }, { status: 500 });
  }
}

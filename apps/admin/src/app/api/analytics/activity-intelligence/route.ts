import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users", "canRead", { minimumRole: "ADMIN" });

    const now = new Date();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Onboarding Funnel ──────────────────────────────────
    const totalUsers = await prisma.user.count();
    const withProfile = await prisma.profile.count();
    const withAddress = await prisma.address.count({ where: { isPrimary: true } });
    const withService = await prisma.service.count({ where: { isActive: true } });
    const withMovingPlan = await prisma.movingPlan.count();
    const withPaidPlan = await prisma.subscription.count({ where: { plan: { not: "FREE_TRIAL" } } });

    const funnel = [
      { step: "Signup", count: totalUsers, pct: 100 },
      { step: "Profile Created", count: withProfile, pct: totalUsers > 0 ? Math.round((withProfile / totalUsers) * 100) : 0 },
      { step: "Address Added", count: withAddress, pct: totalUsers > 0 ? Math.round((withAddress / totalUsers) * 100) : 0 },
      { step: "Service Setup", count: withService, pct: totalUsers > 0 ? Math.round((withService / totalUsers) * 100) : 0 },
      { step: "Moving Plan", count: withMovingPlan, pct: totalUsers > 0 ? Math.round((withMovingPlan / totalUsers) * 100) : 0 },
      { step: "Paid Plan", count: withPaidPlan, pct: totalUsers > 0 ? Math.round((withPaidPlan / totalUsers) * 100) : 0 },
    ];

    // ── Engagement Scoring ──────────────────────────────────
    const recentSessions = await prisma.userSession.groupBy({
      by: ["userId"],
      where: { sessionStart: { gte: day30 } },
      _count: { id: true },
      _sum: { pageViews: true },
    });

    const recentEvents = await prisma.userEvent.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: day30 } },
      _count: { id: true },
    });

    const sessionMap = new Map(recentSessions.map((s) => [s.userId, { sessions: s._count.id, pageViews: s._sum.pageViews || 0 }]));
    const eventMap = new Map(recentEvents.map((e) => [e.userId, e._count.id]));

    const allUserIds = new Set([...sessionMap.keys(), ...eventMap.keys()]);
    let highEngagement = 0, medEngagement = 0, lowEngagement = 0, noEngagement = 0;

    for (const uid of allUserIds) {
      const s = sessionMap.get(uid);
      const evts = eventMap.get(uid) || 0;
      const sessions = s?.sessions || 0;
      const score = sessions * 3 + evts;
      if (score >= 30) highEngagement++;
      else if (score >= 10) medEngagement++;
      else lowEngagement++;
    }
    noEngagement = totalUsers - allUserIds.size;

    const engagement = {
      high: highEngagement,
      medium: medEngagement,
      low: lowEngagement,
      none: noEngagement,
      total: totalUsers,
    };

    // ── Churn Risk ──────────────────────────────────────────
    // Users with no sessions in 14+ days but signed up 7+ days ago
    const usersWithRecent = await prisma.userSession.findMany({
      where: { sessionStart: { gte: day14 } },
      select: { userId: true },
      distinct: ["userId"],
    });
    const recentUserIds = new Set(usersWithRecent.map((u) => u.userId));

    const oldUsers = await prisma.user.count({ where: { createdAt: { lt: day7 } } });
    const oldUsersActive = await prisma.user.count({
      where: {
        createdAt: { lt: day7 },
        id: { in: [...recentUserIds] },
      },
    });

    const atRisk = oldUsers - oldUsersActive;
    const trialExpiring = await prisma.subscription.count({
      where: {
        status: "TRIALING",
        trialEndsAt: { lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), gte: now },
      },
    });

    const churn = {
      atRisk,
      oldUsers,
      activeRate: oldUsers > 0 ? Math.round((oldUsersActive / oldUsers) * 100) : 0,
      trialExpiringSoon: trialExpiring,
    };

    // ── Platform Distribution ───────────────────────────────
    const platformDist = await prisma.userSession.groupBy({
      by: ["platform"],
      where: { sessionStart: { gte: day30 } },
      _count: { id: true },
    });

    const platforms = platformDist.map((p) => ({
      platform: p.platform || "UNKNOWN",
      count: p._count.id,
    }));

    // ── Top Events ──────────────────────────────────────────
    const topEvents = await prisma.userEvent.groupBy({
      by: ["event"],
      where: { createdAt: { gte: day30 } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    });

    // ── Daily Active Users (last 30 days) ───────────────────
    const daySessions = await prisma.userSession.findMany({
      where: { sessionStart: { gte: day30 } },
      select: { sessionStart: true, userId: true },
    });

    const dauMap: Record<string, Set<string>> = {};
    for (const s of daySessions) {
      const day = s.sessionStart.toISOString().split("T")[0];
      if (!dauMap[day]) dauMap[day] = new Set();
      dauMap[day].add(s.userId);
    }
    const dau = Object.entries(dauMap)
      .map(([date, users]) => ({ date, count: users.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ funnel, engagement, churn, platforms, topEvents: topEvents.map((e) => ({ event: e.event, count: e._count.id })), dau });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Activity intelligence error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

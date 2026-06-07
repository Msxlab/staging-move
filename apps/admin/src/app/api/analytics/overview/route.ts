import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

/**
 * Date-range + segmentation aware analytics overview.
 *
 * Drives the global date-range control, the "vs previous period" KPI deltas,
 * the plan / platform / region segmentation bar, and the move-analytics
 * surface (origin→destination state pairs, interstate vs intrastate mix,
 * average move lead time) on the admin Analytics page.
 *
 * Read-only. Uses the soft-delete-extended `prisma` client so deleted
 * users / addresses / moving plans are excluded automatically.
 *
 * Query params:
 *   range    today | 7d | 30d | 90d | custom   (default 30d)
 *   from,to  ISO date strings (only honoured when range=custom)
 *   plan     FREE_TRIAL | INDIVIDUAL | FAMILY | PRO  (segmentation)
 *   platform WEB | IOS_APP | ANDROID_APP | PWA       (segmentation, session-level)
 *   region   exact UserSession.region value          (segmentation, session-level)
 */

const RANGE_DAYS: Record<string, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const PLAN_VALUES = new Set(["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"]);
const PLATFORM_VALUES = new Set(["WEB", "IOS_APP", "ANDROID_APP", "PWA"]);

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null = "new" (no baseline)
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

interface Window {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  days: number;
}

function resolveWindow(searchParams: URLSearchParams): Window {
  const range = searchParams.get("range") || "30d";
  const now = new Date();

  if (range === "custom") {
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const from = fromRaw ? new Date(fromRaw) : new Date(now.getTime() - 30 * 86400000);
    const to = toRaw ? new Date(toRaw) : now;
    const start = startOfDay(from);
    // Make `to` inclusive of the whole selected day.
    const end = new Date(startOfDay(to).getTime() + 86400000);
    const span = Math.max(end.getTime() - start.getTime(), 86400000);
    return {
      start,
      end,
      prevStart: new Date(start.getTime() - span),
      prevEnd: start,
      days: Math.max(Math.round(span / 86400000), 1),
    };
  }

  const days = RANGE_DAYS[range] ?? 30;
  const end = range === "today" ? new Date() : now;
  const start =
    range === "today" ? startOfDay(now) : new Date(now.getTime() - days * 86400000);
  const span = end.getTime() - start.getTime();
  return {
    start,
    end,
    prevStart: new Date(start.getTime() - span),
    prevEnd: start,
    days,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users", "canRead", { minimumRole: "ADMIN" });

    const { searchParams } = new URL(request.url);
    const win = resolveWindow(searchParams);

    // ── Segmentation filters ────────────────────────────────
    const planFilter = searchParams.get("plan");
    const platformFilter = searchParams.get("platform");
    const regionFilter = searchParams.get("region");

    const plan = planFilter && PLAN_VALUES.has(planFilter) ? planFilter : null;
    const platform =
      platformFilter && PLATFORM_VALUES.has(platformFilter) ? platformFilter : null;
    const region = regionFilter && regionFilter.trim() ? regionFilter.trim() : null;

    // User-id allowlist when a plan segment is selected — applied to every
    // user-scoped query so KPIs/charts/moves all respect the segment.
    let planUserIds: string[] | null = null;
    if (plan) {
      const subs = await prisma.subscription.findMany({
        where: { plan },
        select: { userId: true },
      });
      planUserIds = subs.map((s) => s.userId);
    }

    // Session-level WHERE fragment shared by every session query.
    const sessionSegment: Record<string, unknown> = {};
    if (platform) sessionSegment.platform = platform;
    if (region) sessionSegment.region = region;
    if (planUserIds) sessionSegment.userId = { in: planUserIds };

    const userSegment: Record<string, unknown> = {};
    if (planUserIds) userSegment.id = { in: planUserIds };

    // ── KPIs (current vs previous window) ───────────────────
    const sessionWhere = (start: Date, end: Date) => ({
      ...sessionSegment,
      sessionStart: { gte: start, lt: end },
    });
    const userWhere = (start: Date, end: Date) => ({
      ...userSegment,
      createdAt: { gte: start, lt: end },
    });

    const [
      activeUsersCur,
      activeUsersPrev,
      sessionsCur,
      sessionsPrev,
      newUsersCur,
      newUsersPrev,
      eventsCur,
      eventsPrev,
    ] = await Promise.all([
      prisma.userSession
        .findMany({
          where: sessionWhere(win.start, win.end),
          select: { userId: true },
          distinct: ["userId"],
        })
        .then((r) => r.length),
      prisma.userSession
        .findMany({
          where: sessionWhere(win.prevStart, win.prevEnd),
          select: { userId: true },
          distinct: ["userId"],
        })
        .then((r) => r.length),
      prisma.userSession.count({ where: sessionWhere(win.start, win.end) }),
      prisma.userSession.count({ where: sessionWhere(win.prevStart, win.prevEnd) }),
      prisma.user.count({ where: userWhere(win.start, win.end) }),
      prisma.user.count({ where: userWhere(win.prevStart, win.prevEnd) }),
      prisma.userEvent.count({
        where: {
          createdAt: { gte: win.start, lt: win.end },
          ...(planUserIds ? { userId: { in: planUserIds } } : {}),
        },
      }),
      prisma.userEvent.count({
        where: {
          createdAt: { gte: win.prevStart, lt: win.prevEnd },
          ...(planUserIds ? { userId: { in: planUserIds } } : {}),
        },
      }),
    ]);

    const kpis = {
      activeUsers: {
        value: activeUsersCur,
        previous: activeUsersPrev,
        delta: pctDelta(activeUsersCur, activeUsersPrev),
      },
      sessions: {
        value: sessionsCur,
        previous: sessionsPrev,
        delta: pctDelta(sessionsCur, sessionsPrev),
      },
      newUsers: {
        value: newUsersCur,
        previous: newUsersPrev,
        delta: pctDelta(newUsersCur, newUsersPrev),
      },
      events: {
        value: eventsCur,
        previous: eventsPrev,
        delta: pctDelta(eventsCur, eventsPrev),
      },
    };

    // ── Registration trend (daily, within window) ───────────
    const regUsers = await prisma.user.findMany({
      where: userWhere(win.start, win.end),
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const registrations: Record<string, number> = {};
    // Seed every day in the window so the sparkline shows zero-days.
    for (let t = win.start.getTime(); t < win.end.getTime(); t += 86400000) {
      registrations[new Date(t).toISOString().split("T")[0]] = 0;
    }
    regUsers.forEach((u) => {
      const day = u.createdAt.toISOString().split("T")[0];
      registrations[day] = (registrations[day] || 0) + 1;
    });

    // ── Segmented distributions (within window) ─────────────
    const windowSessions = await prisma.userSession.findMany({
      where: sessionWhere(win.start, win.end),
      select: { platform: true, deviceType: true, region: true },
    });

    const platformMap: Record<string, number> = {};
    const deviceMap: Record<string, number> = {};
    const regionMap: Record<string, number> = {};
    windowSessions.forEach((s) => {
      const p = s.platform || "WEB";
      const d = s.deviceType || "Desktop";
      platformMap[p] = (platformMap[p] || 0) + 1;
      deviceMap[d] = (deviceMap[d] || 0) + 1;
      if (s.region) regionMap[s.region] = (regionMap[s.region] || 0) + 1;
    });

    // Plan mix is computed over all subscriptions matching the (plan)
    // segment — it answers "who are these users" rather than a time slice.
    const planGroups = await prisma.subscription.groupBy({
      by: ["plan"],
      where: plan ? { plan } : {},
      _count: { id: true },
    });
    const planMix = planGroups
      .map((g) => ({ plan: g.plan, count: g._count.id }))
      .sort((a, b) => b.count - a.count);

    // Distinct regions available for the segmentation dropdown (top 30 by volume).
    const regionOptions = Object.entries(regionMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([r]) => r);

    // ── MOVE ANALYTICS ──────────────────────────────────────
    // Moving plans whose moveDate falls inside the window (+ plan segment).
    // We pull the from/to state + createdAt and aggregate in JS because the
    // origin/destination states live on related Address rows that groupBy
    // can't traverse.
    const moveWhere: Record<string, unknown> = {
      moveDate: { gte: win.start, lt: win.end },
    };
    if (planUserIds) moveWhere.userId = { in: planUserIds };

    const moves = await prisma.movingPlan.findMany({
      where: moveWhere,
      select: {
        moveDate: true,
        createdAt: true,
        fromAddress: { select: { state: true } },
        toAddress: { select: { state: true } },
      },
      take: 20000,
    });

    const pairMap: Record<string, { from: string; to: string; count: number }> = {};
    let interstate = 0;
    let intrastate = 0;
    let leadTimeSum = 0;
    let leadTimeCount = 0;
    const originMap: Record<string, number> = {};
    const destMap: Record<string, number> = {};

    moves.forEach((m) => {
      const from = (m.fromAddress?.state || "??").toUpperCase();
      const to = (m.toAddress?.state || "??").toUpperCase();
      const key = `${from}→${to}`;
      if (!pairMap[key]) pairMap[key] = { from, to, count: 0 };
      pairMap[key].count += 1;

      originMap[from] = (originMap[from] || 0) + 1;
      destMap[to] = (destMap[to] || 0) + 1;

      if (from !== "??" && to !== "??") {
        if (from === to) intrastate += 1;
        else interstate += 1;
      }

      // Lead time = days from plan creation to the move date. Negative
      // (plan created after the move) and absurd values are discarded.
      const leadMs = m.moveDate.getTime() - m.createdAt.getTime();
      const leadDays = leadMs / 86400000;
      if (leadDays >= 0 && leadDays <= 730) {
        leadTimeSum += leadDays;
        leadTimeCount += 1;
      }
    });

    const topPairs = Object.values(pairMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const topOrigins = Object.entries(originMap)
      .filter(([s]) => s !== "??")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([state, count]) => ({ state, count }));
    const topDestinations = Object.entries(destMap)
      .filter(([s]) => s !== "??")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([state, count]) => ({ state, count }));

    const classified = interstate + intrastate;
    const moveAnalytics = {
      totalMoves: moves.length,
      topPairs,
      topOrigins,
      topDestinations,
      interstate,
      intrastate,
      interstatePct: classified > 0 ? Math.round((interstate / classified) * 100) : 0,
      intrastatePct: classified > 0 ? Math.round((intrastate / classified) * 100) : 0,
      avgLeadTimeDays:
        leadTimeCount > 0 ? Math.round((leadTimeSum / leadTimeCount) * 10) / 10 : null,
    };

    return NextResponse.json({
      window: {
        range: searchParams.get("range") || "30d",
        start: win.start.toISOString(),
        end: win.end.toISOString(),
        days: win.days,
        prevStart: win.prevStart.toISOString(),
        prevEnd: win.prevEnd.toISOString(),
      },
      filters: { plan, platform, region },
      regionOptions,
      kpis,
      registrations,
      platforms: Object.entries(platformMap).sort((a, b) => b[1] - a[1]),
      devices: Object.entries(deviceMap).sort((a, b) => b[1] - a[1]),
      regions: Object.entries(regionMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12),
      planMix,
      moveAnalytics,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Analytics overview error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics overview" }, { status: 500 });
  }
}

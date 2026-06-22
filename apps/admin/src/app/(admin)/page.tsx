export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import {
  Users,
  CreditCard,
  Truck,
  Building2,
  ArrowRight,
  MapPin,
  Calendar,
  BarChart3,
  Activity,
  DollarSign,
  TrendingDown,
} from "lucide-react";
import { BILLING_PLAN_DEFINITIONS, PAID_BILLING_PLANS } from "@locateflow/shared";
import Link from "next/link";
import { HealthCard } from "./health-card";
import { maskEmail, maskProviderIdentifier } from "@/lib/privacy";
import { ADMIN_ROLE_HIERARCHY, requirePageAdmin } from "@/lib/page-guard";
import { getIntegrationStatuses } from "@/lib/integration-status";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPanel } from "@/components/admin-panel";
import {
  AuditFeed,
  AuroraStatCard,
  OverviewTrendsCard,
  PlanDonut,
} from "@/components/aurora";
import type {
  AuditFeedItem,
  AuditFeedTone,
  SignupWeekPoint,
} from "@/components/aurora";
import { TierMedallion } from "@/components/premium/tier-medallion";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Daily revenue series window — capped at 90 days to keep the query cheap. */
const REVENUE_WINDOW_DAYS = 90;
/** Spark window for the KPI tiles (slice of the same series). */
const SPARK_DAYS = 30;
/** Rows shown in the dashboard audit feed. */
const AUDIT_FEED_COUNT = 8;
/** ISO weeks shown in the signups-by-plan chart. */
const SIGNUP_WEEKS = 8;
const WEEK_MS = 7 * DAY_MS;

/** UTC day key ("2026-06-09") — all dashboard buckets use UTC days. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** UTC ms of the Monday starting the ISO week that contains `d`. */
function isoWeekStartMs(d: Date): number {
  const dayStartMs = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  );
  // getUTCDay: Sun=0 … Sat=6 — shift so Monday is 0 (ISO week start).
  return dayStartMs - ((d.getUTCDay() + 6) % 7) * DAY_MS;
}

/**
 * New-user signups per ISO week (Monday-start, UTC) for the last
 * SIGNUP_WEEKS weeks, split by plan tier. Subscription is 1:1 with user so
 * this is one bounded, indexed range scan with a tiny relation select.
 * Buckets: INDIVIDUAL / FAMILY / PRO, with FREE_TRIAL and missing
 * subscription rows folded into "free".
 */
async function getSignupsByPlanSeries(now: Date): Promise<SignupWeekPoint[]> {
  const windowStartMs = isoWeekStartMs(now) - (SIGNUP_WEEKS - 1) * WEEK_MS;
  const rows = await prisma.user.findMany({
    where: { createdAt: { gte: new Date(windowStartMs) } },
    select: { createdAt: true, subscription: { select: { plan: true } } },
    take: 20000,
  });

  const weeks: SignupWeekPoint[] = Array.from(
    { length: SIGNUP_WEEKS },
    (_, i) => ({
      weekStart: dayKey(new Date(windowStartMs + i * WEEK_MS)),
      individual: 0,
      family: 0,
      pro: 0,
      free: 0,
    }),
  );
  for (const row of rows) {
    const i = Math.floor(
      (isoWeekStartMs(row.createdAt) - windowStartMs) / WEEK_MS,
    );
    if (i < 0 || i >= SIGNUP_WEEKS) continue;
    const plan = String(row.subscription?.plan ?? "").toUpperCase();
    if (plan === "INDIVIDUAL") weeks[i].individual += 1;
    else if (plan === "FAMILY") weeks[i].family += 1;
    else if (plan === "PRO") weeks[i].pro += 1;
    else weeks[i].free += 1;
  }
  return weeks;
}

/**
 * Estimated-MRR time series, one point per UTC day for the last
 * REVENUE_WINDOW_DAYS days. There is no payment-ledger table, so the trend
 * is reconstructed from Subscription lifecycle timestamps: a paid sub
 * contributes its plan's monthly price from createdAt until canceledAt.
 * Two bounded queries: a groupBy for the paid-sub baseline at the window
 * start, plus a capped findMany for the in-window create/cancel deltas —
 * the 90-day cap and the 3-field select keep both cheap.
 */
async function getRevenueSeries(
  now: Date,
): Promise<Array<{ date: string; mrr: number; paidSubs: number }>> {
  const todayStartMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const windowStart = new Date(todayStartMs - (REVENUE_WINDOW_DAYS - 1) * DAY_MS);
  const paidPlans = [...PAID_BILLING_PLANS];

  const [baseline, deltas] = await Promise.all([
    // Paid subs alive at the window start: created before it and not yet
    // canceled (or canceled inside the window — they still count at start).
    prisma.subscription.groupBy({
      by: ["plan"],
      where: {
        plan: { in: paidPlans },
        createdAt: { lt: windowStart },
        OR: [{ canceledAt: null }, { canceledAt: { gte: windowStart } }],
      },
      _count: { id: true },
    }),
    // Lifecycle events inside the window. Capped — at current volumes this
    // is tiny; the cap only guards against a pathological backfill.
    prisma.subscription.findMany({
      where: {
        plan: { in: paidPlans },
        OR: [
          { createdAt: { gte: windowStart } },
          { canceledAt: { gte: windowStart } },
        ],
      },
      select: { plan: true, createdAt: true, canceledAt: true },
      take: 5000,
    }),
  ]);

  const priceOf = (plan: string): number =>
    (
      BILLING_PLAN_DEFINITIONS as Record<
        string,
        { monthlyPriceUsd?: number } | undefined
      >
    )[plan]?.monthlyPriceUsd ?? 0;

  let mrr = 0;
  let paidSubs = 0;
  for (const row of baseline) {
    mrr += priceOf(row.plan) * row._count.id;
    paidSubs += row._count.id;
  }

  const deltasByDay = new Map<string, { mrr: number; count: number }>();
  const bump = (key: string, dMrr: number, dCount: number) => {
    const cur = deltasByDay.get(key) ?? { mrr: 0, count: 0 };
    cur.mrr += dMrr;
    cur.count += dCount;
    deltasByDay.set(key, cur);
  };
  for (const sub of deltas) {
    const price = priceOf(sub.plan);
    if (sub.createdAt >= windowStart) bump(dayKey(sub.createdAt), price, 1);
    if (sub.canceledAt && sub.canceledAt >= windowStart) {
      bump(dayKey(sub.canceledAt), -price, -1);
    }
  }

  const series: Array<{ date: string; mrr: number; paidSubs: number }> = [];
  for (let i = 0; i < REVENUE_WINDOW_DAYS; i++) {
    const key = dayKey(new Date(windowStart.getTime() + i * DAY_MS));
    const delta = deltasByDay.get(key);
    if (delta) {
      mrr += delta.mrr;
      paidSubs += delta.count;
    }
    series.push({
      date: key,
      mrr: Math.max(0, Math.round(mrr * 100) / 100),
      paidSubs: Math.max(0, paidSubs),
    });
  }
  return series;
}

/** Tone for the audit feed halo dot — honey strictly means WARN. */
function auditTone(action: string): AuditFeedTone {
  const a = action.toUpperCase();
  if (/DELETE|REMOVE|ERROR|FAIL|DENIED|REJECT|DOWN/.test(a)) return "rose";
  if (/SECURITY|ALERT|SUSPEND|LOGIN|LOCK|MFA|PASSWORD|IMPERSONAT/.test(a)) {
    return "honey";
  }
  if (/CREATE|APPROVE|GRANT|REACTIVATE|RESTORE|MERGE|VERIF/.test(a)) {
    return "sage";
  }
  return "info";
}

/** "PROVIDER_UPDATED" → "provider updated" — feed-friendly verb phrase. */
function humanizeAuditAction(action: string): string {
  return action.toLowerCase().split("_").join(" ");
}

/**
 * Latest admin-audit rows for the dashboard feed — same table the /logs
 * page reads (prisma.adminAuditLog + adminUser join). Caller must gate on
 * audit_logs:canRead with an ADMIN floor, mirroring /logs. Actor emails are
 * always masked and entity ids always shortened here — the dashboard never
 * reveals more than the masked /logs view does.
 */
async function getAuditFeed(): Promise<AuditFeedItem[]> {
  const rows = await prisma.adminAuditLog.findMany({
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      adminUser: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: AUDIT_FEED_COUNT,
  });
  return rows.map((row: any) => ({
    id: row.id,
    actor: row.adminUser?.email ? maskEmail(row.adminUser.email) : "system",
    action: humanizeAuditAction(row.action),
    target: `${row.entityType} · ${maskProviderIdentifier(row.entityId)}`,
    when: row.createdAt.toISOString(),
    tone: auditTone(row.action),
  }));
}

async function getStats() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeSubscriptions,
    activeMovingPlans,
    totalProviders,
    recentUsers,
    newUsersThisWeek,
    newUsersLastWeek,
    upcomingMoves,
    activeSessions,
    totalSessions,
    paidSubsByPlan,
    canceledLast30,
    activeAt30DaysAgo,
    revenueSeries,
    recentSignupDates,
    signupSeries,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
    prisma.movingPlan.count({ where: { status: { in: ["PLANNING", "IN_PROGRESS"] } } }),
    prisma.serviceProvider.count({ where: { isActive: true } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, firstName: true, lastName: true, createdAt: true,
        subscription: { select: { plan: true } },
        // "Moving" flag without a second query — active lifecycle only, so
        // settled/cancelled plans don't light the row up.
        movingPlans: {
          where: { status: { in: ["PLANNING", "IN_PROGRESS"] } },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(sevenDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000), lt: sevenDaysAgo } } }),
    prisma.movingPlan.findMany({
      where: { moveDate: { gte: now, lte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) }, status: { in: ["PLANNING", "IN_PROGRESS"] } },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        fromAddress: { select: { city: true, state: true } },
        toAddress: { select: { city: true, state: true } },
      },
      orderBy: { moveDate: "asc" },
      take: 5,
    }),
    prisma.userSession.count({ where: { isActive: true } }),
    prisma.userSession.count(),
    // Revenue: active subs grouped by plan. Unit price comes from shared
    // BILLING_PLAN_DEFINITIONS, so a price change in one place flows through.
    prisma.subscription.groupBy({
      by: ["plan"],
      where: { status: "ACTIVE" },
      _count: { id: true },
    }),
    // Churn numerator: subs that moved to CANCELED in the last 30 days.
    prisma.subscription.count({
      where: { status: "CANCELED", canceledAt: { gte: thirtyDaysAgo } },
    }),
    // Churn denominator: subs that were ACTIVE at the start of the window.
    // Proxy: created before 30 days ago and not canceled before that point.
    prisma.subscription.count({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        OR: [{ canceledAt: null }, { canceledAt: { gte: thirtyDaysAgo } }],
      },
    }),
    // Daily estimated-MRR series — feeds the revenue trend chart and the
    // MRR / Active Subscriptions KPI sparklines.
    getRevenueSeries(now),
    // Signup timestamps over the spark window — feeds the Total Users
    // sparkline. Single indexed range scan, 1 column, capped.
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      take: 5000,
    }),
    // Weekly signups split by plan tier — feeds the Signups tab of the
    // overview trends chart.
    getSignupsByPlanSeries(now),
  ]);

  const weeklyTrend = newUsersLastWeek > 0
    ? Math.round(((newUsersThisWeek - newUsersLastWeek) / newUsersLastWeek) * 100)
    : newUsersThisWeek > 0 ? 100 : 0;

  const mrrUsd = paidSubsByPlan.reduce((sum: number, row: any) => {
    const def = (BILLING_PLAN_DEFINITIONS as any)[row.plan];
    if (!def?.isPaid) return sum;
    // Treat every paid sub as monthly billing at the monthly price; yearly
    // subs still contribute their amortized monthly revenue this way.
    return sum + def.monthlyPriceUsd * row._count.id;
  }, 0);

  const paidSubCount = paidSubsByPlan.reduce(
    (sum: number, row: any) =>
      (BILLING_PLAN_DEFINITIONS as any)[row.plan]?.isPaid ? sum + row._count.id : sum,
    0,
  );
  const arpuUsd = paidSubCount > 0 ? mrrUsd / paidSubCount : 0;
  const churnPct =
    activeAt30DaysAgo > 0
      ? (canceledLast30 / activeAt30DaysAgo) * 100
      : 0;
  void sixtyDaysAgo; // reserved for future 12-month trend implementation

  // Total-users sparkline: cumulative count per UTC day across the spark
  // window. Walk forward from (totalUsers - signups in window) so the last
  // point always equals today's KPI value; signups that fall just before
  // the first grid day (range vs day-grid skew) fold into the baseline.
  const todayStartMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const gridStartKey = dayKey(
    new Date(todayStartMs - (SPARK_DAYS - 1) * DAY_MS),
  );
  let usersRunning = totalUsers - recentSignupDates.length;
  const signupsByDay = new Map<string, number>();
  for (const row of recentSignupDates) {
    const key = dayKey(row.createdAt);
    if (key < gridStartKey) usersRunning += 1;
    else signupsByDay.set(key, (signupsByDay.get(key) ?? 0) + 1);
  }
  const usersSpark: number[] = [];
  for (let i = 0; i < SPARK_DAYS; i++) {
    const key = dayKey(
      new Date(todayStartMs - (SPARK_DAYS - 1 - i) * DAY_MS),
    );
    usersRunning += signupsByDay.get(key) ?? 0;
    usersSpark.push(usersRunning);
  }

  return {
    totalUsers, activeSubscriptions, activeMovingPlans, totalProviders,
    recentUsers, newUsersThisWeek, weeklyTrend, upcomingMoves,
    activeSessions, totalSessions,
    mrrUsd, arpuUsd, churnPct, paidSubCount,
    revenueSeries, usersSpark, signupSeries,
    // Plan distribution feeds the new "Plan distribution" panel — counts
    // by tier so we can render foil-stamped tier medallions with shares.
    paidSubsByPlan: paidSubsByPlan as Array<{ plan: string; _count: { id: number } }>,
  };
}

export default async function DashboardPage() {
  // The layout already authenticates; re-resolve the permission map here so
  // the audit feed can fail closed for admins without audit_logs:canRead —
  // mirrors the /logs page gate (ADMIN role floor + audit_logs:canRead).
  const ctx = await requirePageAdmin();
  const canReadAuditLogs =
    ADMIN_ROLE_HIERARCHY[ctx.role] >= ADMIN_ROLE_HIERARCHY.ADMIN &&
    ctx.permissions.audit_logs?.canRead === true;
  // Integration statuses reveal which keys are configured (names only,
  // never values) — same gate shape as the audit feed: ADMIN role floor
  // plus the resource read grant the /settings surfaces require.
  const canReadIntegrations =
    ADMIN_ROLE_HIERARCHY[ctx.role] >= ADMIN_ROLE_HIERARCHY.ADMIN &&
    ctx.permissions.settings?.canRead === true;

  const [stats, auditFeed, integrations] = await Promise.all([
    getStats(),
    canReadAuditLogs ? getAuditFeed() : Promise.resolve(null),
    canReadIntegrations ? getIntegrationStatuses() : Promise.resolve(null),
  ]);

  // KPI mini-trends sliced from the same daily series the trend chart uses.
  const sparkWindow = stats.revenueSeries.slice(-SPARK_DAYS);
  const mrrSpark = sparkWindow.map((p) => p.mrr);
  const paidSubsSpark = sparkWindow.map((p) => p.paidSubs);

  const fmtUsd = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  // Cards drive the Aurora glass KPI tiles below. Numeric `value` enables
  // the count-up animation; `formatted` is reserved for currency/percent
  // strings where formatting differs per locale. Icons are rendered here
  // (server) and passed as ReactNode so the function reference never
  // crosses the RSC boundary.
  const kpiCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: <Users className="h-5 w-5" />,
      href: "/users" as const,
      spark: stats.usersSpark,
      // Design's delta pill — wired to the already-computed weekly trend so
      // the Total Users tile carries direction-of-travel like the mock.
      delta: stats.weeklyTrend !== 0 ? `${stats.weeklyTrend > 0 ? "+" : ""}${stats.weeklyTrend}%` : undefined,
      deltaDir: (stats.weeklyTrend >= 0 ? "up" : "down") as "up" | "down",
    },
    { label: "Active Subscriptions", value: stats.activeSubscriptions, icon: <CreditCard className="h-5 w-5" />, href: "/subscriptions" as const, spark: paidSubsSpark, sparkColor: "var(--au-family)" },
    {
      label: "MRR",
      value: stats.mrrUsd,
      formatted: fmtUsd(stats.mrrUsd),
      icon: <DollarSign className="h-5 w-5" />,
      href: "/subscriptions" as const,
      sub: `ARPU ${fmtUsd(stats.arpuUsd)} · ${stats.paidSubCount} paid`,
      spark: mrrSpark,
      sparkColor: "var(--au-accent)",
    },
    {
      label: "Churn (30d)",
      value: stats.churnPct,
      formatted: `${stats.churnPct.toFixed(1)}%`,
      icon: <TrendingDown className="h-5 w-5" />,
      href: "/subscriptions" as const,
      sub: stats.churnPct > 5 ? "Above 5% target" : "Within target",
    },
    { label: "Active Moves", value: stats.activeMovingPlans, icon: <Truck className="h-5 w-5" />, href: "/moving" as const },
    { label: "Providers", value: stats.totalProviders, icon: <Building2 className="h-5 w-5" />, href: "/providers" as const },
  ];

  // Plan distribution rows for the new dashboard panel. We only show the
  // three live tiers — FREE_TRIAL counts are surfaced separately as
  // "trials" and don't need a foil medallion.
  const tierOrder = ["INDIVIDUAL", "FAMILY", "PRO"] as const;
  const tierTotal = stats.paidSubsByPlan.reduce(
    (n: number, row) => n + row._count.id,
    0,
  );
  const tierRows = tierOrder.map((tier) => {
    const row = stats.paidSubsByPlan.find((r) => r.plan === tier);
    const count = row?._count.id ?? 0;
    const share = tierTotal > 0 ? Math.round((count / tierTotal) * 100) : 0;
    const def = BILLING_PLAN_DEFINITIONS[
      tier as keyof typeof BILLING_PLAN_DEFINITIONS
    ] as { displayName?: string; monthlyPriceUsd?: number } | undefined;
    return {
      tier,
      count,
      share,
      label: def?.displayName ?? tier,
      mrr: count * (def?.monthlyPriceUsd ?? 0),
    };
  });
  // Donut/legend tier ramp — Individual cool, Family mint, Pro Sapphire.
  const tierDotColor: Record<(typeof tierOrder)[number], string> = {
    INDIVIDUAL: "var(--au-cool)",
    FAMILY: "var(--au-family)",
    PRO: "var(--au-violet)",
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Overview"
        title="<em>Today's</em> snapshot"
        subtitle="System health, revenue, and the people moving through LocateFlow."
        actions={
          <>
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-center">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                New this week
              </p>
              <div className="mt-0.5 flex items-center justify-center gap-1.5">
                <span className="font-display text-xl font-semibold leading-none text-foreground au-num">{stats.newUsersThisWeek}</span>
                {stats.weeklyTrend !== 0 && (
                  <span className={`font-mono text-xs font-medium ${stats.weeklyTrend > 0 ? "text-tone-sage-fg" : "text-destructive"}`}>
                    {stats.weeklyTrend > 0 ? "+" : ""}{stats.weeklyTrend}%
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-center">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                Active sessions
              </p>
              <div className="mt-0.5 flex items-center justify-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-tone-sage-fg" />
                <span className="font-display text-xl font-semibold leading-none text-foreground au-num">{stats.activeSessions}</span>
              </div>
            </div>
          </>
        }
      />

      {/* KPI Cards — Aurora glass tiles with count-up + cursor-tracking
          reflex highlight. Same data, same hrefs. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((card) => (
          <AuroraStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            formatted={card.formatted}
            sub={card.sub}
            spark={card.spark}
            sparkColor={card.sparkColor}
            delta={card.delta}
            deltaDir={card.deltaDir}
            icon={card.icon}
            href={card.href}
          />
        ))}
      </div>

      {/* Live ops — design's "needs attention now" rail. Same three
          operational routes, hrefs, icons and real counts as before; restyled
          to the mock's icon-tile + title/sub + trailing arrow rhythm. */}
      <AdminPanel title="Live ops" caption="Frequent operational routes">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: "Add Provider", desc: "New service provider", href: "/providers/new", icon: Building2, color: "text-tone-umber-fg" },
            { label: "User Analytics", desc: `${stats.totalSessions} sessions`, href: "/analytics", icon: BarChart3, color: "text-tone-slate-fg" },
            { label: "Upcoming Moves", desc: `${stats.upcomingMoves.length} in 2 weeks`, href: "/moving", icon: Truck, color: "text-tone-rose-fg" },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-background/45 px-3 py-3 transition hover:border-primary/25 hover:bg-accent/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] border border-border bg-card">
                <action.icon className={`h-4 w-4 ${action.color}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-foreground">{action.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{action.desc}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </AdminPanel>

      {/* Overview trends — two-tab chart card. "Revenue" keeps the daily
          estimated-MRR series with crosshair hover and 7D/30D/QTR range
          control; "Signups" adds weekly new users split by plan tier. Both
          series ship once; tab/range switches never refetch. */}
      <OverviewTrendsCard
        revenue={stats.revenueSeries.map((p) => ({ date: p.date, value: p.mrr }))}
        signups={stats.signupSeries}
      />

      {/* System Health */}
      <HealthCard />

      {/* Plan distribution — foil-stamped tier breakdown of paying users */}
      <AdminPanel
        title="Plan distribution"
        caption={`${tierTotal.toLocaleString()} paying ${tierTotal === 1 ? "user" : "users"}`}
        flagship
      >
        {tierTotal === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No paying users yet — once people upgrade, they show up here grouped by tier.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Donut — tier share at a glance, total paying in the center.
                Per-tier detail (counts, MRR, medallions) stays below. */}
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <PlanDonut
                total={tierTotal}
                segments={tierRows.map((row) => ({
                  tier: row.tier,
                  label: row.label,
                  count: row.count,
                }))}
              />
              <div className="w-full min-w-0 flex-1 space-y-2">
                {tierRows.map((row) => (
                  <div
                    key={row.tier}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tierDotColor[row.tier] }}
                    />
                    <span className="min-w-0 truncate text-foreground">
                      {row.label}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground au-num">
                      {row.count.toLocaleString()}
                    </span>
                    <span className="w-9 shrink-0 text-right text-xs font-medium text-foreground au-num">
                      {row.share}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="tier-bar">
              {tierRows.map((row) => (
                <div
                  key={row.tier}
                  className={`tier-bar-seg-${row.tier.toLowerCase()}`}
                  style={{ width: `${row.share}%` }}
                  title={`${row.label}: ${row.share}%`}
                />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {tierRows.map((row) => (
                <div
                  key={row.tier}
                  className="flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.02] p-3"
                >
                  <TierMedallion tier={row.tier} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.count.toLocaleString()} {row.count === 1 ? "user" : "users"}
                      {tierTotal > 0 ? ` · ${row.share}%` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="text-sm font-semibold text-foreground"
                      style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400 }}
                    >
                      {fmtUsd(row.mrr)}
                    </p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                      MRR
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AdminPanel>

      {/* Two-column layout — Recent Users + Upcoming Moves */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminPanel
          title="Recent users"
          caption="Latest 5 sign-ups"
          actions={
            <Link href="/users" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          }
        >
          <div className="space-y-2.5">
            {stats.recentUsers.map((user: any) => {
              const planRaw = String(user.subscription?.plan || "").toUpperCase();
              const plan = planRaw.includes("FAMILY")
                ? { label: "Family", color: "#83AAF5" }
                : planRaw.includes("PRO")
                  ? { label: "Pro", color: "#5B8DEF" }
                  : planRaw.includes("INDIVIDUAL")
                    ? { label: "Individual", color: "#5B8DEF" }
                    : planRaw
                      ? { label: "Free", color: "#8A94A6" }
                      : null;
              const moving = (user.movingPlans?.length || 0) > 0;
              // Initials avatar (design motif) — derived from existing name
              // fields only; no extra data fetch.
              const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "?";
              return (
                <Link key={user.id} href={`/users/${user.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 hover:bg-accent/30 transition-colors">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-primary">
                      {initials}
                    </span>
                    <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground text-sm truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      {moving && (
                        <span
                          className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                          style={{ color: "#5B8DEF", backgroundColor: "rgba(91, 141, 239,0.12)", borderColor: "rgba(91, 141, 239,0.28)" }}
                        >
                          <span className="h-1 w-1 rounded-full" style={{ backgroundColor: "#5B8DEF" }} />
                          Moving
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{maskEmail(user.email)}</p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    {plan && (
                      <span
                        className="rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                        style={{ color: plan.color, backgroundColor: plan.color + "1f", borderColor: plan.color + "47" }}
                      >
                        {plan.label}
                      </span>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              );
            })}
            {stats.recentUsers.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No users yet</p>
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          title="Upcoming moves"
          caption="Next 14 days"
          actions={
            <Link href="/moving" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          }
        >
          <div className="space-y-2.5">
            {stats.upcomingMoves.map((move: any) => {
              const days = Math.ceil((new Date(move.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div key={move.id} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <MapPin className="h-3 w-3 text-tone-rose-fg" />
                    <span className="text-foreground font-medium truncate">{move.fromAddress?.city}, {move.fromAddress?.state}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                    <MapPin className="h-3 w-3 text-tone-sage-fg" />
                    <span className="text-foreground font-medium truncate">{move.toAddress?.city}, {move.toAddress?.state}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] text-muted-foreground truncate">{maskEmail(move.user?.email)}</span>
                    <span className={`font-mono text-[11px] font-medium au-num ${days <= 3 ? "text-destructive" : days <= 7 ? "text-tone-honey-fg" : "text-muted-foreground"}`}>
                      {days}d left
                    </span>
                  </div>
                </div>
              );
            })}
            {stats.upcomingMoves.length === 0 && (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <Calendar className="mb-2 h-6 w-6" />
                <p className="text-xs">No upcoming moves</p>
              </div>
            )}
          </div>
        </AdminPanel>
      </div>

      {/* External integrations — configuration presence per connector,
          straight from the same builder the /settings API uses. Status is
          configured-or-not only: we do not measure uptime or latency, so
          none is shown. ADMIN floor + settings:canRead, mirroring the
          audit feed gate below. */}
      {integrations && (
        <AdminPanel
          title="External integrations"
          caption={`${integrations.filter((i) => i.configured).length} of ${integrations.length} configured · status reflects key presence only`}
          dense
        >
          <div className="grid gap-x-8 sm:grid-cols-2">
            {[
              integrations.slice(0, Math.ceil(integrations.length / 2)),
              integrations.slice(Math.ceil(integrations.length / 2)),
            ].map((column, columnIndex) => (
              <div key={columnIndex}>
                {column.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
                  >
                    <p className="min-w-0 truncate text-sm text-foreground">
                      {item.label}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {!item.configured && (
                        <span className="text-[11px] text-muted-foreground au-num">
                          {item.missingKeys.length}{" "}
                          {item.missingKeys.length === 1 ? "key" : "keys"} missing
                        </span>
                      )}
                      <span
                        className={`au-pill ${item.configured ? "mint" : "amber"}`}
                      >
                        {item.configured ? "Ready" : "Needs config"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-border pt-3 text-right">
            <Link href="/settings" className="text-xs text-primary hover:underline">
              Configure →
            </Link>
          </div>
        </AdminPanel>
      )}

      {/* Audit feed — latest admin/system actions; rendered only for admins
          who clear the same gate as /logs (ADMIN floor + audit_logs:canRead). */}
      {auditFeed && (
        <AdminPanel
          title="Audit log"
          caption="Latest administrator and system actions"
          dense
          actions={
            <Link href="/logs" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          }
        >
          <AuditFeed items={auditFeed} />
        </AdminPanel>
      )}
    </div>
  );
}

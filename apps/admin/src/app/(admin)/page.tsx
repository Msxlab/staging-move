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
import { BILLING_PLAN_DEFINITIONS } from "@locateflow/shared";
import Link from "next/link";
import { HealthCard } from "./health-card";
import { maskEmail } from "@/lib/privacy";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPanel } from "@/components/admin-panel";
import { TierMedallion } from "@/components/premium/tier-medallion";

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
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
    prisma.movingPlan.count({ where: { status: { in: ["PLANNING", "IN_PROGRESS"] } } }),
    prisma.serviceProvider.count({ where: { isActive: true } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
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

  return {
    totalUsers, activeSubscriptions, activeMovingPlans, totalProviders,
    recentUsers, newUsersThisWeek, weeklyTrend, upcomingMoves,
    activeSessions, totalSessions,
    mrrUsd, arpuUsd, churnPct, paidSubCount,
    // Plan distribution feeds the new "Plan distribution" panel — counts
    // by tier so we can render foil-stamped tier medallions with shares.
    paidSubsByPlan: paidSubsByPlan as Array<{ plan: string; _count: { id: number } }>,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const fmtUsd = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const kpiCards = [
    { label: "Total Users", value: stats.totalUsers.toLocaleString(), icon: Users, color: "text-tone-slate-fg", bg: "bg-tone-slate-bg", href: "/users" },
    { label: "Active Subscriptions", value: stats.activeSubscriptions.toLocaleString(), icon: CreditCard, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg", href: "/subscriptions" },
    { label: "MRR", value: fmtUsd(stats.mrrUsd), icon: DollarSign, color: "text-tone-honey-fg", bg: "bg-tone-honey-bg", href: "/subscriptions", sub: `ARPU ${fmtUsd(stats.arpuUsd)} · ${stats.paidSubCount} paid` },
    { label: "Churn (30d)", value: `${stats.churnPct.toFixed(1)}%`, icon: TrendingDown, color: stats.churnPct > 5 ? "text-destructive" : "text-tone-honey-fg", bg: stats.churnPct > 5 ? "bg-destructive/10" : "bg-tone-honey-bg", href: "/subscriptions", sub: stats.churnPct > 5 ? "Above 5% target" : "Within target" },
    { label: "Active Moves", value: stats.activeMovingPlans.toLocaleString(), icon: Truck, color: "text-tone-rose-fg", bg: "bg-tone-rose-bg", href: "/moving" },
    { label: "Providers", value: stats.totalProviders.toLocaleString(), icon: Building2, color: "text-tone-umber-fg", bg: "bg-tone-umber-bg", href: "/providers" },
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
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-lg font-semibold text-foreground">{stats.newUsersThisWeek}</span>
                {stats.weeklyTrend !== 0 && (
                  <span className={`text-xs font-medium ${stats.weeklyTrend > 0 ? "text-tone-sage-fg" : "text-destructive"}`}>
                    {stats.weeklyTrend > 0 ? "+" : ""}{stats.weeklyTrend}%
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-center">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                Active sessions
              </p>
              <div className="flex items-center justify-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-tone-sage-fg" />
                <span className="text-lg font-semibold text-foreground">{stats.activeSessions}</span>
              </div>
            </div>
          </>
        }
      />

      {/* KPI Cards — same data, foil hairline + Fraunces-set values */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((card) => (
          <Link key={card.label} href={card.href}
            className="kpi-foil rounded-2xl border border-border bg-card p-5 block">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="kpi-label">{card.label}</p>
                <p className="kpi-value mt-2 text-foreground truncate">{card.value}</p>
                {card.sub ? (
                  <p className="mt-1 text-[11px] text-muted-foreground truncate">{card.sub}</p>
                ) : null}
              </div>
              <div className={`rounded-lg p-2.5 ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Add Provider", desc: "New service provider", href: "/providers/new", icon: Building2, color: "text-tone-umber-fg" },
          { label: "User Analytics", desc: `${stats.totalSessions} sessions`, href: "/analytics", icon: BarChart3, color: "text-tone-slate-fg" },
          { label: "Upcoming Moves", desc: `${stats.upcomingMoves.length} in 2 weeks`, href: "/moving", icon: Truck, color: "text-tone-rose-fg" },
        ].map((action) => (
          <Link key={action.label} href={action.href}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/20">
            <div className="rounded-lg bg-muted p-2.5">
              <action.icon className={`h-5 w-5 ${action.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

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
            {stats.recentUsers.map((user: any) => (
              <Link key={user.id} href={`/users/${user.id}`} className="flex items-center justify-between rounded-lg border border-border p-2.5 hover:bg-accent/30 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{maskEmail(user.email)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground flex-shrink-0">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
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
                    <span className={`text-[11px] font-medium ${days <= 3 ? "text-destructive" : days <= 7 ? "text-tone-honey-fg" : "text-muted-foreground"}`}>
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
    </div>
  );
}

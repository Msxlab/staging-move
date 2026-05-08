"use client";

import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, Users, CreditCard, AlertTriangle, ArrowUpRight, ArrowDownRight, Clock, Smartphone, ShieldAlert, Store } from "lucide-react";
import { toast } from "sonner";
import { maskEmail } from "@/lib/privacy";

interface BillingData {
  mrr: number;
  arr: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  churnRate: number;
  lastMonthChurn: number;
  newSubsThisMonth: number;
  newSubsLastMonth: number;
  avgRevenuePerUser: number;
  ltv: number;
  planDistribution: Record<string, { total: number; active: number; revenue: number }>;
  statusDistribution: Record<string, number>;
  providerDistribution: Record<string, number>;
  platformDistribution: Record<string, number>;
  mobileOps: {
    totalSubscriptions: number;
    activeSubscriptions: number;
    staleValidationCount: number;
    missingReceiptIdentifierCount: number;
    neverValidatedCount: number;
    pendingValidationCount: number;
    appStoreSubscriptions: number;
    playStoreSubscriptions: number;
  };
  staleMobileSubscriptions: Array<{
    id: string;
    user?: { email?: string | null } | null;
    provider?: string | null;
    platform?: string | null;
    plan?: string | null;
    status?: string | null;
    lastValidatedAt?: string | null;
    lastSyncedAt?: string | null;
    missingReceiptIdentifier?: boolean;
  }>;
  trialExpiring: any[];
  recentCancellations: any[];
  dailyRevenue: Record<string, number>;
}

export default function BillingClient() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load billing data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading billing data...</div>;
  if (!data) return <div className="text-center py-20 text-muted-foreground">Failed to load data</div>;

  const churnTrend = data.lastMonthChurn > 0 ? ((data.churnRate - data.lastMonthChurn) / data.lastMonthChurn) * 100 : 0;
  const subGrowth = data.newSubsLastMonth > 0 ? ((data.newSubsThisMonth - data.newSubsLastMonth) / data.newSubsLastMonth) * 100 : 0;

  const kpis = [
    { label: "MRR", value: `$${data.mrr.toLocaleString()}`, icon: DollarSign, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg" },
    { label: "ARR", value: `$${data.arr.toLocaleString()}`, icon: TrendingUp, color: "text-tone-sky-fg", bg: "bg-tone-sky-bg" },
    { label: "Active Subs", value: data.activeSubscriptions.toLocaleString(), icon: Users, color: "text-tone-foil-fg", bg: "bg-tone-foil-bg", sub: `of ${data.totalSubscriptions} total` },
    { label: "Churn Rate", value: `${data.churnRate}%`, icon: data.churnRate > data.lastMonthChurn ? TrendingDown : TrendingUp, color: data.churnRate > 5 ? "text-destructive" : "text-tone-sage-fg", bg: data.churnRate > 5 ? "bg-destructive/10" : "bg-tone-sage-bg", sub: `Last month: ${data.lastMonthChurn}%` },
    { label: "ARPU", value: `$${data.avgRevenuePerUser}`, icon: CreditCard, color: "text-tone-cyan-fg", bg: "bg-tone-cyan-bg" },
    { label: "LTV", value: data.ltv > 0 ? `$${data.ltv.toLocaleString()}` : "N/A", icon: DollarSign, color: "text-tone-orange-fg", bg: "bg-tone-orange-bg" },
    { label: "New This Month", value: data.newSubsThisMonth.toString(), icon: ArrowUpRight, color: "text-tone-emerald-fg", bg: "bg-tone-emerald-bg", sub: subGrowth !== 0 ? `${subGrowth > 0 ? "+" : ""}${Math.round(subGrowth)}% vs last month` : undefined },
    { label: "Trials Expiring", value: data.trialExpiring.length.toString(), icon: Clock, color: "text-tone-honey-fg", bg: "bg-tone-honey-bg", sub: "Within 7 days" },
  ];

  const planColors: Record<string, string> = { FREE_TRIAL: "bg-tone-slate-fg", INDIVIDUAL: "bg-tone-sky-fg", FAMILY: "bg-tone-orange-fg", STARTER: "bg-tone-sky-fg", PRO: "bg-tone-foil-fg", PREMIUM: "bg-tone-orange-fg", ENTERPRISE: "bg-destructive" };
  const totalActive = data.activeSubscriptions || 1;
  const totalByProvider = Object.values(data.providerDistribution).reduce((sum, value) => sum + value, 0) || 1;
  const totalByPlatform = Object.values(data.platformDistribution).reduce((sum, value) => sum + value, 0) || 1;

  const revenueValues = Object.values(data.dailyRevenue);
  const maxRevenue = Math.max(...revenueValues, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing & Revenue</h1>
        <p className="mt-1 text-muted-foreground">Financial overview and subscription analytics</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
                {(k as any).sub && <p className="mt-0.5 text-xs text-muted-foreground">{(k as any).sub}</p>}
              </div>
              <div className={`rounded-lg p-2.5 ${k.bg}`}><k.icon className={`h-5 w-5 ${k.color}`} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily Revenue Trend */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Daily Revenue (30 days)</h2>
          <div className="flex items-end gap-0.5 h-40">
            {Object.entries(data.dailyRevenue).map(([date, value]) => (
              <div key={date} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-8 hidden group-hover:block bg-popover border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap z-10">
                  {date}: ${value.toFixed(2)}
                </div>
                <div className="w-full bg-primary/60 rounded-t transition-all hover:bg-primary" style={{ height: `${(value / maxRevenue) * 100}%`, minHeight: "2px" }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{Object.keys(data.dailyRevenue)[0]}</span>
            <span>{Object.keys(data.dailyRevenue).slice(-1)[0]}</span>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Plan Distribution</h2>
          <div className="space-y-3">
            {Object.entries(data.planDistribution).sort((a, b) => b[1].revenue - a[1].revenue).map(([plan, info]) => {
              const pct = Math.round((info.active / totalActive) * 100);
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${planColors[plan] || "bg-tone-slate-fg"}`} />
                      <span className="text-sm font-medium text-foreground">{plan}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{info.active} active</span>
                      <span className="font-medium text-foreground">${info.revenue.toFixed(2)}/mo</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${planColors[plan] || "bg-tone-slate-fg"} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Mobile Store Subs</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{data.mobileOps.totalSubscriptions}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{data.mobileOps.activeSubscriptions} active</p>
            </div>
            <div className="rounded-lg bg-tone-sky-bg p-2.5"><Smartphone className="h-5 w-5 text-tone-sky-fg" /></div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{data.mobileOps.appStoreSubscriptions} App Store</span>
            <span>·</span>
            <span>{data.mobileOps.playStoreSubscriptions} Play Store</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Stale Validations</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{data.mobileOps.staleValidationCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{data.mobileOps.neverValidatedCount} never validated</p>
            </div>
            <div className="rounded-lg bg-tone-honey-bg p-2.5"><Clock className="h-5 w-5 text-tone-honey-fg" /></div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Subscriptions older than 24h should be covered by the mobile billing revalidation cron.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Store Metadata Gaps</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{data.mobileOps.missingReceiptIdentifierCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{data.mobileOps.pendingValidationCount} pending or unknown</p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-2.5"><ShieldAlert className="h-5 w-5 text-destructive" /></div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Missing tokens or transaction IDs block automated store revalidation.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trials Expiring Soon */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-tone-honey-fg" /> Trials Expiring (7 days)
          </h2>
          {data.trialExpiring.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No trials expiring soon</p>
          ) : (
            <div className="space-y-2">
              {data.trialExpiring.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{maskEmail(s.user?.email)}</p>
                    <p className="text-xs text-muted-foreground">{s.plan}</p>
                  </div>
                  <span className={`text-xs font-medium ${s.daysLeft <= 2 ? "text-destructive" : "text-tone-honey-fg"}`}>{s.daysLeft}d left</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Cancellations */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-destructive" /> Recent Cancellations
          </h2>
          {data.recentCancellations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent cancellations</p>
          ) : (
            <div className="space-y-2">
              {data.recentCancellations.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{maskEmail(s.user?.email)}</p>
                    <p className="text-xs text-muted-foreground">{s.plan}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{s.canceledAt ? new Date(s.canceledAt).toLocaleDateString() : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
            <Store className="h-4 w-4 text-tone-sky-fg" /> Billing Provider Distribution
          </h2>
          <div className="space-y-3">
            {Object.entries(data.providerDistribution).sort((a, b) => b[1] - a[1]).map(([provider, count]) => {
              const pct = Math.round((count / totalByProvider) * 100);
              return (
                <div key={provider}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{provider}</span>
                    <span className="text-xs text-muted-foreground">{count} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platform Distribution</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(data.platformDistribution).sort((a, b) => b[1] - a[1]).map(([platform, count]) => {
                const pct = Math.round((count / totalByPlatform) * 100);
                return (
                  <div key={platform} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{platform}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{count} subscriptions · {pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-tone-honey-fg" /> Stale Mobile Validations
          </h2>
          {data.staleMobileSubscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No stale mobile subscriptions detected.</p>
          ) : (
            <div className="space-y-3">
              {data.staleMobileSubscriptions.map((subscription) => (
                <div key={subscription.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{subscription.user?.email ? maskEmail(subscription.user.email) : "Unknown user"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{subscription.provider || "UNKNOWN"} · {subscription.platform || "unassigned"} · {subscription.plan || "Unknown plan"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${subscription.missingReceiptIdentifier ? "bg-destructive/10 text-destructive" : "bg-tone-honey-bg text-tone-honey-fg"}`}>
                      {subscription.missingReceiptIdentifier ? "Missing receipt" : subscription.status || "UNKNOWN"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <p>Last validated</p>
                      <p className="mt-1 font-medium text-foreground">{subscription.lastValidatedAt ? new Date(subscription.lastValidatedAt).toLocaleString() : "Never"}</p>
                    </div>
                    <div>
                      <p>Last synced</p>
                      <p className="mt-1 font-medium text-foreground">{subscription.lastSyncedAt ? new Date(subscription.lastSyncedAt).toLocaleString() : "Never"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Subscription Status Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(data.statusDistribution).map(([status, count]) => {
            const colors: Record<string, string> = { ACTIVE: "text-tone-sage-fg bg-tone-sage-bg", TRIALING: "text-tone-sky-fg bg-tone-sky-bg", CANCELED: "text-destructive bg-destructive/10", PAST_DUE: "text-tone-honey-fg bg-tone-honey-bg" };
            const c = colors[status] || "text-muted-foreground bg-tone-slate-bg";
            return (
              <div key={status} className={`rounded-lg p-4 ${c.split(" ")[1]}`}>
                <p className={`text-2xl font-bold ${c.split(" ")[0]}`}>{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{status}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

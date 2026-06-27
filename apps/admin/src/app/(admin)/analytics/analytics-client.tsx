"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Monitor, Smartphone, Tablet, BarChart3,
  TrendingUp, TrendingDown, Eye, Clock, Activity, Minus,
  Truck, MapPin, ArrowRight, Timer, Filter, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { SpendingByRegionWidget } from "@/components/spending-by-region-widget";
import { EmailHealthWidget } from "@/components/email-health-widget";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AuroraDonut } from "@/components/aurora";

interface AnalyticsData {
  activeUsers: { total: number; today: number; week: number; month: number };
  browsers: [string, number][];
  operatingSystems: [string, number][];
  devices: [string, number][];
  platforms: [string, number][];
  regions: [string, number][];
  dailyRegistrations: Record<string, number>;
  popularPages: { page: string; views: number }[];
  recentSessions: any[];
  totalSessions: number;
  totalEvents: number;
}

interface Kpi { value: number; previous: number; delta: number | null }

interface OverviewData {
  window: { range: string; start: string; end: string; days: number };
  filters: { plan: string | null; platform: string | null; region: string | null };
  regionOptions: string[];
  kpis: { activeUsers: Kpi; sessions: Kpi; newUsers: Kpi; events: Kpi };
  registrations: Record<string, number>;
  platforms: [string, number][];
  devices: [string, number][];
  regions: [string, number][];
  planMix: { plan: string; count: number }[];
  moveAnalytics: {
    totalMoves: number;
    topPairs: { from: string; to: string; count: number }[];
    topOrigins: { state: string; count: number }[];
    topDestinations: { state: string; count: number }[];
    interstate: number;
    intrastate: number;
    interstatePct: number;
    intrastatePct: number;
    avgLeadTimeDays: number | null;
  };
}

const DEVICE_ICONS: Record<string, any> = {
  Desktop: Monitor, Mobile: Smartphone, Tablet: Tablet,
};

const OS_COLORS: Record<string, string> = {
  Windows: "bg-tone-sky-fg", macOS: "bg-tone-slate-fg", Android: "bg-tone-sage-fg",
  iOS: "bg-muted-foreground", Linux: "bg-tone-orange-fg", ChromeOS: "bg-tone-honey-fg", Unknown: "bg-tone-slate-fg",
};

const BROWSER_COLORS: Record<string, string> = {
  Chrome: "bg-tone-sage-fg", Safari: "bg-tone-sky-fg", Firefox: "bg-tone-orange-fg",
  Edge: "bg-tone-foil-fg", Opera: "bg-destructive", Unknown: "bg-tone-slate-fg",
};

const RANGE_OPTIONS: { id: string; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "custom", label: "Custom" },
];

const PLAN_OPTIONS: { id: string; label: string }[] = [
  { id: "FREE_TRIAL", label: "Free Access" },
  { id: "INDIVIDUAL", label: "Individual" },
  { id: "FAMILY", label: "Family" },
  { id: "PRO", label: "Pro" },
];

const PLATFORM_OPTIONS: { id: string; label: string }[] = [
  { id: "WEB", label: "Web" },
  { id: "IOS_APP", label: "iOS App" },
  { id: "ANDROID_APP", label: "Android App" },
  { id: "PWA", label: "PWA" },
];

function planLabel(plan: string) {
  return PLAN_OPTIONS.find((p) => p.id === plan)?.label || plan;
}

function BarChart({ data, colorMap, maxItems = 6 }: { data: [string, number][]; colorMap?: Record<string, string>; maxItems?: number }) {
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map(([, v]) => v), 1);
  const total = items.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-3">
      {items.map(([label, value]) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        const barPct = Math.round((value / max) * 100);
        const color = colorMap?.[label] || "bg-primary";
        return (
          <div key={label}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-foreground">{label}</span>
              <span className="font-mono text-muted-foreground">{value} · {pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${barPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SparkLine({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) return <p className="text-center text-sm text-muted-foreground py-4">No data</p>;

  const values = entries.map(([, v]) => v);
  const max = Math.max(...values, 1);
  const width = 100;
  const height = 40;
  const points = values.map((v, i) => `${(i / (values.length - 1 || 1)) * width},${height - (v / max) * height}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none" role="img" aria-label="New registrations trend">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary au-sparkpath" />
        <polyline points={`0,${height} ${points} ${width},${height}`} fill="currentColor" className="text-primary/10" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{entries[0]?.[0]?.slice(5)}</span>
        <span>{entries[entries.length - 1]?.[0]?.slice(5)}</span>
      </div>
    </div>
  );
}

/** KPI card with "vs previous period" delta badge. */
function KpiCard({ label, kpi, icon: Icon }: { label: string; kpi: Kpi; icon: any }) {
  const delta = kpi.delta;
  const up = delta !== null && delta > 0;
  const down = delta !== null && delta < 0;
  const DeltaIcon = up ? TrendingUp : down ? TrendingDown : Minus;
  const deltaColor = up ? "text-tone-sage-fg" : down ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-[18px] border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-1.5 font-display text-[28px] font-extrabold tabular-nums text-foreground">{kpi.value.toLocaleString()}</p>
      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
        <span className={`inline-flex items-center gap-0.5 font-mono font-medium ${deltaColor}`}>
          <DeltaIcon className="h-3.5 w-3.5" />
          {delta === null ? "new" : `${delta > 0 ? "+" : ""}${delta}%`}
        </span>
        <span className="text-muted-foreground">vs prev ({kpi.previous.toLocaleString()})</span>
      </div>
    </div>
  );
}

export default function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionDetails, setSessionDetails] = useState(false);

  // Global date-range + segmentation state.
  const [range, setRange] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [plan, setPlan] = useState("");
  const [platform, setPlatform] = useState("");
  const [region, setRegion] = useState("");

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Static, all-time widgets (audience breakdown, spending, recent sessions).
  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  // Date-range + segmentation aware overview.
  const loadOverview = useCallback(() => {
    setOverviewLoading(true);
    const params = new URLSearchParams({ range });
    if (range === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    if (plan) params.set("plan", plan);
    if (platform) params.set("platform", platform);
    if (region) params.set("region", region);

    fetch(`/api/analytics/overview?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error);
        setOverview(d);
      })
      .catch(() => toast.error("Failed to load overview"))
      .finally(() => setOverviewLoading(false));
  }, [range, customFrom, customTo, plan, platform, region]);

  useEffect(() => {
    // For non-custom ranges fetch immediately. For custom, wait for both dates.
    if (range === "custom" && (!customFrom || !customTo)) {
      setOverviewLoading(false);
      return;
    }
    loadOverview();
  }, [loadOverview, range, customFrom, customTo]);

  const hasFilters = Boolean(plan || platform || region);
  const clearFilters = () => { setPlan(""); setPlatform(""); setRegion(""); };

  const regionOptions = overview?.regionOptions || [];

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading analytics...</div>;
  if (!data) return <div className="py-20 text-center text-muted-foreground">Failed to load</div>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Insights"
        title="<em>Analytics</em>"
        subtitle="User behavior, devices, platforms, and engagement metrics"
        actions={
          <>
            <a href="/analytics/intelligence" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <TrendingUp className="h-4 w-4" /> Activity Intelligence
            </a>
          </>
        }
      />

      {/* ── Global date-range + segmentation control bar ───────── */}
      <div className="rounded-[18px] border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date range pills */}
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === opt.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {range === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                aria-label="From date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                aria-label="To date"
              />
            </div>
          )}

          {overview && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {new Date(overview.window.start).toLocaleDateString()} –{" "}
              {new Date(overview.window.end).toLocaleDateString()} · {overview.window.days}d window
            </span>
          )}
        </div>

        {/* Segmentation filters */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Segment
          </span>

          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            aria-label="Filter by plan"
          >
            <option value="">All plans</option>
            {PLAN_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            aria-label="Filter by platform"
          >
            <option value="">All platforms</option>
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            aria-label="Filter by region"
          >
            <option value="">All regions</option>
            {region && !regionOptions.includes(region) && (
              <option value={region}>{region}</option>
            )}
            {regionOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}

          {overviewLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* ── KPIs with vs-previous-period deltas ────────────────── */}
      {overview && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Active Users" kpi={overview.kpis.activeUsers} icon={Users} />
          <KpiCard label="New Users" kpi={overview.kpis.newUsers} icon={TrendingUp} />
          <KpiCard label="Sessions" kpi={overview.kpis.sessions} icon={Eye} />
          <KpiCard label="Events" kpi={overview.kpis.events} icon={Activity} />
        </div>
      )}

      {/* All-time totals (context) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Users (all-time)", value: data.activeUsers.total, icon: Users, color: "text-foreground", note: "All accounts ever created" },
          { label: "Active Today", value: data.activeUsers.today, icon: Activity, color: "text-tone-sage-fg", note: "Seen in the last 24 hours" },
          { label: "This Week", value: data.activeUsers.week, icon: TrendingUp, color: "text-tone-sky-fg", note: "Active in the last 7 days" },
          { label: "This Month", value: data.activeUsers.month, icon: BarChart3, color: "text-tone-foil-fg", note: "Active in the last 30 days" },
        ].map((s) => (
          <div key={s.label} className="rounded-[18px] border border-border bg-card p-[18px]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`mt-1.5 font-display text-[28px] font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.note}</p>
          </div>
        ))}
      </div>

      {/* Registration Trend (within window) */}
      <div className="rounded-[18px] border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">
          New Registrations {overview ? `(last ${overview.window.days}d)` : ""}
        </h2>
        {overview ? (
          <SparkLine data={overview.registrations} />
        ) : (
          <SparkLine data={data.dailyRegistrations} />
        )}
      </div>

      {/* ── MOVE ANALYTICS ─────────────────────────────────────── */}
      {overview && (
        <div className="rounded-[18px] border border-border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-tone-orange-fg" /> Move Analytics
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {overview.moveAnalytics.totalMoves.toLocaleString()} moves in window
            </span>
          </div>

          {overview.moveAnalytics.totalMoves === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No moving plans scheduled in this window.
            </p>
          ) : (
            <>
              {/* Headline move metrics */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                    <ArrowRight className="h-3.5 w-3.5" /> Interstate vs Intrastate
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-foreground">
                    {overview.moveAnalytics.interstatePct}% / {overview.moveAnalytics.intrastatePct}%
                  </p>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-tone-sky-fg" style={{ width: `${overview.moveAnalytics.interstatePct}%` }} />
                    <div className="h-full bg-tone-sage-fg" style={{ width: `${overview.moveAnalytics.intrastatePct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {overview.moveAnalytics.interstate} cross-state · {overview.moveAnalytics.intrastate} in-state
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" /> Avg Move Lead Time
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-foreground">
                    {overview.moveAnalytics.avgLeadTimeDays === null
                      ? "—"
                      : `${overview.moveAnalytics.avgLeadTimeDays} days`}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    From plan creation to move date
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> Distinct State Pairs
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-foreground">
                    {overview.moveAnalytics.topPairs.length >= 10 ? "10+" : overview.moveAnalytics.topPairs.length}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Top origin → destination routes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Top origin → destination state pairs */}
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Top Routes (origin → destination)
                  </p>
                  <div className="space-y-2">
                    {overview.moveAnalytics.topPairs.map((p) => {
                      const max = overview.moveAnalytics.topPairs[0]?.count || 1;
                      const barPct = Math.round((p.count / max) * 100);
                      return (
                        <div key={`${p.from}-${p.to}`}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                              <span className="font-mono">{p.from}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">{p.to}</span>
                              {p.from === p.to && (
                                <span className="rounded-full bg-tone-sage-bg px-1.5 py-0.5 text-[9px] font-medium text-tone-sage-fg">
                                  in-state
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground">{p.count}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top origins / destinations */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Top Origins
                    </p>
                    {overview.moveAnalytics.topOrigins.length > 0 ? (
                      <BarChart data={overview.moveAnalytics.topOrigins.map((o) => [o.state, o.count])} maxItems={8} />
                    ) : (
                      <p className="text-xs text-muted-foreground">No data</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Top Destinations
                    </p>
                    {overview.moveAnalytics.topDestinations.length > 0 ? (
                      <BarChart data={overview.moveAnalytics.topDestinations.map((d) => [d.state, d.count])} maxItems={8} />
                    ) : (
                      <p className="text-xs text-muted-foreground">No data</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Segmented breakdown (within window) ────────────────── */}
      {overview && (
        <div className="rounded-[18px] border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground mb-5">
            Segmented Breakdown {overview.filters.plan ? `· ${planLabel(overview.filters.plan)}` : ""}
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform (window)</p>
              {overview.platforms.length > 0 ? (
                <AuroraDonut data={overview.platforms} />
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No session data in window.</p>
              )}
            </div>
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Plan Mix</p>
              {overview.planMix.length > 0 ? (
                <AuroraDonut data={overview.planMix.map((p) => [planLabel(p.plan), p.count])} />
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No subscriptions.</p>
              )}
            </div>
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Device Type (window)</p>
              {overview.devices.length > 0 ? (
                <BarChart data={overview.devices} maxItems={4} />
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No data</p>
              )}
            </div>
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Region (window)</p>
              {overview.regions.length > 0 ? (
                <BarChart data={overview.regions} maxItems={8} />
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No location data in window</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Spending Aggregate */}
      <SpendingByRegionWidget />

      {/* Email Pipeline Health */}
      <EmailHealthWidget />

      {/* Audience Breakdown — Platform / Device / OS / Browser grouped under one card (all-time) */}
      <div className="rounded-[18px] border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-foreground mb-5">Audience Breakdown <span className="text-xs font-normal text-muted-foreground">(all-time)</span></h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Platform */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform</p>
            {data.platforms.length > 0 ? (
              <AuroraDonut data={data.platforms} />
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No session data yet. Enable tracking in web app.</p>
            )}
          </div>

          {/* Device Type */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Device Type</p>
            {data.devices.length > 0 ? (
              <div className="flex justify-center gap-6">
                {data.devices.slice(0, 3).map(([label, value]) => {
                  const Icon = DEVICE_ICONS[label] || Monitor;
                  const total = data.devices.reduce((s, [, v]) => s + v, 0);
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <div key={label} className="text-center">
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-[14px] bg-muted">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-display text-lg font-extrabold tabular-nums text-foreground">{pct}%</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No data yet</p>
            )}
          </div>

          {/* OS */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Operating System</p>
            <BarChart data={data.operatingSystems} colorMap={OS_COLORS} />
          </div>

          {/* Browser */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Browser</p>
            <BarChart data={data.browsers} colorMap={BROWSER_COLORS} />
          </div>
        </div>
      </div>

      {/* Geography */}
      <div className="rounded-[18px] border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">Top Regions <span className="text-xs font-normal text-muted-foreground">(all-time)</span></h2>
        {data.regions.length > 0 ? (
          <BarChart data={data.regions} maxItems={8} />
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">No location data yet</p>
        )}
      </div>

      {/* Popular Pages */}
      {data.popularPages.length > 0 && (
        <div className="rounded-[18px] border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">Popular Pages</h2>
          <div className="space-y-2">
            {data.popularPages.map((p, i) => (
              <div key={p.page} className="flex items-center gap-3 rounded-[12px] border border-border bg-muted/30 px-4 py-2.5">
                <span className="font-mono text-xs font-bold text-muted-foreground w-6">#{i + 1}</span>
                <span className="flex-1 text-sm font-medium text-foreground font-mono">{p.page}</span>
                <span className="font-mono text-sm text-muted-foreground">{p.views} views</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions — Browser/OS hidden by default since they live in the
          Audience Breakdown charts above; toggle reveals them on demand. */}
      {data.recentSessions.length > 0 && (
        <div className="rounded-[18px] border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-foreground">Recent Sessions</h2>
            <button
              type="button"
              onClick={() => setSessionDetails((v) => !v)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              {sessionDetails ? "Hide browser / OS" : "Show browser / OS"}
            </button>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">User</th>
                  {sessionDetails && <th className="px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Browser</th>}
                  {sessionDetails && <th className="px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">OS</th>}
                  <th className="px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Device</th>
                  <th className="px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Platform</th>
                  <th className="px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Location</th>
                  <th className="px-3 py-2.5 text-center text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Pages</th>
                  <th className="px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentSessions.map((s: any) => (
                  <tr key={s.id} className="hover:bg-accent/30">
                    <td className="px-3 py-2 text-sm text-foreground">
                      {s.userId ? (
                        <a href={`/users/${s.userId}`} className="inline-flex items-center gap-2 text-primary hover:underline">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold">
                            {s.initials || "?"}
                          </span>
                          <span className="font-mono text-xs">{s.userId.slice(0, 8)}…</span>
                        </a>
                      ) : "—"}
                    </td>
                    {sessionDetails && <td className="px-3 py-2 text-xs text-muted-foreground">{s.browser || "—"}</td>}
                    {sessionDetails && <td className="px-3 py-2 text-xs text-muted-foreground">{s.os || "—"}</td>}
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        s.deviceType === "Mobile" ? "bg-tone-sage-bg text-tone-sage-fg" :
                        s.deviceType === "Tablet" ? "bg-tone-foil-bg text-tone-foil-fg" :
                        "bg-tone-sky-bg text-tone-sky-fg"
                      }`}>{s.deviceType || "Desktop"}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{s.platform || "WEB"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.city && s.region ? `${s.city}, ${s.region}` : s.country || "—"}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs font-medium text-foreground">{s.pageViews}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{new Date(s.sessionStart).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

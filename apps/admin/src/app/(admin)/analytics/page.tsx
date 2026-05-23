"use client";

import { useState, useEffect } from "react";
import {
  Users, Monitor, Smartphone, Tablet, BarChart3,
  TrendingUp, Eye, Clock, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { SpendingByRegionWidget } from "@/components/spending-by-region-widget";
import { EmailHealthWidget } from "@/components/email-health-widget";

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

function BarChart({ data, colorMap, maxItems = 6 }: { data: [string, number][]; colorMap?: Record<string, string>; maxItems?: number }) {
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map(([, v]) => v), 1);
  const total = items.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-2.5">
      {items.map(([label, value]) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        const barPct = Math.round((value / max) * 100);
        const color = colorMap?.[label] || "bg-primary";
        return (
          <div key={label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-foreground font-medium">{label}</span>
              <span className="text-muted-foreground">{value} ({pct}%)</span>
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

function DonutChart({ data, colorMap }: { data: [string, number][]; colorMap?: Record<string, string> }) {
  const total = data.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return <p className="text-center text-sm text-muted-foreground py-8">No data</p>;

  let offset = 0;
  const segments = data.map(([label, value]) => {
    const pct = (value / total) * 100;
    const seg = { label, value, pct, offset };
    offset += pct;
    return seg;
  });

  // Aurora-friendly categorical palette — cool / mint / honey / coral / violet
  // / sky / rose / slate. Resolved at render so theme switching repaints.
  const colors = [
    "var(--au-cool)", "var(--au-mint)", "var(--au-amber)", "var(--au-coral)",
    "var(--au-violet)", "var(--au-cool-2)", "var(--au-rose)", "var(--au-ink-3)",
  ];

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          {segments.map((seg, i) => (
            <circle key={seg.label} cx="18" cy="18" r="14" fill="none" stroke={colors[i % colors.length]}
              strokeWidth="4" strokeDasharray={`${seg.pct * 0.88} ${88 - seg.pct * 0.88}`}
              strokeDashoffset={`${-seg.offset * 0.88}`} />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-foreground">{total}</span>
        </div>
      </div>
      <div className="space-y-1.5 flex-1">
        {segments.map((seg, i) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-foreground flex-1">{seg.label}</span>
            <span className="text-muted-foreground">{seg.value} ({Math.round(seg.pct)}%)</span>
          </div>
        ))}
      </div>
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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
        <polyline points={`0,${height} ${points} ${width},${height}`} fill="currentColor" className="text-primary/10" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{entries[0]?.[0]?.slice(5)}</span>
        <span>{entries[entries.length - 1]?.[0]?.slice(5)}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionDetails, setSessionDetails] = useState(false);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading analytics...</div>;
  if (!data) return <div className="py-20 text-center text-muted-foreground">Failed to load</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-muted-foreground">User behavior, devices, platforms, and engagement metrics</p>
        </div>
        <a href="/analytics/intelligence" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <TrendingUp className="h-4 w-4" /> Activity Intelligence
        </a>
      </div>

      {/* Active Users */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: data.activeUsers.total, icon: Users, color: "text-foreground", bg: "bg-card" },
          { label: "Active Today", value: data.activeUsers.today, icon: Activity, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg" },
          { label: "This Week", value: data.activeUsers.week, icon: TrendingUp, color: "text-tone-sky-fg", bg: "bg-tone-sky-bg" },
          { label: "This Month", value: data.activeUsers.month, icon: BarChart3, color: "text-tone-foil-fg", bg: "bg-tone-foil-bg" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-border ${s.bg} p-5`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`mt-2 text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground">Total Sessions</p>
            <Eye className="h-4 w-4 text-tone-cyan-fg" />
          </div>
          <p className="text-2xl font-bold text-foreground">{data.totalSessions}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground">Total Events</p>
            <Clock className="h-4 w-4 text-tone-orange-fg" />
          </div>
          <p className="text-2xl font-bold text-foreground">{data.totalEvents}</p>
        </div>
      </div>

      {/* Registration Trend */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">User Registrations (Last 30 Days)</h2>
        <SparkLine data={data.dailyRegistrations} />
      </div>

      {/* User Spending Aggregate */}
      <SpendingByRegionWidget />

      {/* Email Pipeline Health */}
      <EmailHealthWidget />

      {/* Audience Breakdown — Platform / Device / OS / Browser grouped under one card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-5">Audience Breakdown</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Platform */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Platform</p>
            {data.platforms.length > 0 ? (
              <DonutChart data={data.platforms} />
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
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-bold text-foreground">{pct}%</p>
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
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Top Regions</h2>
        {data.regions.length > 0 ? (
          <BarChart data={data.regions} maxItems={8} />
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">No location data yet</p>
        )}
      </div>

      {/* Popular Pages */}
      {data.popularPages.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Popular Pages</h2>
          <div className="space-y-2">
            {data.popularPages.map((p, i) => (
              <div key={p.page} className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-bold text-muted-foreground w-6">#{i + 1}</span>
                <span className="flex-1 text-sm font-medium text-foreground font-mono">{p.page}</span>
                <span className="text-sm text-muted-foreground">{p.views} views</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions — Browser/OS hidden by default since they live in the
          Audience Breakdown charts above; toggle reveals them on demand. */}
      {data.recentSessions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Sessions</h2>
            <button
              type="button"
              onClick={() => setSessionDetails((v) => !v)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              {sessionDetails ? "Hide browser / OS" : "Show browser / OS"}
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">User</th>
                  {sessionDetails && <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Browser</th>}
                  {sessionDetails && <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">OS</th>}
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Device</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Platform</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Location</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Pages</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Started</th>
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
                    <td className="px-3 py-2 text-center text-xs font-medium text-foreground">{s.pageViews}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(s.sessionStart).toLocaleString()}</td>
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

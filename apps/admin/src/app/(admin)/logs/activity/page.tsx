"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Users, Activity, BarChart3, Shield,
  AlertTriangle, Clock, TrendingUp,
} from "lucide-react";

export default function AdminActivityPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/admin-activity")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <div className="py-12 text-center text-muted-foreground">Failed to load</div>;

  const { perAdmin, actionTypes, entityTypes, dailyActivity, stats, criticalActions } = data;
  const maxDaily = Math.max(...(dailyActivity || []).map((d: any) => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/logs" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Activity Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Per-admin actions, action types, and activity trends</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Total (All Time)</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats?.totalAll?.toLocaleString() || 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Last 30 Days</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats?.total30d?.toLocaleString() || 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Last 7 Days</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats?.total7d?.toLocaleString() || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per-Admin Leaderboard */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Admin Leaderboard (30d)
          </h2>
          {(!perAdmin || perAdmin.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-4">No activity</p>
          ) : (
            <div className="space-y-3">
              {perAdmin.slice(0, 10).map((item: any, i: number) => {
                const maxActions = perAdmin[0]?.actions || 1;
                const pct = Math.round((item.actions / maxActions) * 100);
                return (
                  <div key={item.admin.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.admin.firstName} {item.admin.lastName}</p>
                          <p className="text-[10px] text-muted-foreground">{item.admin.email} Â· {item.admin.role}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground">{item.actions}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden ml-7">
                      <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Types */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-tone-honey-fg" /> Action Types (30d)
          </h2>
          {(!actionTypes || actionTypes.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-4">No data</p>
          ) : (
            <div className="space-y-2">
              {actionTypes.slice(0, 12).map((a: any) => {
                const maxCount = actionTypes[0]?.count || 1;
                const pct = Math.round((a.count / maxCount) * 100);
                const isDangerous = ["DELETE", "MFA_DISABLED", "SESSION_REVOKE_ALL", "RESTORE", "IMPORT"].includes(a.action);
                return (
                  <div key={a.action} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm font-mono ${isDangerous ? "text-destructive font-medium" : "text-foreground"}`}>{a.action}</span>
                        <span className="text-xs text-muted-foreground">{a.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isDangerous ? "bg-destructive/60" : "bg-tone-honey-bg"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Entity Types */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-tone-emerald-fg" /> Entity Types (30d)
          </h2>
          {(!entityTypes || entityTypes.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-4">No data</p>
          ) : (
            <div className="space-y-2">
              {entityTypes.map((e: any) => {
                const maxCount = entityTypes[0]?.count || 1;
                const pct = Math.round((e.count / maxCount) * 100);
                return (
                  <div key={e.entity} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm text-foreground">{e.entity}</span>
                        <span className="text-xs text-muted-foreground">{e.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-tone-emerald-bg transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily Activity Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-tone-sky-fg" /> Daily Admin Activity (30d)
          </h2>
          {(!dailyActivity || dailyActivity.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          ) : (
            <div className="flex items-end gap-[2px] h-32">
              {dailyActivity.map((d: any) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div className="w-full rounded-t bg-tone-sky-bg hover:bg-tone-sky-fg transition-all min-h-[2px]"
                    style={{ height: `${Math.max((d.count / maxDaily) * 100, 2)}%` }} />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap shadow-lg z-10">
                    {d.date}: {d.count} actions
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Critical Actions */}
      {criticalActions && criticalActions.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Critical Actions (30d)
          </h2>
          <div className="space-y-2">
            {criticalActions.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-card/80 p-3 border border-border">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">{c.action}</span>
                  <div>
                    <p className="text-sm text-foreground">{c.entityType} Â· {c.entityId}</p>
                    {c.admin && <p className="text-[10px] text-muted-foreground">{c.admin.firstName} {c.admin.lastName}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</p>
                  {c.ipAddress && <p className="text-[10px] text-muted-foreground">{c.ipAddress}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Loader2, TrendingUp, TrendingDown, Users, Zap,
  AlertTriangle, Smartphone, Monitor, BarChart3, Activity,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";

export default function ActivityIntelligenceClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/activity-intelligence")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <div className="py-12 text-center text-muted-foreground">Failed to load data</div>;

  const { funnel, engagement, churn, platforms, topEvents, dau } = data;
  const maxDau = Math.max(...(dau || []).map((d: any) => d.count), 1);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Insights"
        title="User Activity <em>Intelligence</em>"
        subtitle="Onboarding funnel, engagement scoring, churn risk, and behavior insights"
        actions={
          <>
            <Link href="/analytics" aria-label="Back to analytics" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Onboarding Funnel */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Onboarding Funnel
          </h2>
          <div className="space-y-3">
            {(funnel || []).map((step: any, i: number) => {
              const prevPct = i > 0 ? funnel[i - 1].pct : 100;
              const dropoff = prevPct - step.pct;
              return (
                <div key={step.step}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{step.step}</span>
                      {i > 0 && dropoff > 0 && (
                        <span className="text-[10px] text-destructive">-{dropoff}%</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{step.count.toLocaleString()}</span>
                      <span className="text-xs font-medium text-foreground">{step.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${step.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Engagement Scoring */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-tone-honey-fg" /> Engagement Distribution
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Based on sessions + events in the last 30 days</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "High", value: engagement?.high || 0, color: "bg-tone-sage-fg", desc: "30+ activity score" },
              { label: "Medium", value: engagement?.medium || 0, color: "bg-tone-sky-fg", desc: "10-29 activity score" },
              { label: "Low", value: engagement?.low || 0, color: "bg-tone-honey-fg", desc: "1-9 activity score" },
              { label: "None", value: engagement?.none || 0, color: "bg-destructive", desc: "No activity" },
            ].map((seg) => (
              <div key={seg.label} className="rounded-lg bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />
                  <span className="text-sm font-medium text-foreground">{seg.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{seg.value.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{seg.desc}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {engagement?.total > 0 ? Math.round((seg.value / engagement.total) * 100) : 0}% of users
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Churn Risk */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Churn Risk
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4">
              <p className="text-xs font-medium text-destructive uppercase">At Risk</p>
              <p className="text-3xl font-bold text-foreground mt-1">{churn?.atRisk || 0}</p>
              <p className="text-xs text-muted-foreground">No activity in 14+ days</p>
            </div>
            <div className="rounded-lg bg-tone-honey-bg border border-tone-honey-br p-4">
              <p className="text-xs font-medium text-tone-honey-fg uppercase">Trial Expiring</p>
              <p className="text-3xl font-bold text-foreground mt-1">{churn?.trialExpiringSoon || 0}</p>
              <p className="text-xs text-muted-foreground">Within 3 days</p>
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Retention Rate (7d+ users)</span>
              <span className="text-sm font-bold text-foreground">{churn?.activeRate || 0}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
              <div className="h-full rounded-full bg-tone-sage-fg transition-all" style={{ width: `${churn?.activeRate || 0}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{churn?.oldUsers || 0} users signed up 7+ days ago</p>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-tone-sky-fg" /> Platform Usage (30d)
          </h2>
          <div className="space-y-3">
            {(platforms || []).map((p: any) => {
              const total = platforms.reduce((s: number, x: any) => s + x.count, 0);
              const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
              const Icon = p.platform === "MOBILE" ? Smartphone : Monitor;
              const color = p.platform === "MOBILE" ? "bg-tone-sky-fg" : p.platform === "PWA" ? "bg-tone-foil-fg" : "bg-tone-emerald-fg";
              return (
                <div key={p.platform} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{p.platform}</span>
                      <span className="text-xs text-muted-foreground">{p.count.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {(!platforms || platforms.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No session data yet</p>
            )}
          </div>
        </div>

        {/* Top Events */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Top Events (30d)
          </h2>
          {(!topEvents || topEvents.length === 0) ? (
            <div className="text-center py-8">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No events tracked yet</p>
              <p className="text-xs text-muted-foreground mt-1">Events will appear here once users interact with the app</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topEvents.map((e: any, i: number) => {
                const maxCount = topEvents[0]?.count || 1;
                const pct = Math.round((e.count / maxCount) * 100);
                return (
                  <div key={e.event} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium text-foreground font-mono">{e.event}</span>
                        <span className="text-xs text-muted-foreground">{e.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily Active Users */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-tone-emerald-fg" /> Daily Active Users (30d)
          </h2>
          {(!dau || dau.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">No DAU data yet</p>
          ) : (
            <div className="flex items-end gap-[2px] h-32">
              {dau.map((d: any) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div className="w-full rounded-t bg-primary/60 hover:bg-primary transition-all min-h-[2px]"
                    style={{ height: `${Math.max((d.count / maxDau) * 100, 2)}%` }} />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap shadow-lg z-10">
                    {d.date}: {d.count} users
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

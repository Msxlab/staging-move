"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Users,
  Truck,
  FileText,
  CreditCard,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin-page-header";

interface Metric {
  label: string;
  current: number;
  previous: number;
  change: number;
}
interface ReportData {
  dateRange: { start: string; end: string };
  metrics: Metric[];
  dailyUsers: Record<string, number>;
  movingByStatus: { status: string; count: number }[];
  topProviders: { name: string; popularityScore: number }[];
  topStates: { state: string; count: number }[];
}

export default function ReportsClient() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [preset, setPreset] = useState("30d");

  const applyPreset = (p: string) => {
    setPreset(p);
    const now = new Date();
    const e = now.toISOString().split("T")[0];
    let s: Date;
    switch (p) {
      case "7d":
        s = new Date(now.getTime() - 7 * 86400000);
        break;
      case "30d":
        s = new Date(now.getTime() - 30 * 86400000);
        break;
      case "90d":
        s = new Date(now.getTime() - 90 * 86400000);
        break;
      case "1y":
        s = new Date(now.getTime() - 365 * 86400000);
        break;
      default:
        return;
    }
    setStartDate(s.toISOString().split("T")[0]);
    setEndDate(e);
  };

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/reports?startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.metrics) {
          setData(d);
        } else {
          setData(null);
          toast.error(d.error || "Failed to load report");
        }
      })
      .catch(() => {
        setData(null);
        toast.error("Failed to load report");
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [["Metric", "Current Period", "Previous Period", "Change %"]];
    data.metrics.forEach((m) =>
      rows.push([
        m.label,
        m.current.toString(),
        m.previous.toString(),
        `${m.change}%`,
      ]),
    );
    rows.push([]);
    rows.push(["Top Providers", "Popularity Score"]);
    data.topProviders.forEach((p) =>
      rows.push([p.name, p.popularityScore.toString()]),
    );
    rows.push([]);
    rows.push(["Top States", "Count"]);
    data.topStates.forEach((s) => rows.push([s.state, s.count.toString()]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  const metricIcons: Record<string, any> = {
    "New Users": Users,
    "New Subscriptions": CreditCard,
    "Moving Plans": Truck,
    Documents: FileText,
    "Active Providers": Building2,
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Insights"
        title="<em>Reports</em>"
        subtitle="Custom date range analytics with period comparison"
        actions={
          <Button onClick={exportCSV} disabled={!data} leftIcon={<Download />}>Export CSV</Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
          {["7d", "30d", "90d", "1y"].map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${preset === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p === "7d"
                ? "7 Days"
                : p === "30d"
                  ? "30 Days"
                  : p === "90d"
                    ? "90 Days"
                    : "1 Year"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPreset("");
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPreset("");
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 font-mono text-sm text-muted-foreground">
          Loading report...
        </div>
      ) : !data ? (
        <div className="text-center py-20 font-mono text-sm text-muted-foreground">
          Failed to load
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {data.metrics.map((m) => {
              const Icon = metricIcons[m.label] || PieChart;
              return (
                <div
                  key={m.label}
                  className="rounded-2xl border border-border bg-card p-[18px]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {m.label}
                    </p>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-1.5 font-display text-[28px] font-extrabold text-foreground">
                    {m.current.toLocaleString()}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    {m.change !== 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 font-mono font-medium ${m.change > 0 ? "text-tone-sage-fg" : "text-destructive"}`}
                      >
                        {m.change > 0 ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        {m.change > 0 ? "+" : ""}
                        {m.change}%
                      </span>
                    )}
                    <span className="font-mono text-muted-foreground">
                      vs prev ({m.previous.toLocaleString()})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Daily User Registrations
              </p>
              <div className="flex items-end gap-0.5 h-32">
                {Object.entries(data.dailyUsers).length === 0 ? (
                  <p className="w-full text-center font-mono text-sm text-muted-foreground py-8">
                    No data
                  </p>
                ) : (
                  Object.entries(data.dailyUsers).map(([date, count]) => {
                    const max = Math.max(...Object.values(data.dailyUsers), 1);
                    return (
                      <button
                        key={date}
                        type="button"
                        aria-label={`${date}: ${count} registrations`}
                        className="group relative flex h-full flex-1 items-end appearance-none bg-transparent p-0"
                      >
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block group-focus:block bg-card border border-border rounded px-1.5 py-0.5 font-mono text-[9px] text-foreground whitespace-nowrap z-10">
                          {date}: {count}
                        </div>
                        <div
                          className="w-full bg-tone-sky-bg rounded-t group-hover:bg-tone-sky-fg group-focus:bg-tone-sky-fg"
                          style={{
                            height: `${(count / max) * 100}%`,
                            minHeight: "2px",
                          }}
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Moving Plans by Status
              </p>
              <div className="space-y-2">
                {data.movingByStatus.length === 0 ? (
                  <p className="font-mono text-sm text-muted-foreground text-center py-8">No data</p>
                ) : (
                  data.movingByStatus.map((m) => {
                    const colors: Record<string, string> = {
                      PLANNING: "bg-tone-sky-fg", IN_PROGRESS: "bg-tone-honey-fg",
                      COMPLETED: "bg-tone-sage-fg", CANCELED: "bg-destructive",
                    };
                    const total = data.movingByStatus.reduce((s, x) => s + x.count, 0) || 1;
                    return (
                      <div key={m.status} className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${colors[m.status] || "bg-tone-slate-fg"}`} />
                        <span className="text-sm text-foreground flex-1">{m.status}</span>
                        <span className="font-mono text-sm font-medium text-foreground">{m.count}</span>
                        <span className="font-mono text-xs text-muted-foreground w-10 text-right">
                          {Math.round((m.count / total) * 100)}%
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Top Providers by Popularity
              </p>
              <div className="space-y-2">
                {data.topProviders.slice(0, 7).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground w-4">{i + 1}</span>
                    <span className="text-sm text-foreground flex-1 truncate">{p.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">score: {p.popularityScore}</span>
                  </div>
                ))}
                {data.topProviders.length === 0 && (
                  <p className="font-mono text-sm text-muted-foreground text-center py-2">No data</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Top States
              </p>
              <div className="space-y-2">
                {data.topStates.slice(0, 7).map((s, i) => {
                  const max = data.topStates[0]?.count || 1;
                  return (
                    <div key={s.state}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm text-foreground">
                          {s.state}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {s.count}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-tone-cyan-fg rounded-full"
                          style={{ width: `${(s.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {data.topStates.length === 0 && (
                  <p className="font-mono text-sm text-muted-foreground text-center py-2">
                    No data
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

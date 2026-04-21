"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Users,
  MessageSquare,
  Truck,
  FileText,
  CreditCard,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

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
  dailyReviews: Record<string, number>;
  reviewsByStatus: { status: string; count: number }[];
  movingByStatus: { status: string; count: number }[];
  topProviders: { name: string; reviews: number; avgRating: number | null }[];
  topStates: { state: string; count: number }[];
}

export default function ReportsPage() {
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
    rows.push(["Top Providers", "Reviews", "Avg Rating"]);
    data.topProviders.forEach((p) =>
      rows.push([
        p.name,
        p.reviews.toString(),
        p.avgRating?.toString() || "N/A",
      ]),
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
    Reviews: MessageSquare,
    "Moving Plans": Truck,
    Documents: FileText,
    "Active Providers": Building2,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="mt-1 text-muted-foreground">
            Custom date range analytics with period comparison
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={!data}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {["7d", "30d", "90d", "1y"].map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition ${preset === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
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
        <div className="flex items-center gap-2 ml-auto">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPreset("");
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPreset("");
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">
          Loading report...
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-muted-foreground">
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
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">{m.label}</p>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {m.current.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      vs prev: {m.previous}
                    </span>
                    {m.change !== 0 && (
                      <span
                        className={`flex items-center gap-0.5 text-xs font-medium ${m.change > 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {m.change > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {m.change > 0 ? "+" : ""}
                        {m.change}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Daily User Registrations
              </h2>
              <div className="flex items-end gap-0.5 h-32">
                {Object.entries(data.dailyUsers).length === 0 ? (
                  <p className="w-full text-center text-sm text-muted-foreground py-8">
                    No data
                  </p>
                ) : (
                  Object.entries(data.dailyUsers).map(([date, count]) => {
                    const max = Math.max(...Object.values(data.dailyUsers), 1);
                    return (
                      <div key={date} className="flex-1 group relative">
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border border-border rounded px-1.5 py-0.5 text-[9px] text-foreground whitespace-nowrap z-10">
                          {date}: {count}
                        </div>
                        <div
                          className="w-full bg-blue-500/60 rounded-t hover:bg-blue-500"
                          style={{
                            height: `${(count / max) * 100}%`,
                            minHeight: "2px",
                          }}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Daily Reviews
              </h2>
              <div className="flex items-end gap-0.5 h-32">
                {Object.entries(data.dailyReviews).length === 0 ? (
                  <p className="w-full text-center text-sm text-muted-foreground py-8">
                    No data
                  </p>
                ) : (
                  Object.entries(data.dailyReviews).map(([date, count]) => {
                    const max = Math.max(
                      ...Object.values(data.dailyReviews),
                      1,
                    );
                    return (
                      <div key={date} className="flex-1 group relative">
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border border-border rounded px-1.5 py-0.5 text-[9px] text-foreground whitespace-nowrap z-10">
                          {date}: {count}
                        </div>
                        <div
                          className="w-full bg-purple-500/60 rounded-t hover:bg-purple-500"
                          style={{
                            height: `${(count / max) * 100}%`,
                            minHeight: "2px",
                          }}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Reviews by Status
              </h2>
              <div className="space-y-2">
                {data.reviewsByStatus.map((r) => {
                  const colors: Record<string, string> = {
                    APPROVED: "bg-green-500",
                    PENDING: "bg-yellow-500",
                    REJECTED: "bg-red-500",
                    AI_FLAGGED: "bg-orange-500",
                  };
                  const total =
                    data.reviewsByStatus.reduce((s, x) => s + x.count, 0) || 1;
                  return (
                    <div key={r.status} className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${colors[r.status] || "bg-gray-500"}`}
                      />
                      <span className="text-sm text-foreground flex-1">
                        {r.status}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {r.count}
                      </span>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {Math.round((r.count / total) * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Top Providers
              </h2>
              <div className="space-y-2">
                {data.topProviders.slice(0, 7).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">
                      {i + 1}
                    </span>
                    <span className="text-sm text-foreground flex-1 truncate">
                      {p.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.reviews} reviews
                    </span>
                    {p.avgRating && (
                      <span className="text-xs text-yellow-500">
                        ★{p.avgRating}
                      </span>
                    )}
                  </div>
                ))}
                {data.topProviders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No data
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Top States
              </h2>
              <div className="space-y-2">
                {data.topStates.slice(0, 7).map((s, i) => {
                  const max = data.topStates[0]?.count || 1;
                  return (
                    <div key={s.state}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm text-foreground">
                          {s.state}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.count}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${(s.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {data.topStates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
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

"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw } from "lucide-react";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latencyMs?: number;
  details?: string;
}

interface HealthResponse {
  overall: "healthy" | "degraded" | "down";
  checks: HealthCheck[];
  timestamp: string;
  environment?: string;
}

const STATUS_STYLE: Record<HealthCheck["status"], { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  healthy: { bg: "bg-green-500/10", text: "text-green-500", icon: CheckCircle2 },
  degraded: { bg: "bg-amber-500/10", text: "text-amber-500", icon: AlertTriangle },
  down: { bg: "bg-red-500/10", text: "text-red-500", icon: XCircle },
  unknown: { bg: "bg-muted", text: "text-muted-foreground", icon: HelpCircle },
};

export function HealthCard() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setRefreshing(true);
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load health status");
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const overallStyle = data ? STATUS_STYLE[data.overall] : STATUS_STYLE.unknown;
  const OverallIcon = overallStyle.icon;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">System Health</h2>
          {data && (
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${overallStyle.bg} ${overallStyle.text}`}>
              <OverallIcon className="h-3 w-3" />
              {data.overall}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {refreshing && <RefreshCw className="h-3 w-3 animate-spin" />}
          {data && <span>Updated {new Date(data.timestamp).toLocaleTimeString()}</span>}
        </div>
      </div>

      {error && !data && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.checks.map((check) => {
            const style = STATUS_STYLE[check.status];
            const Icon = style.icon;
            return (
              <div key={check.name} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <div className="min-w-0 flex items-center gap-2">
                  <Icon className={`h-4 w-4 shrink-0 ${style.text}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{check.name}</p>
                    {check.details && (
                      <p className="text-[11px] text-muted-foreground truncate">{check.details}</p>
                    )}
                  </div>
                </div>
                {typeof check.latencyMs === "number" && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{check.latencyMs}ms</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!data && !error && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg border border-border/60 bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}

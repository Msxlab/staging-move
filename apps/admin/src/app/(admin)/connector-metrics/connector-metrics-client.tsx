"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";
import { summarizeConnectorMetrics, type ConnectorMetricSummary } from "@/lib/connector-metrics";

export default function ConnectorMetricsClient() {
  const [summaries, setSummaries] = useState<ConnectorMetricSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    fetch("/api/connectors")
      .then((r) => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((d) => setSummaries(summarizeConnectorMetrics(d.dispatchByConnector || {})))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Connectors"
        title="Dispatch metrics"
        subtitle="Per-connector dispatch health. Live rows only — SHADOW dry-runs are excluded. Confirm rate = confirmed ÷ terminal outcomes (confirmed + needs-user + failed)."
      />

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading dispatch metrics…</div>
      ) : error ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-foreground">Couldn&apos;t load connector metrics.</p>
          <button
            onClick={load}
            className="mt-4 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Retry
          </button>
        </div>
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No dispatches yet"
          description="Per-connector health appears here once a connector is enabled and users trigger address changes."
          className="rounded-2xl border border-dashed border-border"
        />
      ) : (
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-border">
          <table className="w-full min-w-[640px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Connector</th>
                <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Confirm rate</th>
                <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Confirmed</th>
                <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Needs user</th>
                <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Failed</th>
                <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">In flight</th>
                <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summaries.map((s) => {
                const inFlight = s.queued + s.dispatching + s.submitted;
                const rate = s.confirmRate === null ? "—" : `${Math.round(s.confirmRate * 100)}%`;
                const rateCls =
                  s.confirmRate === null
                    ? "text-muted-foreground"
                    : s.confirmRate >= 0.9
                      ? "text-tone-sage-fg"
                      : s.confirmRate >= 0.6
                        ? "text-tone-honey-fg"
                        : "text-tone-rose-fg";
                const dotCls =
                  s.confirmRate === null
                    ? "bg-muted-foreground"
                    : s.confirmRate >= 0.9
                      ? "bg-tone-sage-fg"
                      : s.confirmRate >= 0.6
                        ? "bg-tone-honey-fg"
                        : "bg-tone-rose-fg";
                return (
                  <tr key={s.connectorKey} className="bg-card transition-colors hover:bg-accent/50">
                    <td className="px-4 py-3 text-left font-mono text-xs text-foreground">{s.connectorKey}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`inline-flex items-center gap-1.5 font-mono text-sm font-semibold ${rateCls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
                        {rate}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-foreground">{s.confirmed}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-muted-foreground">{s.needsUser}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-muted-foreground">{s.failed}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-muted-foreground">{inFlight}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-foreground">{s.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

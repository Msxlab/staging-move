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
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <div className="rounded-lg border border-foreground/10 p-6 text-center">
          <p className="text-sm text-foreground">Couldn&apos;t load connector metrics.</p>
          <button
            onClick={load}
            className="mt-3 rounded-md border border-foreground/10 px-3 py-1.5 text-sm text-foreground hover:bg-muted/30"
          >
            Retry
          </button>
        </div>
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No dispatches yet"
          description="Per-connector health appears here once a connector is enabled and users trigger address changes."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-foreground/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Connector</th>
                <th className="px-3 py-2 text-right font-medium">Confirm rate</th>
                <th className="px-3 py-2 text-right font-medium">Confirmed</th>
                <th className="px-3 py-2 text-right font-medium">Needs user</th>
                <th className="px-3 py-2 text-right font-medium">Failed</th>
                <th className="px-3 py-2 text-right font-medium">In flight</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
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
                return (
                  <tr key={s.connectorKey} className="border-b border-foreground/10 last:border-b-0">
                    <td className="px-4 py-2.5 text-left font-mono text-xs text-foreground">{s.connectorKey}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${rateCls}`}>{rate}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{s.confirmed}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{s.needsUser}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{s.failed}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{inFlight}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{s.total}</td>
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";

interface TemplateRow {
  templateId: string | null;
  slug: string | null;
  name: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  bounced: number;
}

interface FailureRow {
  message: string;
  count: number;
}

interface HealthResponse {
  windowHours: number;
  since: string;
  total: number;
  statusCounts: Record<string, number>;
  byTemplate: TemplateRow[];
  topFailures: FailureRow[];
}

export function EmailHealthWidget() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email-health")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => setData(d as HealthResponse))
      .catch((e: any) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Email health unavailable: {error}
      </div>
    );
  }

  if (!data) return null;

  const sent = data.statusCounts.SENT || 0;
  const failed = data.statusCounts.FAILED || 0;
  const pending = data.statusCounts.PENDING || 0;
  const bounced = data.statusCounts.BOUNCED || 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Email pipeline health (last {data.windowHours}h)
          </h2>
        </div>
        <Link href="/email-templates" className="text-xs text-muted-foreground hover:text-foreground">
          View logs →
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat icon={CheckCircle2} label="Sent" value={sent} color="text-green-500" />
        <Stat icon={AlertTriangle} label="Failed" value={failed} color="text-red-500" />
        <Stat icon={Clock} label="Pending" value={pending} color="text-amber-500" />
        <Stat icon={AlertTriangle} label="Bounced" value={bounced} color="text-orange-500" />
      </div>

      {data.byTemplate.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">By template</p>
          <div className="space-y-1.5">
            {data.byTemplate.slice(0, 8).map((row) => {
              const failureRate = row.total > 0 ? Math.round(((row.failed + row.bounced) / row.total) * 100) : 0;
              return (
                <div
                  key={row.templateId ?? row.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{row.name}</p>
                    {row.slug && <p className="text-xs text-muted-foreground font-mono">{row.slug}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{row.total}</span>
                    {(row.failed + row.bounced) > 0 && (
                      <span className={failureRate >= 25 ? "text-red-500" : "text-amber-500"}>
                        {failureRate}% fail
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.topFailures.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Top failure messages</p>
          <ul className="space-y-1">
            {data.topFailures.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-red-500 shrink-0">×{f.count}</span>
                <span className="break-all">{f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.total === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No emails sent in the last {data.windowHours} hours.
        </p>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

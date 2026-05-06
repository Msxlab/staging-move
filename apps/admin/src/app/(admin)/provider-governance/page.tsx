"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Link2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const QUEUE_LABELS: Record<string, string> = {
  providerQuality: "Provider Quality Queue",
  coverageGap: "Coverage Gap Queue",
  duplicateReview: "Duplicate Review Queue",
  missingContact: "Missing Contact Queue",
  broadCoverage: "Broad Coverage Review",
  sourceValidation: "Source Validation Backlog",
  controlledImportReview: "Controlled Import Review",
  userCreatedProviderReview: "User-Created Provider Review",
};

export default function ProviderGovernancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/provider-governance");
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "Failed to load governance queues");
      setData(next);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load governance queues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateCustomProvider = async (customProviderId: string, action: string) => {
    setBusy(customProviderId);
    try {
      const res = await fetch("/api/provider-governance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customProviderId, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update provider");
      toast.success("Provider review updated");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update provider");
    } finally {
      setBusy(null);
    }
  };

  const updateIssue = async (issueId: string, action: string) => {
    setBusy(issueId);
    try {
      const res = await fetch("/api/provider-governance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update issue");
      toast.success("Governance issue updated");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update issue");
    } finally {
      setBusy(null);
    }
  };

  const exportQueue = () => {
    const payload = JSON.stringify(data?.queues || {}, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "provider-governance-queues.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading provider governance...</div>;
  }

  const queues = data?.queues || {};
  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Provider operations</p>
          <h1 className="text-2xl font-semibold">Data Governance Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Review listed provider quality, broad coverage assumptions, duplicate candidates, missing contact data, and private user-created providers. This does not mark providers verified or official.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={exportQueue} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            <Download className="h-4 w-4" /> Export queue
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Provider records are listed/unverified unless a future source-backed validation workflow says otherwise. User-created providers are private user records by default.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {Object.entries(summary).map(([key, count]) => (
          <div key={key} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{QUEUE_LABELS[key] || key}</p>
            <p className="mt-2 text-2xl font-semibold">{String(count)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {Object.entries(queues).map(([key, items]) => (
          <section key={key} className="rounded-lg border bg-card">
            <div className="border-b p-4">
              <h2 className="font-semibold">{QUEUE_LABELS[key] || key}</h2>
              <p className="text-xs text-muted-foreground">{(items as any[]).length} open items</p>
            </div>
            <div className="max-h-[520px] divide-y overflow-y-auto">
              {(items as any[]).slice(0, 40).map((item, index) => {
                const provider = item.provider;
                const customId = provider?.adminReviewStatus ? provider.id : null;
                const issueId = item.issue?.id || null;
                return (
                  <div key={`${key}-${provider?.id || index}-${item.warning?.code}`} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{provider?.name || "Unknown provider"}</p>
                        <p className="text-xs text-muted-foreground">
                          {provider?.category || "Unknown category"} {provider?.scope ? `- ${provider.scope}` : ""}
                        </p>
                      </div>
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    </div>
                    <p className="mt-2 text-sm">{item.warning?.label || item.warning?.code}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.warning?.message || "Needs operator review."}</p>
                    {provider?._count && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {provider._count.services} services, {provider._count.moveTasks} move tasks
                      </p>
                    )}
                    {issueId && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          disabled={busy === issueId}
                          onClick={() => updateIssue(issueId, "mark_reviewed")}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Mark reviewed
                        </button>
                        <button
                          disabled={busy === issueId}
                          onClick={() => updateIssue(issueId, "dismiss_issue")}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {customId && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          disabled={busy === customId}
                          onClick={() => updateCustomProvider(customId, "mark_reviewed")}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Mark reviewed
                        </button>
                        <button
                          disabled={busy === customId}
                          onClick={() => updateCustomProvider(customId, "needs_review")}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          Needs review
                        </button>
                        <button
                          disabled={busy === customId}
                          onClick={() => updateCustomProvider(customId, "promotion_candidate")}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          <Link2 className="h-3 w-3" /> Promotion candidate
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {(items as any[]).length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No open items in this queue.</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

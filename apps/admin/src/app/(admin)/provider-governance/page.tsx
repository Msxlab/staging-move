"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Globe2,
  Home,
  Link2,
  Map,
  RefreshCw,
  Rocket,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

const QUEUE_LABELS: Record<string, string> = {
  userCreatedProviderReview: "User-Submitted Provider Requests",
  providerQuality: "Provider Quality Queue",
  coverageGap: "Coverage Gap Queue",
  duplicateReview: "Duplicate Review Queue",
  missingContact: "Missing Contact Queue",
  broadCoverage: "Broad Coverage Review",
  sourceValidation: "Source Validation Backlog",
};

// Order queues so user-submitted requests show first.
const QUEUE_ORDER = [
  "userCreatedProviderReview",
  "providerQuality",
  "coverageGap",
  "duplicateReview",
  "missingContact",
  "broadCoverage",
  "sourceValidation",
] as const;

const REVIEW_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  NEEDS_REVIEW: { label: "Needs review", className: "bg-tone-orange-bg text-tone-orange-fg border-tone-orange-br" },
  PROMOTION_CANDIDATE: { label: "Promotion candidate", className: "bg-tone-cyan-bg text-tone-cyan-fg border-tone-cyan-br" },
  NOT_REVIEWED: { label: "Private record", className: "bg-foreground/5 text-muted-foreground border-border" },
  REJECTED: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
  REVIEWED: { label: "Reviewed", className: "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br" },
  LINKED_TO_GLOBAL_PROVIDER: { label: "Promoted", className: "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br" },
};

const COVERAGE_BADGE: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  LOCAL: { label: "Local", icon: Home, className: "bg-foreground/5 text-muted-foreground border-border" },
  STATEWIDE: { label: "Statewide", icon: Map, className: "bg-tone-cyan-bg text-tone-cyan-fg border-tone-cyan-br" },
  NATIONWIDE: { label: "Nationwide", icon: Globe2, className: "bg-tone-foil-bg text-tone-foil-fg border-tone-foil-br" },
};

export default function ProviderGovernancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingPromote, setPendingPromote] = useState<{ id: string; name: string } | null>(null);

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

  const updateCustomProvider = async (
    customProviderId: string,
    action: string,
    extra?: Record<string, unknown>,
  ) => {
    setBusy(customProviderId);
    try {
      const res = await fetch("/api/provider-governance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customProviderId, action, ...(extra || {}) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update provider");
      toast.success(action === "promote_to_listed" ? "Promoted to listed directory" : "Provider review updated");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update provider");
    } finally {
      setBusy(null);
    }
  };

  const updateIssue = async (issueId: string, action: "mark_reviewed" | "dismiss_issue" | "reopen_issue") => {
    setBusy(issueId);
    try {
      const res = await fetch("/api/provider-governance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update issue");
      toast.success(action === "dismiss_issue" ? "Issue dismissed" : "Issue reviewed");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update issue");
    } finally {
      setBusy(null);
    }
  };

  const confirmPromote = async () => {
    if (!pendingPromote) return;
    const { id } = pendingPromote;
    setPendingPromote(null);
    await updateCustomProvider(id, "promote_to_listed");
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
      <ConfirmDialog
        open={pendingPromote !== null}
        tone="default"
        title="Promote to listed directory"
        description={
          pendingPromote
            ? `"${pendingPromote.name}" will be published as a new public listed provider, visible to all users. Make sure the name, website, and category are correct.`
            : ""
        }
        confirmLabel="Promote provider"
        onClose={() => setPendingPromote(null)}
        onConfirm={confirmPromote}
      />

      <AdminPageHeader
        eyebrow="Catalog"
        title="Data Governance <em>Center</em>"
        subtitle="Review listed provider quality, broad coverage assumptions, duplicate candidates, missing contact data, and private user-created providers. This does not mark providers verified or official."
        actions={
          <>
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button onClick={exportQueue} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              <Download className="h-4 w-4" /> Export queue
            </button>
          </>
        }
      />

      <div className="rounded-lg border border-tone-honey-br bg-tone-honey-bg p-4 text-sm text-tone-honey-fg dark:text-tone-honey-fg">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Provider records are listed/unverified unless a future source-backed validation workflow says otherwise. User-created providers are private user records by default.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {QUEUE_ORDER.filter((key) => key in summary).map((key) => (
          <div key={key} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{QUEUE_LABELS[key] || key}</p>
            <p className="mt-2 text-2xl font-semibold">{String(summary[key] ?? 0)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {QUEUE_ORDER.filter((key) => key in queues).map((key) => {
          const items = (queues[key] || []) as any[];
          const isCustomQueue = key === "userCreatedProviderReview";
          return (
            <section key={key} className={`rounded-lg border bg-card ${isCustomQueue ? "xl:col-span-2" : ""}`}>
              <div className="border-b p-4">
                <h2 className="font-semibold">{QUEUE_LABELS[key] || key}</h2>
                <p className="text-xs text-muted-foreground">{items.length} open items</p>
              </div>
              <div className="max-h-[520px] divide-y overflow-y-auto">
                {items.slice(0, 40).map((item, index) => {
                  const provider = item.provider;
                  const customId = isCustomQueue && provider?.id ? provider.id : null;
                  const issueId = item.issue?.id ? String(item.issue.id) : null;
                  const reviewBadge = customId ? REVIEW_STATUS_BADGE[provider.adminReviewStatus] : null;
                  const coverageBadge = customId && provider?.coverage ? COVERAGE_BADGE[provider.coverage] : null;
                  const CoverageIcon = coverageBadge?.icon;
                  return (
                    <div key={`${key}-${provider?.id || index}-${item.warning?.code}`} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{provider?.name || "Unknown provider"}</p>
                            {coverageBadge && (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${coverageBadge.className}`}>
                                {CoverageIcon && <CoverageIcon className="h-3 w-3" aria-hidden="true" />}
                                {coverageBadge.label}
                              </span>
                            )}
                            {reviewBadge && (
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${reviewBadge.className}`}>
                                {reviewBadge.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {provider?.category || "Unknown category"} {provider?.scope ? `- ${provider.scope}` : ""}
                            {customId && provider?.providerType ? ` - ${String(provider.providerType).replace(/_/g, " ").toLowerCase()}` : ""}
                          </p>
                          {customId && (provider?.city || provider?.state || provider?.zipCode) && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {[provider?.city, provider?.state, provider?.zipCode].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {customId && provider?.website && (
                            <a
                              href={provider.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block max-w-full truncate text-[11px] text-primary hover:underline"
                            >
                              {provider.website}
                            </a>
                          )}
                          {issueId && item.metadata?.evidenceUrl && (
                            <a
                              href={String(item.metadata.evidenceUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block max-w-full truncate text-[11px] text-primary hover:underline"
                            >
                              Evidence: {String(item.metadata.source || "official source")}
                            </a>
                          )}
                          {issueId && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {[item.metadata?.state, item.metadata?.zip].filter(Boolean).join(" ")}
                              {item.issue?.severity ? ` - ${item.issue.severity} severity` : ""}
                            </p>
                          )}
                          {customId && provider?.user && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Submitted by {provider.user.firstName || ""} {provider.user.lastName || ""}{" "}
                              {provider.user.email ? `<${provider.user.email}>` : ""}
                            </p>
                          )}
                          {customId && provider?.linkedServiceProvider && (
                            <p className="mt-1 text-[11px] text-tone-emerald-fg">
                              Linked to listed provider: {provider.linkedServiceProvider.name}
                            </p>
                          )}
                        </div>
                        <AlertTriangle className="h-4 w-4 shrink-0 text-tone-honey-fg" />
                      </div>
                      <p className="mt-2 text-sm">{item.warning?.label || item.warning?.code}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.warning?.message || "Needs operator review."}</p>
                      {customId && provider?.description && (
                        <p className="mt-2 rounded-md border bg-foreground/[0.02] p-2 text-xs text-muted-foreground">
                          {provider.description}
                        </p>
                      )}
                      {customId && provider?._count && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {provider._count.services} services, {provider._count.moveTasks} move tasks
                        </p>
                      )}
                      {customId && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            disabled={busy === customId}
                            onClick={() => setPendingPromote({ id: customId, name: provider.name })}
                            className="inline-flex items-center gap-1 rounded-md border border-tone-emerald-br bg-tone-emerald-bg px-2 py-1 text-xs text-tone-emerald-fg hover:opacity-90 disabled:opacity-50"
                          >
                            <Rocket className="h-3 w-3" /> Promote to listed
                          </button>
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
                          <button
                            disabled={busy === customId}
                            onClick={() => updateCustomProvider(customId, "reject")}
                            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            <X className="h-3 w-3" /> Reject
                          </button>
                        </div>
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
                            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            <X className="h-3 w-3" /> Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <EmptyState icon={CheckCircle2} title="No open items" description="This queue is clear — nothing needs review right now." compact />
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

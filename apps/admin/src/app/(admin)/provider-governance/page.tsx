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
  Sparkles,
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

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function formatMetadataDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString();
}

function sourceGapAction(metadata: Record<string, unknown>) {
  const source = typeof metadata.source === "string" ? metadata.source : "Source";
  const category = typeof metadata.category === "string" ? metadata.category : "";
  if (category === "UTILITY_ELECTRIC") {
    return `Check whether this is an alias of an existing electric utility. If yes, add alias/coverage; if not, add a listed provider from ${source}.`;
  }
  if (category === "UTILITY_INTERNET") {
    return `Confirm the FCC brand against the catalog. Add a provider alias or listed ISP only after the official source matches the brand.`;
  }
  return `Review the source evidence, then update coverage or dismiss if the source is not actionable.`;
}

function actionLabel(action: string) {
  if (action === "review_alias_or_add_electric_provider") return "Review alias or add electric provider";
  if (action === "review_fcc_brand_or_add_isp") return "Review FCC brand or add ISP";
  return "Review source or dismiss";
}

function aiActionLabel(action: string) {
  if (action === "add_alias") return "Add alias";
  if (action === "create_provider") return "Create provider";
  if (action === "update_coverage") return "Update coverage";
  if (action === "dismiss") return "Dismiss";
  return "Needs human research";
}

function riskClassName(risk: string) {
  if (risk === "high") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (risk === "low") return "border-tone-emerald-br bg-tone-emerald-bg text-tone-emerald-fg";
  return "border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg";
}

export default function ProviderGovernancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingPromote, setPendingPromote] = useState<{ id: string; name: string } | null>(null);
  const [aiAudit, setAiAudit] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState(false);

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

  const analyzeWithAi = async () => {
    setAiBusy(true);
    try {
      const res = await fetch("/api/provider-governance/ai-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 12 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to run provider AI audit");
      setAiAudit(body);
      if (body.configured === false) {
        toast.info("Anthropic is not configured; deterministic audit remains available.");
      } else if (body.error) {
        toast.warning("AI audit could not complete; deterministic audit remains available.");
      } else {
        toast.success("AI provider gap analysis completed");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to run provider AI audit");
    } finally {
      setAiBusy(false);
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
  const auditReport = data?.auditReport;

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
            <button
              onClick={analyzeWithAi}
              disabled={aiBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-tone-cyan-br bg-tone-cyan-bg px-3 py-2 text-sm text-tone-cyan-fg hover:opacity-90 disabled:opacity-50"
            >
              {aiBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Analyze gaps
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

      {auditReport && (
        <section className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">AI-ready audit report</p>
                <h2 className="mt-1 text-lg font-semibold">Provider gap triage</h2>
                <p className="text-xs text-muted-foreground">
                  Deterministic pre-audit. LLM spend estimate: ${Number(auditReport.estimatedLlmCostUsd || 0).toFixed(2)}
                </p>
              </div>
              <span className="rounded-full border bg-foreground/5 px-3 py-1 text-xs text-muted-foreground">
                {auditReport.summary?.sourceGapCount || 0} source gaps
              </span>
            </div>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Open</p>
                  <p className="mt-1 text-xl font-semibold">{auditReport.summary?.openQueueCount || 0}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Repeated</p>
                  <p className="mt-1 text-xl font-semibold">{auditReport.summary?.repeatedSourceGapCount || 0}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">High</p>
                  <p className="mt-1 text-xl font-semibold">{auditReport.summary?.highSeveritySourceGapCount || 0}</p>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended operator moves</p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {(auditReport.recommendations || []).slice(0, 4).map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Top review candidates</p>
              {(auditReport.reviewCandidates || []).slice(0, 5).map((candidate: any) => (
                <div key={`${candidate.source}-${candidate.providerName}-${candidate.category}`} className="rounded-md border p-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{candidate.providerName}</p>
                      <p className="text-muted-foreground">
                        {candidate.category} - {candidate.source}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {candidate.occurrenceCount}x
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{actionLabel(candidate.suggestedAction)}</p>
                  {candidate.sampleLocations?.length > 0 && (
                    <p className="mt-1 text-muted-foreground">Locations: {candidate.sampleLocations.slice(0, 3).join(", ")}</p>
                  )}
                </div>
              ))}
              {(!auditReport.reviewCandidates || auditReport.reviewCandidates.length === 0) && (
                <p className="rounded-md border p-3 text-xs text-muted-foreground">No source-backed provider gaps need review.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {aiAudit && (
        <section className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Haiku on-demand analysis</p>
                <h2 className="mt-1 text-lg font-semibold">Source-gap decision support</h2>
                <p className="text-xs text-muted-foreground">
                  Manual run only. Sends provider/source metadata, not user identifiers or exact addresses.
                </p>
              </div>
              {aiAudit.analysis?.overallRisk && (
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${riskClassName(aiAudit.analysis.overallRisk)}`}>
                  {String(aiAudit.analysis.overallRisk).toUpperCase()} risk
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {aiAudit.configured === false ? (
              <div className="rounded-md border border-tone-honey-br bg-tone-honey-bg p-3 text-sm text-tone-honey-fg">
                Anthropic is not configured in Runtime Config, so no AI call was made. The deterministic report above still gives the safe triage path.
              </div>
            ) : aiAudit.error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                AI analysis was unavailable for this run. Keep using the deterministic review candidates and try again later.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border bg-foreground/[0.02] p-3">
                  <p className="text-sm">{aiAudit.analysis?.summary || "AI analysis completed."}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {aiAudit.promptStats?.issueCount || 0} source gaps, {aiAudit.promptStats?.candidateCount || 0} catalog candidates considered.
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {(aiAudit.analysis?.items || []).map((item: any, index: number) => (
                    <div key={`${item.providerName}-${item.category}-${index}`} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.providerName || item.title || "Provider gap"}</p>
                          <p className="text-xs text-muted-foreground">{item.category || "Unknown category"}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full border bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                            {aiActionLabel(item.recommendedAction)}
                          </span>
                          <span className="rounded-full border bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                            {item.confidence || "low"} confidence
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                      {item.matchedCandidateIds?.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Matched catalog IDs: {item.matchedCandidateIds.slice(0, 4).join(", ")}
                        </p>
                      )}
                      {item.fieldsToCollect?.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Collect: {item.fieldsToCollect.slice(0, 5).join(", ")}
                        </p>
                      )}
                      {(item.suggestedCatalogPatch?.officialName ||
                        item.suggestedCatalogPatch?.website ||
                        item.suggestedCatalogPatch?.phone ||
                        item.suggestedCatalogPatch?.coverageNote ||
                        item.suggestedCatalogPatch?.aliases?.length > 0) && (
                        <div className="mt-3 rounded-md border bg-foreground/[0.02] p-2 text-xs text-muted-foreground">
                          {item.suggestedCatalogPatch.officialName && <p>Name: {item.suggestedCatalogPatch.officialName}</p>}
                          {item.suggestedCatalogPatch.aliases?.length > 0 && <p>Aliases: {item.suggestedCatalogPatch.aliases.join(", ")}</p>}
                          {item.suggestedCatalogPatch.website && <p>Website: {item.suggestedCatalogPatch.website}</p>}
                          {item.suggestedCatalogPatch.phone && <p>Phone: {item.suggestedCatalogPatch.phone}</p>}
                          {item.suggestedCatalogPatch.coverageNote && <p>Coverage: {item.suggestedCatalogPatch.coverageNote}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

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
                  const metadata = (issueId && item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
                  const occurrenceCount =
                    typeof metadata.occurrenceCount === "number" && Number.isFinite(metadata.occurrenceCount)
                      ? metadata.occurrenceCount
                      : null;
                  const lastSeen = formatMetadataDate(metadata.lastSeen);
                  const firstSeen = formatMetadataDate(metadata.firstSeen);
                  const sourceLocations = stringList(metadata.sampleLocations);
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
                      {issueId && (
                        <div className="mt-3 rounded-md border bg-foreground/[0.02] p-3 text-xs">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source returned</p>
                              <p className="mt-0.5 font-medium">{String(metadata.providerName || provider?.name || "Unknown provider")}</p>
                              <p className="text-muted-foreground">{String(metadata.source || provider?.scope || "Source-backed")}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Observed</p>
                              <p className="mt-0.5 font-medium">
                                {occurrenceCount ? `${occurrenceCount} occurrence${occurrenceCount === 1 ? "" : "s"}` : "New issue"}
                              </p>
                              <p className="text-muted-foreground">
                                {lastSeen ? `Last seen ${lastSeen}` : [metadata.state, metadata.zip].filter(Boolean).join(" ") || "Location pending"}
                              </p>
                            </div>
                          </div>
                          {firstSeen && (
                            <p className="mt-2 text-muted-foreground">First seen {firstSeen}</p>
                          )}
                          {sourceLocations.length > 0 && (
                            <p className="mt-2 text-muted-foreground">Sample locations: {sourceLocations.slice(0, 5).join(", ")}</p>
                          )}
                          <p className="mt-2 font-medium text-foreground">Suggested action</p>
                          <p className="mt-1 text-muted-foreground">{sourceGapAction(metadata)}</p>
                        </div>
                      )}
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

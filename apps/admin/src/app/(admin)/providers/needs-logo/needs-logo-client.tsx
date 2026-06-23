"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Globe,
  ImageOff,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
  apiErrorMessage,
  PROVIDER_LOGO_AUTO_FETCH_BULK_CONCURRENCY,
  readApiResponsePayload,
} from "@/lib/provider-logo-auto-fetch";

interface LogoCandidate {
  id: string;
  source: string;
  sourceUrl: string | null;
  publicUrl: string;
  contentType: string;
  bytes: number;
  status: string;
  createdAt: string;
}

interface ProviderRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  website: string | null;
  phone: string | null;
  scope: string;
  popularityScore: number;
  logoCandidates: LogoCandidate[];
}

type RowStatus =
  | { kind: "idle" }
  | { kind: "running"; action: "auto-fetch" | "upload" | "review" }
  | { kind: "candidate"; candidate: LogoCandidate }
  | { kind: "done"; logoUrl: string }
  | { kind: "error"; message: string };

interface ReviewCandidateOptions {
  silent?: boolean;
  reload?: boolean;
}

interface AutoFetchOptions {
  autoAccept?: boolean;
  silent?: boolean;
  reloadOnAccept?: boolean;
}

const MAX_CATALOG_CANDIDATES_PER_RUN = 50;

export default function NeedsLogoClient() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; ok: number; failed: number } | null>(null);
  const [autoAcceptGenerated, setAutoAcceptGenerated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        onlyWithWebsite: String(onlyWithWebsite),
      });
      const res = await fetch(`/api/providers/needs-logo?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load providers");
        return;
      }
      setProviders(data.providers);
      setTotal(data.total);
    } catch (err) {
      toast.error("Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, onlyWithWebsite]);

  useEffect(() => {
    load();
  }, [load]);

  const setRowStatus = (id: string, status: RowStatus) =>
    setStatuses((prev) => ({ ...prev, [id]: status }));
  const clearRowStatus = (id: string) =>
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  async function autoFetch(providerId: string, options: AutoFetchOptions = {}) {
    setRowStatus(providerId, { kind: "running", action: "auto-fetch" });
    try {
      const res = await fetch(`/api/providers/${providerId}/logo/auto-fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await readApiResponsePayload(res);
      if (!res.ok) {
        const message =
          res.status === 422
            ? "No logo source returned a usable image"
            : apiErrorMessage(data, `Auto-fetch failed (${res.status})`);
        setRowStatus(providerId, { kind: "error", message });
        return false;
      }
      const candidate = data.candidate as LogoCandidate | undefined;
      if (!candidate) {
        setRowStatus(providerId, {
          kind: "error",
          message: "Auto-fetch succeeded but did not return a logo candidate",
        });
        return false;
      }
      if (options.autoAccept) {
        return reviewCandidate(providerId, candidate.id, "approve", {
          silent: options.silent,
          reload: options.reloadOnAccept,
        });
      }

      setRowStatus(providerId, { kind: "candidate", candidate });
      return true;
    } catch (err: any) {
      setRowStatus(providerId, {
        kind: "error",
        message: err?.message || "Network error",
      });
      return false;
    }
  }

  async function handleAutoFetch(providerId: string) {
    const ok = await autoFetch(providerId, {
      autoAccept: autoAcceptGenerated,
      silent: true,
    });
    if (ok) {
      toast.success(
        autoAcceptGenerated
          ? "Logo generated and accepted"
          : "Logo candidate ready for review",
      );
    }
  }

  async function handleAutoFetchAll() {
    if (bulkRunning) return;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: providers.length, ok: 0, failed: 0 });
    let success = 0;
    let failed = 0;
    let done = 0;
    for (const provider of providers) {
      const currentStatus = statuses[provider.id];
      const candidateToAccept =
        autoAcceptGenerated
          ? currentStatus?.kind === "candidate"
            ? currentStatus.candidate
            : provider.logoCandidates[0] ?? null
          : null;
      if (currentStatus?.kind === "done") {
        done++;
        setBulkProgress({ done, total: providers.length, ok: success, failed });
        continue;
      }
      if (candidateToAccept) {
        const ok = await reviewCandidate(
          provider.id,
          candidateToAccept.id,
          "approve",
          { silent: true, reload: false },
        );
        if (ok) success++;
        else failed++;
        done++;
        setBulkProgress({ done, total: providers.length, ok: success, failed });
        continue;
      }
      if (
        currentStatus?.kind === "candidate" ||
        provider.logoCandidates.length > 0
      ) {
        done++;
        setBulkProgress({ done, total: providers.length, ok: success, failed });
        continue;
      }
      const ok = await autoFetch(provider.id, {
        autoAccept: autoAcceptGenerated,
        silent: true,
        reloadOnAccept: false,
      });
      if (ok) success++;
      else failed++;
      done++;
      setBulkProgress({ done, total: providers.length, ok: success, failed });
    }
    setBulkRunning(false);
    toast(
      `Page done - ${success} ${autoAcceptGenerated ? "accepted" : "candidates"}, ${failed} failed`,
    );
    if (success > 0) load();
  }

  async function handleAutoFetchEntireCatalog() {
    if (bulkRunning) return;
    setBulkRunning(true);

    // Batch the catalog path so one click cannot fan out across the whole
    // provider catalog. Operators can rerun this after reviewing results.
    const allTasks: { id: string; candidateId?: string }[] = [];
    let cursor = 1;
    while (allTasks.length < MAX_CATALOG_CANDIDATES_PER_RUN) {
      const params = new URLSearchParams({
        page: String(cursor),
        perPage: "200",
        onlyWithWebsite: "true",
      });
      const res = await fetch(`/api/providers/needs-logo?${params.toString()}`);
      if (!res.ok) {
        toast.error("Failed to walk catalog");
        setBulkRunning(false);
        return;
      }
      const data = await res.json();
      const tasks: { id: string; candidateId?: string }[] = data.providers
        .filter((p: { logoCandidates?: LogoCandidate[] }) =>
          autoAcceptGenerated || !p.logoCandidates?.length,
        )
        .map((p: { id: string; logoCandidates?: LogoCandidate[] }) => ({
          id: p.id,
          candidateId: p.logoCandidates?.[0]?.id,
        }));
      allTasks.push(...tasks);
      if (data.providers.length < 200) break;
      cursor++;
    }

    if (allTasks.length === 0) {
      setBulkRunning(false);
      toast("No providers left to generate candidates for");
      return;
    }

    const batchTasks = allTasks.slice(0, MAX_CATALOG_CANDIDATES_PER_RUN);
    if (allTasks.length > batchTasks.length) {
      toast(
        `Generating the next ${batchTasks.length} candidates only; rerun after review for the remaining providers.`,
      );
    }

    setBulkProgress({ done: 0, total: batchTasks.length, ok: 0, failed: 0 });

    // Limited concurrency keeps upstream logo CDNs and the admin API from
    // turning a bulk run into many long-running requests at once.
    const CONCURRENCY = PROVIDER_LOGO_AUTO_FETCH_BULK_CONCURRENCY;
    let success = 0;
    let failed = 0;
    let done = 0;
    let nextIndex = 0;

    async function worker() {
      while (true) {
        const i = nextIndex++;
        if (i >= batchTasks.length) return;
        const task = batchTasks[i];
        const ok = task.candidateId
          ? await reviewCandidate(task.id, task.candidateId, "approve", {
              silent: true,
              reload: false,
            })
          : await autoFetch(task.id, {
              autoAccept: autoAcceptGenerated,
              silent: true,
              reloadOnAccept: false,
            });
        if (ok) success++;
        else failed++;
        done++;
        setBulkProgress({ done, total: batchTasks.length, ok: success, failed });
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, batchTasks.length) }, () => worker()),
    );

    setBulkRunning(false);
    toast.success(
      `Catalog batch done - ${success} ${autoAcceptGenerated ? "accepted" : "candidates"}, ${failed} failed of ${batchTasks.length}`,
    );
    load();
  }

  async function handleUpload(providerId: string, file: File) {
    setRowStatus(providerId, { kind: "running", action: "upload" });
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/providers/${providerId}/logo/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setRowStatus(providerId, {
          kind: "error",
          message: data.error || "Upload failed",
        });
        toast.error(data.error || "Upload failed");
        return;
      }
      setRowStatus(providerId, { kind: "candidate", candidate: data.candidate });
      toast.success("Logo candidate uploaded");
    } catch (err: any) {
      setRowStatus(providerId, {
        kind: "error",
        message: err?.message || "Network error",
      });
      toast.error("Upload failed");
    }
  }

  async function reviewCandidate(
    providerId: string,
    candidateId: string,
    action: "approve" | "reject",
    options: ReviewCandidateOptions = {},
  ) {
    setRowStatus(providerId, { kind: "running", action: "review" });
    try {
      const res = await fetch(
        `/api/providers/${providerId}/logo/candidates/${candidateId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || `Failed to ${action} logo candidate`;
        setRowStatus(providerId, { kind: "error", message });
        if (!options.silent) toast.error(message);
        return false;
      }

      if (action === "approve") {
        setRowStatus(providerId, { kind: "done", logoUrl: data.logoUrl });
        if (!options.silent) toast.success("Logo approved and published");
      } else {
        clearRowStatus(providerId);
        if (!options.silent) toast.success("Logo candidate rejected");
      }
      if (options.reload !== false) load();
      return true;
    } catch (err: any) {
      const message = err?.message || `Failed to ${action} logo candidate`;
      setRowStatus(providerId, { kind: "error", message });
      if (!options.silent) toast.error(message);
      return false;
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Providers needing <em>logos</em>"
        subtitle={loading ? "Loading…" : `${total} active provider${total === 1 ? "" : "s"} with no logo`}
        actions={
          <>
            <Link
              href="/providers"
              aria-label="Back to providers"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to providers
            </Link>
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              type="button"
              onClick={handleAutoFetchAll}
              disabled={bulkRunning || providers.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {bulkRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {autoAcceptGenerated ? "Generate + accept page" : "Generate page"}
            </button>
            <button
              type="button"
              onClick={handleAutoFetchEntireCatalog}
              disabled={bulkRunning || total === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {bulkRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {autoAcceptGenerated
                ? "Generate + accept next 50"
                : "Generate next 50 candidates"}
            </button>
          </>
        }
      />

      {bulkProgress && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              <span className="font-mono text-foreground">{bulkProgress.done}</span> / <span className="font-mono text-foreground">{bulkProgress.total}</span> processed —{" "}
              <span className="text-tone-sage-fg">
                <span className="font-mono">{bulkProgress.ok}</span> {autoAcceptGenerated ? "accepted" : "candidates"}
              </span> ·{" "}
              <span className="text-destructive"><span className="font-mono">{bulkProgress.failed}</span> failed</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={onlyWithWebsite}
            onChange={(e) => {
              setOnlyWithWebsite(e.target.checked);
              setPage(1);
            }}
          />
          Only show providers that have a website
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={autoAcceptGenerated}
            onChange={(e) => setAutoAcceptGenerated(e.target.checked)}
          />
          Auto-accept generated logos
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Provider</th>
              <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Website</th>
              <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!loading && providers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No providers without logos. Nice.
                </td>
              </tr>
            )}
            {providers.map((p) => {
              const existingCandidate = p.logoCandidates[0] ?? null;
              const status =
                statuses[p.id] ??
                (existingCandidate
                  ? ({ kind: "candidate", candidate: existingCandidate } as const)
                  : ({ kind: "idle" } as const));
              return (
                <tr key={p.id} className="bg-card transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.category}
                    {p.scope === "STATE" ? " · STATE" : ""}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.website ? (
                      <a
                        href={p.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        {p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {status.kind === "idle" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-tone-slate-bg px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        Pending
                      </span>
                    )}
                    {status.kind === "running" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-tone-sky-bg px-2 py-0.5 text-[11px] font-semibold text-tone-sky-fg">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {status.action === "auto-fetch"
                          ? "Fetching…"
                          : status.action === "review"
                            ? "Reviewing…"
                            : "Uploading…"}
                      </span>
                    )}
                    {status.kind === "candidate" && (
                      <span className="inline-flex items-center gap-2">
                        <img
                          src={status.candidate.publicUrl}
                          alt=""
                          className="h-6 w-6 rounded object-contain bg-card"
                        />
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-tone-honey-bg px-2 py-0.5 text-[11px] font-semibold text-tone-honey-fg">
                          <span className="h-1.5 w-1.5 rounded-full bg-tone-honey-fg" />
                          Candidate · {status.candidate.source}
                        </span>
                      </span>
                    )}
                    {status.kind === "done" && (
                      <span className="inline-flex items-center gap-2">
                        <img
                          src={status.logoUrl}
                          alt=""
                          className="h-6 w-6 rounded object-contain bg-card"
                        />
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-tone-sage-bg px-2 py-0.5 text-[11px] font-semibold text-tone-sage-fg">
                          <span className="h-1.5 w-1.5 rounded-full bg-tone-sage-fg" />
                          Done
                        </span>
                      </span>
                    )}
                    {status.kind === "error" && (
                      <span className="text-destructive" title={status.message}>
                        {status.message.length > 40
                          ? status.message.slice(0, 40) + "…"
                          : status.message}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {status.kind === "candidate" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              reviewCandidate(p.id, status.candidate.id, "approve")
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-tone-sage-br px-2.5 py-1.5 text-xs font-medium text-tone-sage-fg transition-colors hover:bg-tone-sage-bg"
                          >
                            <Check className="h-3 w-3" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              reviewCandidate(p.id, status.candidate.id, "reject")
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <X className="h-3 w-3" /> Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={!p.website || status.kind === "running"}
                        onClick={() => handleAutoFetch(p.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                      >
                        <Sparkles className="h-3 w-3" /> Auto
                      </button>
                      <label
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
                          status.kind === "running" ? "pointer-events-none opacity-50" : ""
                        }`}
                      >
                        <Upload className="h-3 w-3" /> Upload
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(p.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > perPage && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page <span className="font-mono text-foreground">{page}</span> of <span className="font-mono text-foreground">{Math.ceil(total / perPage)}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page * perPage >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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

const MAX_CATALOG_CANDIDATES_PER_RUN = 50;

export default function NeedsLogoPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; ok: number; failed: number } | null>(null);

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

  async function autoFetch(providerId: string) {
    setRowStatus(providerId, { kind: "running", action: "auto-fetch" });
    try {
      const res = await fetch(`/api/providers/${providerId}/logo/auto-fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        const message =
          res.status === 422
            ? "No logo source returned a usable image"
            : data.error || "Auto-fetch failed";
        setRowStatus(providerId, { kind: "error", message });
        return false;
      }
      setRowStatus(providerId, { kind: "candidate", candidate: data.candidate });
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
    const ok = await autoFetch(providerId);
    if (ok) toast.success("Logo candidate ready for review");
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
      if (
        currentStatus?.kind === "done" ||
        currentStatus?.kind === "candidate" ||
        provider.logoCandidates.length > 0
      ) {
        done++;
        setBulkProgress({ done, total: providers.length, ok: success, failed });
        continue;
      }
      const ok = await autoFetch(provider.id);
      if (ok) success++;
      else failed++;
      done++;
      setBulkProgress({ done, total: providers.length, ok: success, failed });
    }
    setBulkRunning(false);
    toast(`Page done - ${success} candidates, ${failed} failed`);
    if (success > 0) load();
  }

  async function handleAutoFetchEntireCatalog() {
    if (bulkRunning) return;
    setBulkRunning(true);

    // Batch the catalog path so one click cannot fan out across the whole
    // provider catalog. Operators can rerun this after reviewing results.
    const allIds: string[] = [];
    let cursor = 1;
    while (allIds.length < MAX_CATALOG_CANDIDATES_PER_RUN) {
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
      const ids: string[] = data.providers
        .filter((p: { logoCandidates?: LogoCandidate[] }) => !p.logoCandidates?.length)
        .map((p: { id: string }) => p.id);
      allIds.push(...ids);
      if (data.providers.length < 200) break;
      cursor++;
    }

    if (allIds.length === 0) {
      setBulkRunning(false);
      toast("No providers left to generate candidates for");
      return;
    }

    const batchIds = allIds.slice(0, MAX_CATALOG_CANDIDATES_PER_RUN);
    if (allIds.length > batchIds.length) {
      toast(
        `Generating the next ${batchIds.length} candidates only; rerun after review for the remaining providers.`,
      );
    }

    setBulkProgress({ done: 0, total: batchIds.length, ok: 0, failed: 0 });

    // Limited concurrency. Sequential is too slow at ~3-5s per fetch
    // (~12 minutes for 231); 4-way parallel cuts it to ~3 minutes without
    // tripping any of the upstream logo CDNs' rate limits.
    const CONCURRENCY = 4;
    let success = 0;
    let failed = 0;
    let done = 0;
    let nextIndex = 0;

    async function worker() {
      while (true) {
        const i = nextIndex++;
        if (i >= batchIds.length) return;
        const id = batchIds[i];
        const ok = await autoFetch(id);
        if (ok) success++;
        else failed++;
        done++;
        setBulkProgress({ done, total: batchIds.length, ok: success, failed });
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, batchIds.length) }, () => worker()),
    );

    setBulkRunning(false);
    toast.success(
      `Catalog candidate batch done - ${success} candidates, ${failed} failed of ${batchIds.length}`,
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
        toast.error(message);
        return;
      }

      if (action === "approve") {
        setRowStatus(providerId, { kind: "done", logoUrl: data.logoUrl });
        toast.success("Logo approved and published");
      } else {
        clearRowStatus(providerId);
        toast.success("Logo candidate rejected");
      }
      load();
    } catch (err: any) {
      const message = err?.message || `Failed to ${action} logo candidate`;
      setRowStatus(providerId, { kind: "error", message });
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/providers"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to providers
          </Link>
          <h1 className="mt-2 text-2xl font-semibold flex items-center gap-2">
            <ImageOff className="h-6 w-6" /> Providers needing logos
          </h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${total} active provider${total === 1 ? "" : "s"} with no logo`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-muted"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={handleAutoFetchAll}
            disabled={bulkRunning || providers.length === 0}
            className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {bulkRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate page
          </button>
          <button
            type="button"
            onClick={handleAutoFetchEntireCatalog}
            disabled={bulkRunning || total === 0}
            className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {bulkRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate next 50 candidates
          </button>
        </div>
      </div>

      {bulkProgress && (
        <div className="rounded border bg-card p-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>
              {bulkProgress.done} / {bulkProgress.total} processed —{" "}
              <span className="text-green-600">{bulkProgress.ok} candidates</span> ·{" "}
              <span className="text-red-600">{bulkProgress.failed} failed</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full rounded bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2 cursor-pointer">
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
      </div>

      <div className="rounded border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Provider</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Website</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
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
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.slug}</div>
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
                      <span className="text-muted-foreground">Pending</span>
                    )}
                    {status.kind === "running" && (
                      <span className="inline-flex items-center gap-1 text-blue-600">
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
                          className="h-6 w-6 rounded object-contain bg-white"
                        />
                        <span className="text-amber-700">
                          Candidate · {status.candidate.source}
                        </span>
                      </span>
                    )}
                    {status.kind === "done" && (
                      <span className="inline-flex items-center gap-2">
                        <img
                          src={status.logoUrl}
                          alt=""
                          className="h-6 w-6 rounded object-contain bg-white"
                        />
                        <span className="text-green-600">Done</span>
                      </span>
                    )}
                    {status.kind === "error" && (
                      <span className="text-red-600" title={status.message}>
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
                            className="inline-flex items-center gap-1 rounded border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-3 w-3" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              reviewCandidate(p.id, status.candidate.id, "reject")
                            }
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            <X className="h-3 w-3" /> Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={!p.website || status.kind === "running"}
                        onClick={() => handleAutoFetch(p.id)}
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        <Sparkles className="h-3 w-3" /> Auto
                      </button>
                      <label
                        className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted cursor-pointer ${
                          status.kind === "running" ? "opacity-50 pointer-events-none" : ""
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
            Page {page} of {Math.ceil(total / perPage)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page * perPage >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

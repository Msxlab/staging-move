"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  ImageOff,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

interface ProviderRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  website: string | null;
  phone: string | null;
  scope: string;
  popularityScore: number;
}

type RowStatus =
  | { kind: "idle" }
  | { kind: "running"; action: "auto-fetch" | "upload" }
  | { kind: "done"; logoUrl: string }
  | { kind: "error"; message: string };

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

  async function autoFetch(providerId: string) {
    setRowStatus(providerId, { kind: "running", action: "auto-fetch" });
    try {
      const res = await fetch(`/api/providers/${providerId}/logo/auto-fetch`, {
        method: "POST",
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
      setRowStatus(providerId, { kind: "done", logoUrl: data.logoUrl });
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
    if (ok) toast.success("Logo fetched");
  }

  async function handleAutoFetchAll() {
    if (bulkRunning) return;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: providers.length, ok: 0, failed: 0 });
    let success = 0;
    let failed = 0;
    let done = 0;
    for (const provider of providers) {
      if (statuses[provider.id]?.kind === "done") {
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
    toast(`Page done — ${success} ok, ${failed} failed`);
    if (success > 0) load();
  }

  async function handleAutoFetchEntireCatalog() {
    if (bulkRunning) return;
    setBulkRunning(true);

    // Walk all pages first so we know the total. Up to 200 per page;
    // 231 active providers today means usually one page is enough.
    const allIds: string[] = [];
    let cursor = 1;
    while (true) {
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
      const ids: string[] = data.providers.map((p: { id: string }) => p.id);
      allIds.push(...ids);
      if (ids.length < 200) break;
      cursor++;
    }

    if (allIds.length === 0) {
      setBulkRunning(false);
      toast("No providers left to fetch");
      return;
    }

    setBulkProgress({ done: 0, total: allIds.length, ok: 0, failed: 0 });

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
        if (i >= allIds.length) return;
        const id = allIds[i];
        const ok = await autoFetch(id);
        if (ok) success++;
        else failed++;
        done++;
        setBulkProgress({ done, total: allIds.length, ok: success, failed });
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, allIds.length) }, () => worker()),
    );

    setBulkRunning(false);
    toast.success(
      `Catalog backfill done — ${success} ok, ${failed} failed of ${allIds.length}`,
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
      setRowStatus(providerId, { kind: "done", logoUrl: data.logoUrl });
      toast.success("Logo uploaded");
    } catch (err: any) {
      setRowStatus(providerId, {
        kind: "error",
        message: err?.message || "Network error",
      });
      toast.error("Upload failed");
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
            This page
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
            Auto-fetch entire catalog
          </button>
        </div>
      </div>

      {bulkProgress && (
        <div className="rounded border bg-card p-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>
              {bulkProgress.done} / {bulkProgress.total} processed —{" "}
              <span className="text-green-600">{bulkProgress.ok} ok</span> ·{" "}
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
              const status = statuses[p.id] ?? { kind: "idle" as const };
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
                        {status.action === "auto-fetch" ? "Fetching…" : "Uploading…"}
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
                          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon"
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

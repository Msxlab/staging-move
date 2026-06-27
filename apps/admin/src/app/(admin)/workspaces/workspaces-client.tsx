"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

interface WorkspaceRow {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  plan: string;
  planLabel: string;
  seatLimit: number;
  owner: { id: string | null; email: string | null; name: string | null; deleted?: boolean };
}

const PLAN_COLORS: Record<string, string> = {
  FAMILY: "bg-tone-foil-bg text-tone-foil-fg",
  PRO: "bg-tone-rose-bg text-tone-rose-fg",
  INDIVIDUAL: "bg-tone-sky-bg text-tone-sky-fg",
  FREE_TRIAL: "bg-tone-honey-bg text-tone-honey-fg",
};

const inputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function WorkspacesClient() {
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [multiOnly, setMultiOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const perPage = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage), search });
      if (multiOnly) params.set("multiOnly", "1");
      const res = await fetch(`/api/workspaces?${params}`);
      const data = await res.json();
      setRows(data.workspaces || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Failed to fetch workspaces");
    } finally {
      setLoading(false);
    }
  }, [page, search, multiOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Seat usage across the current page — derived from real rows, no extra fetch.
  const pageSeatsUsed = rows.reduce((sum, w) => sum + w.memberCount, 0);
  const pageSeatLimit = rows.reduce((sum, w) => sum + w.seatLimit, 0);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Family & Pro"
        title="Workspaces"
        subtitle="Households with their owner, plan, seat usage and member count."
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Households", value: total, color: "text-foreground", bg: "bg-card" },
          { label: "On this page", value: rows.length, color: "text-tone-sky-fg", bg: "bg-tone-sky-bg" },
          { label: "Seats used", value: pageSeatsUsed, color: "text-tone-foil-fg", bg: "bg-tone-foil-bg" },
          { label: "Seats available", value: pageSeatLimit, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-border ${s.bg} p-4`}>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{s.label}</p>
            <p className={`mt-1.5 font-display text-3xl font-extrabold leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-10`}
            placeholder="Search by owner email or name"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={multiOnly}
            onChange={(e) => {
              setPage(1);
              setMultiOnly(e.target.checked);
            }}
          />
          Family/Pro only
        </label>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading workspaces…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No workspaces"
          description="No households match. If WORKSPACE_MODEL_ENABLED is off, none are provisioned yet."
          className="rounded-2xl border border-dashed border-border"
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Household</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Owner</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Plan</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Seats</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((w) => (
                <tr key={w.id} className="bg-card transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {w.owner.deleted ? "(deleted)" : w.owner.name || w.owner.email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        PLAN_COLORS[w.plan] || "bg-tone-slate-bg text-muted-foreground"
                      }`}
                    >
                      {w.planLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {w.memberCount} / {w.seatLimit}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/workspaces/${w.id}`}
                      className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      View <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            <span className="font-mono">{total}</span> households
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

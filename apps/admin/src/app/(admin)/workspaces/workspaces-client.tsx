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
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Family & Pro"
        title="Workspaces"
        subtitle="Households with their owner, plan, seat usage and member count."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Search by owner email or name"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
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
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No workspaces"
          description="No households match. If WORKSPACE_MODEL_ENABLED is off, none are provisioned yet."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Household</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Seats</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="border-t border-border hover:bg-foreground/[0.02]">
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {w.memberCount} / {w.seatLimit}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/workspaces/${w.id}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
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
          <span className="text-xs text-muted-foreground">{total} households</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-border p-2 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-border p-2 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

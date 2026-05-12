"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, ChevronLeft, ChevronRight, Filter, X, Download, Shield, Users,
  ChevronDown, ChevronUp, Clock, FileText, ExternalLink, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-tone-sage-bg text-tone-sage-fg", UPDATE: "bg-tone-sky-bg text-tone-sky-fg",
  DELETE: "bg-destructive/10 text-destructive", LOGIN: "bg-tone-cyan-bg text-tone-cyan-fg",
  APPROVE: "bg-tone-sage-bg text-tone-sage-fg", REJECT: "bg-destructive/10 text-destructive",
};

function actionColor(action: string) {
  for (const [key, val] of Object.entries(ACTION_COLORS)) {
    if (action.toUpperCase().includes(key)) return val;
  }
  return "bg-primary/10 text-primary";
}

export default function LogsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"admin" | "user">("admin");
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<any>({ actions: [], entityTypes: [], admins: [] });
  const [filters, setFilters] = useState({ action: "", entityType: "", adminId: "", dateFrom: "", dateTo: "" });
  const [exportStepUpOpen, setExportStepUpOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const perPage = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage), tab, search });
      if (filters.action) params.set("action", filters.action);
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.adminId) params.set("adminId", filters.adminId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      if (data.filters) setFilterOptions(data.filters);
    } catch { toast.error("Failed to fetch logs"); }
    finally { setLoading(false); }
  }, [page, tab, search, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const totalPages = Math.ceil(total / perPage);

  function clearFilters() {
    setFilters({ action: "", entityType: "", adminId: "", dateFrom: "", dateTo: "" });
    setPage(1);
  }

  async function exportCSV(values: StepUpValues) {
    setExportBusy(true);
    setExportError(null);
    try {
      const res = await fetch("/api/logs/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab,
          confirmPassword: values.confirmPassword,
          mfaCode: values.mfaCode,
          backupCode: values.backupCode,
          search,
          action: filters.action || undefined,
          entityType: filters.entityType || undefined,
          adminId: filters.adminId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.requiresMfa
          ? "Enter an authenticator code or backup code to export audit logs."
          : data?.error || `Export failed (${res.status})`;
        setExportError(message);
        toast.error(data?.error || message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tab}-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStepUpOpen(false);
      toast.success("Export downloaded");
    } catch {
      setExportError("Export failed");
      toast.error("Export failed");
    } finally {
      setExportBusy(false);
    }
  }

  function tryParseJSON(str: string | null) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return str; }
  }

  return (
    <div className="space-y-5">
      <PasswordConfirmModal
        open={exportStepUpOpen}
        title="Confirm audit export"
        description="Enter your admin password plus an authenticator or backup code before exporting audit logs."
        confirmLabel="Export logs"
        busy={exportBusy}
        error={exportError}
        onClose={() => {
          if (exportBusy) return;
          setExportStepUpOpen(false);
          setExportError(null);
        }}
        onConfirm={(_password, values) => exportCSV(values)}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
          <p className="mt-1 text-muted-foreground">{total} log entries</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/logs/activity" className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <BarChart3 className="h-3.5 w-3.5" /> Activity Analytics
          </a>
          <button onClick={() => setExportStepUpOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => { setTab("admin"); setPage(1); setSearch(""); clearFilters(); }}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${tab === "admin" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>
          <Shield className="h-4 w-4" /> Admin Actions
        </button>
        <button onClick={() => { setTab("user"); setPage(1); setSearch(""); clearFilters(); }}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${tab === "user" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>
          <Users className="h-4 w-4" /> User Activity
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder={tab === "admin" ? "Search admin email, entity ID, action..." : "Search user ID, entity, action..."}
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${showFilters ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
          <Filter className="h-3.5 w-3.5" /> Filters {activeFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFilterCount}</span>}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className={`grid gap-3 ${tab === "admin" ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Action</label>
              <select value={filters.action} onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">All Actions</option>
                {(filterOptions.actions || []).map((a: any) => <option key={a.value} value={a.value}>{a.value} ({a.count})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Entity Type</label>
              <select value={filters.entityType} onChange={(e) => { setFilters({ ...filters, entityType: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">All Types</option>
                {(filterOptions.entityTypes || []).map((e: any) => <option key={e.value} value={e.value}>{e.value} ({e.count})</option>)}
              </select>
            </div>
            {tab === "admin" && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Admin</label>
                <select value={filters.adminId} onChange={(e) => { setFilters({ ...filters, adminId: e.target.value }); setPage(1); }} className={inputCls}>
                  <option value="">All Admins</option>
                  {(filterOptions.admins || []).map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">From Date</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1); }} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">To Date</label>
              <input type="date" value={filters.dateTo} onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(1); }} className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">{tab === "admin" ? "Admin" : "User"}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">IP</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Time</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No logs found</td></tr>
            ) : logs.map((log: any) => {
              const who = tab === "admin" ? log.adminUser : log.user;
              const changes = tryParseJSON(log.changes);
              const isExpanded = expandedLog === log.id;
              return (
                <tr key={log.id} className="bg-card group">
                  <td className="px-4 py-3">
                    {who ? (
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{who.firstName} {who.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{who.email}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground font-mono">{(log.userId || log.adminUserId || "").slice(0, 12)}...</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${actionColor(log.action)}`}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground">{log.entityType}</span>
                    <p className="text-xs text-muted-foreground font-mono">{log.entityId.slice(0, 10)}...</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{log.ipAddress || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-foreground">{relativeTime(log.createdAt)}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {changes ? (
                      <button onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded Changes Viewer */}
      {expandedLog && (() => {
        const log = logs.find((l: any) => l.id === expandedLog);
        if (!log) return null;
        const changes = tryParseJSON(log.changes);
        return (
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-foreground">Changes — {log.action} on {log.entityType}</p>
              <button onClick={() => setExpandedLog(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <pre className="text-xs text-muted-foreground bg-card rounded-lg p-3 overflow-x-auto max-h-64 border border-border">
              {typeof changes === "string" ? changes : JSON.stringify(changes, null, 2)}
            </pre>
          </div>
        );
      })()}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-3 text-sm text-muted-foreground">Page {page} / {totalPages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

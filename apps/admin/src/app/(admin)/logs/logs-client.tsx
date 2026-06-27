"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown, ChevronUp, Download, Shield, Users, FileText, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
import {
  DataTablePage,
  type DataTableColumn,
  type FilterControl,
} from "@/components/data-table-page";

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

// Dot-pill palette — each action maps to a pill background/text plus a
// matching status-dot color. Mirrors the Move admin reskin status pills.
const ACTION_COLORS: Record<string, { pill: string; dot: string }> = {
  CREATE: { pill: "bg-tone-sage-bg text-tone-sage-fg", dot: "bg-tone-sage-fg" },
  UPDATE: { pill: "bg-tone-sky-bg text-tone-sky-fg", dot: "bg-tone-sky-fg" },
  DELETE: { pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  LOGIN: { pill: "bg-tone-cyan-bg text-tone-cyan-fg", dot: "bg-tone-cyan-fg" },
  APPROVE: { pill: "bg-tone-sage-bg text-tone-sage-fg", dot: "bg-tone-sage-fg" },
  REJECT: { pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

function actionColor(action: string) {
  for (const [key, val] of Object.entries(ACTION_COLORS)) {
    if (action.toUpperCase().includes(key)) return val;
  }
  return { pill: "bg-primary/10 text-primary", dot: "bg-primary" };
}

function tryParseJSON(str: string | null) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}

interface LogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  createdAt: string;
  changes: string | null;
  userId?: string | null;
  adminUserId?: string | null;
  user?: { firstName: string | null; lastName: string | null; email: string } | null;
  adminUser?: { firstName: string | null; lastName: string | null; email: string } | null;
}

interface FilterOptions {
  actions: { value: string; count: number }[];
  entityTypes: { value: string; count: number }[];
  admins: { id: string; label: string }[];
}

export default function LogsClient() {
  const [tab, setTab] = useState<"admin" | "user">("admin");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    actions: [],
    entityTypes: [],
    admins: [],
  });
  const [expandedLog, setExpandedLog] = useState<{ id: string; changes: string | null; action: string; entityType: string } | null>(null);
  const [exportStepUpOpen, setExportStepUpOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // The filter bar's option lists are server-driven (returned in the fetch
  // response). Build the FilterControl[] from the latest options. The Admin
  // filter only exists on the admin tab.
  const filters = useMemo<FilterControl[]>(() => {
    const base: FilterControl[] = [
      {
        key: "action",
        label: "Action",
        type: "select",
        options: [
          { value: "", label: "All Actions" },
          ...filterOptions.actions.map((a) => ({ value: a.value, label: `${a.value} (${a.count})` })),
        ],
      },
      {
        key: "entityType",
        label: "Entity Type",
        type: "select",
        options: [
          { value: "", label: "All Types" },
          ...filterOptions.entityTypes.map((e) => ({ value: e.value, label: `${e.value} (${e.count})` })),
        ],
      },
    ];
    if (tab === "admin") {
      base.push({
        key: "adminId",
        label: "Admin",
        type: "select",
        options: [
          { value: "", label: "All Admins" },
          ...filterOptions.admins.map((a) => ({ value: a.id, label: a.label })),
        ],
      });
    }
    base.push(
      { key: "dateFrom", label: "From Date", type: "date" },
      { key: "dateTo", label: "To Date", type: "date" },
    );
    return base;
  }, [filterOptions, tab]);

  const columns: DataTableColumn<LogRow>[] = [
    {
      key: "who",
      label: tab === "admin" ? "Admin" : "User",
      alwaysOn: true,
      header: tab === "admin" ? "Admin" : "User",
      cell: (log) => {
        const who = tab === "admin" ? log.adminUser : log.user;
        return who ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{who.firstName} {who.lastName}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{who.email}</p>
          </div>
        ) : (
          <p className="font-mono text-xs text-muted-foreground">
            {(log.userId || log.adminUserId || "").slice(0, 12)}...
          </p>
        );
      },
    },
    {
      key: "action",
      label: "Action",
      cell: (log) => {
        const c = actionColor(log.action);
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${c.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            {log.action}
          </span>
        );
      },
    },
    {
      key: "entity",
      label: "Entity",
      cell: (log) => (
        <>
          <span className="text-sm text-foreground">{log.entityType}</span>
          <p className="font-mono text-xs text-muted-foreground">{log.entityId.slice(0, 10)}...</p>
        </>
      ),
    },
    {
      key: "ip",
      label: "IP",
      cell: (log) => <span className="font-mono text-xs text-muted-foreground">{log.ipAddress || "—"}</span>,
    },
    {
      key: "time",
      label: "Time",
      cell: (log) => (
        <>
          <p className="text-xs text-foreground">{relativeTime(log.createdAt)}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
        </>
      ),
    },
    {
      key: "details",
      label: "Details",
      align: "center",
      cell: (log) => {
        const changes = tryParseJSON(log.changes);
        if (!changes) return <span className="text-xs text-muted-foreground">—</span>;
        const isExpanded = expandedLog?.id === log.id;
        return (
          <button
            onClick={() =>
              setExpandedLog(
                isExpanded
                  ? null
                  : { id: log.id, changes: log.changes, action: log.action, entityType: log.entityType },
              )
            }
            aria-label={isExpanded ? "Collapse log details" : "Expand log details"}
            aria-pressed={isExpanded}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        );
      },
    },
  ];

  async function exportCSV(values: StepUpValues, query: Record<string, string>) {
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
          search: query.search || undefined,
          action: query.action || undefined,
          entityType: query.entityType || undefined,
          adminId: query.adminId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
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

  // Snapshot of the table's current query so the step-up export can forward
  // the same filters the operator is viewing. Updated by the fetcher.
  const [exportQuery, setExportQuery] = useState<Record<string, string>>({});

  return (
    <>
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
        onConfirm={(_password, values) => exportCSV(values, exportQuery)}
      />

      {/* key={tab} resets the table's URL-synced state (search/filters/page)
          when the operator switches tabs — matching the old behavior that
          cleared search + filters + page on tab change. */}
      <DataTablePage<LogRow>
        key={tab}
        eyebrow="Security"
        title="Audit <em>Logs</em>"
        subtitle={(total) => `${total} log entries`}
        storageKey={`admin.logs.${tab}`}
        columnsVersion={1}
        columns={columns}
        filters={filters}
        onRowActivate={(log) => {
          if (!log.changes) return;
          setExpandedLog((cur) =>
            cur?.id === log.id
              ? null
              : { id: log.id, changes: log.changes, action: log.action, entityType: log.entityType },
          );
        }}
        defaultSortBy="createdAt"
        defaultSortDir="desc"
        perPage={30}
        searchPlaceholder={
          tab === "admin"
            ? "Search admin email, entity ID, action..."
            : "Search user ID, entity, action..."
        }
        emptyIcon={FileText}
        emptyTitle="No logs found"
        emptyDescription={() => "No audit log entries match your current search or filters."}
        fetcher={async ({ params, signal }) => {
          params.set("tab", tab);
          // The logs API derives sort server-side (createdAt desc); it does
          // not read sortBy/sortDir, so leaving them in the params is inert.
          const res = await fetch(`/api/logs?${params}`, { signal });
          const data = await res.json();
          // Facets are only computed on unfiltered page 1 (facetsComputed) —
          // keep the previously loaded dropdown options on paged/filtered
          // responses instead of wiping them with the empty arrays.
          if (data.filters && data.facetsComputed !== false) setFilterOptions(data.filters);
          // Capture the non-pagination query for the export step-up.
          const snap: Record<string, string> = {};
          ["search", "action", "entityType", "adminId", "dateFrom", "dateTo"].forEach((k) => {
            const v = params.get(k);
            if (v) snap[k] = v;
          });
          setExportQuery(snap);
          return { rows: data.logs || [], total: data.total || 0 };
        }}
        headerActions={() => (
          <>
            <a
              href="/logs/activity"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Activity Analytics
            </a>
            <button
              onClick={() => setExportStepUpOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </>
        )}
        beforeTable={() => (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTab("admin")}
              className={`flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-medium transition-colors ${tab === "admin" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <Shield className="h-4 w-4" /> Admin Actions
            </button>
            <button
              onClick={() => setTab("user")}
              className={`flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-medium transition-colors ${tab === "user" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <Users className="h-4 w-4" /> User Activity
            </button>
          </div>
        )}
        afterTable={() =>
          expandedLog
            ? (() => {
                const changes = tryParseJSON(expandedLog.changes);
                return (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Change diff
                        </p>
                        <p className="mt-1 font-display text-base font-bold text-foreground">
                          <span className="font-mono">{expandedLog.action}</span> on {expandedLog.entityType}
                        </p>
                      </div>
                      <button
                        onClick={() => setExpandedLog(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        Close
                      </button>
                    </div>
                    <pre className="max-h-64 overflow-x-auto rounded-xl border border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
                      {typeof changes === "string" ? changes : JSON.stringify(changes, null, 2)}
                    </pre>
                  </div>
                );
              })()
            : null
        }
      />
    </>
  );
}

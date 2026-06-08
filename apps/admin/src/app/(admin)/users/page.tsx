"use client";

import { useRef, useState } from "react";
import {
  Eye, Trash2, Users, UserPlus, CreditCard, Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  DataTablePage,
  type DataTableColumn,
  type FilterControl,
  type BulkContext,
  type DataTableContext,
} from "@/components/data-table-page";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
import { TierStamp } from "@/components/premium/tier-stamp";
import { HealthPill } from "@/components/premium/health-pill";
import { computeUserHealth } from "@/lib/user-health";
import { maskEmail } from "@/lib/privacy";

// Health column is on by default — support team's #1 ask. Sticker is part
// of the "user" cell, not its own column, so it always rides next to the
// user's name.
interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  deletedAt: string | null;
  // Most recent UserLoginSession.lastActivity, surfaced by /api/users so
  // the health column can flag idle accounts without a separate fetch.
  lastActivityAt: string | null;
  subscription: { plan: string; status: string; trialEndsAt: string | null } | null;
  profile: { familyStatus: string | null; hasChildren: boolean } | null;
  _count: { addresses: number; services: number; serviceNotes: number; movingPlans: number };
}

interface UserStats {
  totalAll: number;
  newThisWeek: number;
  weeklyTrend: number;
  activeSubCount: number;
  planMap: Record<string, number>;
}

const PLAN_COLORS: Record<string, string> = {
  FREE_TRIAL: "bg-tone-honey-bg text-tone-honey-fg",
  INDIVIDUAL: "bg-tone-sky-bg text-tone-sky-fg",
  FAMILY: "bg-tone-foil-bg text-tone-foil-fg",
  PRO: "bg-tone-rose-bg text-tone-rose-fg",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-tone-sage-bg text-tone-sage-fg",
  TRIALING: "bg-tone-cyan-bg text-tone-cyan-fg",
  CANCELED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-tone-slate-bg text-muted-foreground",
  BLOCKED: "bg-destructive/10 text-destructive",
};

// `status` is modelled as a filter so it is URL-synced + saveable as a named
// view. The DataTablePage default-sort matches the old createdAt/desc default.
const USER_FILTERS: FilterControl[] = [
  {
    key: "status",
    label: "Account Access",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "deleted", label: "Blocked / Deleted" },
      { value: "all", label: "All" },
    ],
  },
  {
    key: "plan",
    label: "Plan",
    type: "select",
    options: [
      { value: "", label: "All Plans" },
      { value: "FREE_TRIAL", label: "Free Trial" },
      { value: "INDIVIDUAL", label: "Individual" },
      { value: "FAMILY", label: "Family" },
      { value: "PRO", label: "Pro" },
    ],
  },
  {
    key: "subStatus",
    label: "Status",
    type: "select",
    options: [
      { value: "", label: "All Status" },
      { value: "ACTIVE", label: "Active" },
      { value: "TRIALING", label: "Trialing" },
      { value: "CANCELED", label: "Canceled" },
    ],
  },
  {
    key: "hasServiceNotes",
    label: "Has Service Notes",
    type: "select",
    options: [
      { value: "", label: "Any" },
      { value: "true", label: "Yes" },
    ],
  },
  {
    key: "hasMoving",
    label: "Has Moves",
    type: "select",
    options: [
      { value: "", label: "Any" },
      { value: "true", label: "Yes" },
    ],
  },
  { key: "dateFrom", label: "From Date", type: "date" },
  { key: "dateTo", label: "To Date", type: "date" },
];

export default function UsersPage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  // Bump to force the table to refetch after a mutation (delete).
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = () => setRefreshToken((t) => t + 1);

  const [pendingDelete, setPendingDelete] = useState<
    | { type: "single"; userId: string; email: string }
    | { type: "bulk"; ids: string[]; count: number }
    | null
  >(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Captured from the bulk-action slot so a successful delete can reset the
  // table's selection after the async confirm resolves. A ref (not state)
  // avoids a render-phase setState in the render-prop.
  const clearSelectionRef = useRef<(() => void) | null>(null);

  const columns: DataTableColumn<User>[] = [
    {
      key: "user",
      label: "User",
      alwaysOn: true,
      header: "User",
      sortKey: "name",
      cell: (user) => (
        <div className="min-w-0 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-foreground text-sm truncate">
                {user.firstName} {user.lastName}
              </p>
              <TierStamp plan={user.subscription?.plan} />
            </div>
            <p className="text-xs text-muted-foreground truncate">{maskEmail(user.email)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      cell: (user) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PLAN_COLORS[user.subscription?.plan || "FREE_TRIAL"] || "bg-muted text-muted-foreground"}`}>
          {user.subscription?.plan || "FREE_TRIAL"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      cell: (user) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[user.deletedAt ? "BLOCKED" : user.subscription?.status || ""] || "bg-muted text-muted-foreground"}`}>
          {user.deletedAt ? "BLOCKED" : user.subscription?.status || "—"}
        </span>
      ),
    },
    {
      key: "health",
      label: "Health",
      defaultVisible: true,
      cell: (user) => {
        const h = computeUserHealth({
          lastLoginAt: user.lastActivityAt,
          subscriptionStatus: user.subscription?.status ?? null,
          addresses: user._count.addresses,
          services: user._count.services,
          blocked: Boolean(user.deletedAt),
        });
        return <HealthPill tone={h.tone} label={h.label} title={h.detail} />;
      },
    },
    {
      key: "addresses",
      label: "Addresses",
      header: "Addr",
      align: "center",
      defaultVisible: true,
      cell: (user) => <span className="text-sm text-foreground">{user._count.addresses}</span>,
    },
    {
      key: "services",
      label: "Services",
      header: "Svc",
      align: "center",
      defaultVisible: true,
      cell: (user) => <span className="text-sm text-foreground">{user._count.services}</span>,
    },
    {
      key: "serviceNotes",
      label: "Service Notes",
      header: "Notes",
      align: "center",
      defaultVisible: false,
      cell: (user) => <span className="text-sm text-foreground">{user._count.serviceNotes}</span>,
    },
    {
      key: "moves",
      label: "Moves",
      align: "center",
      defaultVisible: true,
      cell: (user) => <span className="text-sm text-foreground">{user._count.movingPlans}</span>,
    },
    {
      key: "joined",
      label: "Joined",
      sortKey: "createdAt",
      cell: (user) => (
        <span className="text-xs text-muted-foreground">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "deletedAt",
      label: "Blocked/Deleted",
      header: "Blocked / Deleted",
      defaultVisible: true,
      cell: (user) => (
        <span className="text-xs text-muted-foreground">
          {user.deletedAt ? new Date(user.deletedAt).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  function openExport() {
    setExportError(null);
    setExportOpen(true);
  }

  async function confirmExport(_password: string, stepUp: StepUpValues) {
    // Server-side export at /api/users/export — handles permission,
    // step-up password confirm, email masking (full email only for
    // SUPER_ADMIN), CSV-injection escaping, audit logging, and the
    // 50k row cap. The previous in-page Blob path leaked unmasked
    // emails to anyone with browser access to this page and silently
    // truncated to whatever was loaded into React state.
    setExportBusy(true);
    setExportError(null);
    try {
      const res = await fetch("/api/users/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepUp),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setExportError(data?.error || `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
      setExportOpen(false);
    } catch {
      setExportError("Export failed");
    } finally {
      setExportBusy(false);
    }
  }

  async function confirmDelete(_confirmPassword: string, stepUp: StepUpValues) {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res =
        pendingDelete.type === "single"
          ? await fetch(`/api/users/${pendingDelete.userId}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(stepUp),
            })
          : await fetch("/api/users", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: pendingDelete.ids, ...stepUp }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Delete failed";
        setDeleteError(message);
        toast.error(message);
        return;
      }
      toast.success(data.message || "User deleted");
      if (Array.isArray(data.skipped) && data.skipped.length > 0) {
        const preview = data.skipped
          .slice(0, 2)
          .map((item: any) => item.reason)
          .join("; ");
        toast.warning(`${data.skipped.length} skipped${preview ? `: ${preview}` : ""}`);
      }
      setPendingDelete(null);
      clearSelectionRef.current?.();
      refresh();
    } catch {
      setDeleteError("Delete failed");
      toast.error("Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <DataTablePage<User>
        eyebrow="People"
        title="<em>Users</em>"
        subtitle={(total) => `${total} user${total !== 1 ? "s" : ""} found`}
        storageKey="admin.users"
        columnsVersion={4}
        columns={columns}
        filters={USER_FILTERS}
        defaultSortBy="createdAt"
        defaultSortDir="desc"
        perPage={20}
        searchPlaceholder="Search by name or email..."
        selectable
        isRowSelectable={(u) => !u.deletedAt}
        emptyIcon={Users}
        emptyTitle="No users found"
        emptyDescription={(hasQuery) =>
          hasQuery
            ? "No users match your current search and filters."
            : "No users have signed up yet."
        }
        refreshToken={refreshToken}
        fetcher={async ({ params, signal }) => {
          // Default the status filter to "active" when unset so the list
          // hides soft-deleted users by default — matching the old page.
          if (!params.get("status")) params.set("status", "active");
          const res = await fetch(`/api/users?${params}`, { signal });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(typeof data?.error === "string" ? data.error : "Failed to fetch users");
          }
          if (data.stats) setStats(data.stats);
          return { rows: data.users || [], total: data.total || 0 };
        }}
        headerActions={() => (
          <button
            onClick={openExport}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        )}
        beforeTable={() => (stats ? <UserKpiCards stats={stats} /> : null)}
        bulkActions={(ctx: BulkContext<User>) => {
          // Capture the table's clear-selection so a successful delete can
          // reset it after the async confirm resolves.
          clearSelectionRef.current = ctx.clear;
          return (
            <>
              <button
                onClick={() => {
                  setDeleteError(null);
                  setPendingDelete({ type: "bulk", ids: ctx.selectedIds, count: ctx.count });
                }}
                className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <button
                onClick={openExport}
                className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </>
          );
        }}
        rowActions={(user) => (
          <>
            <button
              onClick={() => window.location.assign(`/users/${user.id}`)}
              aria-label="View user details"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </button>
            {!user.deletedAt ? (
              <button
                onClick={() => {
                  setDeleteError(null);
                  setPendingDelete({ type: "single", userId: user.id, email: user.email });
                }}
                aria-label="Delete user"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Delete user"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </>
        )}
      />

      <PasswordConfirmModal
        open={Boolean(pendingDelete)}
        title={pendingDelete?.type === "bulk" ? "Delete users" : "Delete user"}
        description={
          pendingDelete?.type === "bulk"
            ? `This removes ${pendingDelete.count} selected users from the active list and queues staged GDPR cleanup. Enter your admin password to continue.`
            : pendingDelete
              ? `This removes ${maskEmail(pendingDelete.email)} from the active list and queues staged GDPR cleanup. Enter your admin password to continue.`
              : ""
        }
        confirmLabel="Delete"
        busy={deleteBusy}
        error={deleteError}
        onClose={() => {
          if (!deleteBusy) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
        onConfirm={confirmDelete}
      />
      <PasswordConfirmModal
        open={exportOpen}
        title="Export users CSV"
        description="The export contains user PII (emails, plan status). Enter your admin password to continue. This action is audit-logged."
        confirmLabel="Export"
        busy={exportBusy}
        error={exportError}
        onClose={() => {
          if (!exportBusy) {
            setExportOpen(false);
            setExportError(null);
          }
        }}
        onConfirm={confirmExport}
      />
    </>
  );
}

/** KPI cards — same data, foil hairline + Fraunces values (unchanged). */
function UserKpiCards({ stats }: { stats: UserStats }) {
  const entries = Object.entries(stats.planMap || {}) as [string, number][];
  const planTotal = entries.reduce((sum, [, count]) => sum + count, 0) || 1;
  const barClass = (plan: string) =>
    plan === "INDIVIDUAL"
      ? "bg-tone-sky-fg"
      : plan === "FAMILY"
        ? "bg-tone-foil-fg"
        : plan === "PRO"
          ? "bg-tone-rose-fg"
          : "bg-tone-honey-fg";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="kpi-foil rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="kpi-label">Total Users</p>
            <p className="kpi-value mt-2 text-foreground">{stats.totalAll}</p>
          </div>
          <div className="rounded-lg bg-tone-sky-bg p-2.5"><Users className="h-5 w-5 text-tone-sky-fg" /></div>
        </div>
      </div>
      <div className="kpi-foil rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="kpi-label">New This Week</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="kpi-value text-foreground">{stats.newThisWeek}</span>
              {stats.weeklyTrend !== 0 && (
                <span className={`text-xs font-medium ${stats.weeklyTrend > 0 ? "text-tone-sage-fg" : "text-destructive"}`}>
                  {stats.weeklyTrend > 0 ? "+" : ""}{stats.weeklyTrend}%
                </span>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-tone-sage-bg p-2.5"><UserPlus className="h-5 w-5 text-tone-sage-fg" /></div>
        </div>
      </div>
      <div className="kpi-foil rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="kpi-label">Active Subscriptions</p>
            <p className="kpi-value mt-2 text-foreground">{stats.activeSubCount}</p>
          </div>
          <div className="rounded-lg bg-tone-foil-bg p-2.5"><CreditCard className="h-5 w-5 text-tone-foil-fg" /></div>
        </div>
      </div>
      <div className="kpi-foil rounded-2xl border border-border bg-card p-4">
        <p className="kpi-label mb-2">Plan Distribution</p>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {entries.map(([plan, count]) => (
            <div
              key={plan}
              className={barClass(plan)}
              style={{ width: `${(count / planTotal) * 100}%` }}
              title={`${plan}: ${count}`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {entries.map(([plan, count]) => (
            <span key={plan} className="inline-flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${barClass(plan)}`} />
              {plan}: <span className="font-medium text-foreground">{count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

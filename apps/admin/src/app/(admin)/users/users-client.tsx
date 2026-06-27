"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Eye, Trash2, Users, UserPlus, CreditCard, Download,
  CalendarDays, Clock, ExternalLink, FileText, MapPin, Truck, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  DataTablePage,
  type DataTableColumn,
  type FilterControl,
  type BulkContext,
  type DataTableContext,
} from "@/components/data-table-page";
import { MinistatStrip } from "@/components/ministat-strip";
import {
  QuickDrawer,
  QuickDrawerRow,
  QuickDrawerSection,
} from "@/components/quick-drawer";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
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

// Segmented plan chips above the table. They drive the SAME `plan` URL param
// the filter panel already reads, so chips, panel, saved views, and the
// server fetch all stay in sync through useTableQuery.
const PLAN_CHIPS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "FAMILY", label: "Family" },
  { value: "PRO", label: "Pro" },
  { value: "FREE_TRIAL", label: "Free" },
];

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

export default function UsersClient() {
  const [stats, setStats] = useState<UserStats | null>(null);
  // Bump to force the table to refetch after a mutation (delete).
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = () => setRefreshToken((t) => t + 1);

  // Quick-look drawer — renders the row's already-fetched data (no new
  // fetch) and deep-links to the full /users/[id] profile route.
  const [quickLook, setQuickLook] = useState<User | null>(null);

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
            <p className="font-medium text-foreground text-sm truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{maskEmail(user.email)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      cell: (user) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${PLAN_COLORS[user.subscription?.plan || "FREE_TRIAL"] || "bg-muted text-muted-foreground"}`}>
          {user.subscription?.plan || "FREE_TRIAL"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      cell: (user) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[user.deletedAt ? "BLOCKED" : user.subscription?.status || ""] || "bg-muted text-muted-foreground"}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
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
      cell: (user) => <span className="font-mono text-sm text-foreground">{user._count.addresses}</span>,
    },
    {
      key: "services",
      label: "Services",
      header: "Svc",
      align: "center",
      defaultVisible: true,
      cell: (user) => <span className="font-mono text-sm text-foreground">{user._count.services}</span>,
    },
    {
      key: "serviceNotes",
      label: "Service Notes",
      header: "Notes",
      align: "center",
      defaultVisible: false,
      cell: (user) => <span className="font-mono text-sm text-foreground">{user._count.serviceNotes}</span>,
    },
    {
      key: "moves",
      label: "Moves",
      align: "center",
      defaultVisible: true,
      cell: (user) => <span className="font-mono text-sm text-foreground">{user._count.movingPlans}</span>,
    },
    {
      key: "joined",
      label: "Joined",
      sortKey: "createdAt",
      cell: (user) => (
        <span className="font-mono text-xs text-muted-foreground">
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
        <span className="font-mono text-xs text-muted-foreground">
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
        onRowActivate={(u) => setQuickLook(u)}
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
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        )}
        beforeTable={(ctx: DataTableContext<User>) => (
          <div className="space-y-4">
            {stats ? <UserMinistats stats={stats} /> : null}
            <div className="au-chips" role="group" aria-label="Filter by plan">
              {PLAN_CHIPS.map((chip) => (
                <button
                  key={chip.value || "all"}
                  type="button"
                  className={
                    (ctx.query.state.filters.plan || "") === chip.value ? "on" : ""
                  }
                  aria-pressed={(ctx.query.state.filters.plan || "") === chip.value}
                  onClick={() => ctx.query.setFilter("plan", chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
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
                className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <button
                onClick={openExport}
                className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </>
          );
        }}
        rowActions={(user) => (
          <>
            <button
              onClick={() => setQuickLook(user)}
              aria-label="Quick look"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Quick look"
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

      <UserQuickLook user={quickLook} onClose={() => setQuickLook(null)} />

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

/**
 * Ministat strip — same already-computed server aggregates as the old KPI
 * cards (totalAll / newThisWeek+trend / activeSubCount / planMap), rendered
 * in the F3-E corporate ministat idiom. The 4th card folds the plan map into
 * a paid-plan total with the per-plan mix as its sublabel.
 */
function UserMinistats({ stats }: { stats: UserStats }) {
  const planMap = stats.planMap || {};
  const paid =
    (planMap.INDIVIDUAL || 0) + (planMap.FAMILY || 0) + (planMap.PRO || 0);
  const mix = `${planMap.INDIVIDUAL || 0} ind · ${planMap.FAMILY || 0} fam · ${planMap.PRO || 0} pro`;
  return (
    <MinistatStrip
      items={[
        {
          key: "total",
          icon: Users,
          label: "Total users",
          value: stats.totalAll.toLocaleString(),
          tone: "cool",
        },
        {
          key: "new",
          icon: UserPlus,
          label: "New this week",
          value: stats.newThisWeek.toLocaleString(),
          delta:
            stats.weeklyTrend !== 0
              ? `${stats.weeklyTrend > 0 ? "+" : ""}${stats.weeklyTrend}%`
              : undefined,
          deltaDir: stats.weeklyTrend < 0 ? "down" : "up",
          sub: stats.weeklyTrend !== 0 ? "vs prior week" : undefined,
          tone: "mint",
        },
        {
          key: "subs",
          icon: CreditCard,
          label: "Active subscriptions",
          value: stats.activeSubCount.toLocaleString(),
          tone: "family",
        },
        {
          key: "paid",
          icon: Wallet,
          label: "Paid plans",
          value: paid.toLocaleString(),
          sub: mix,
          tone: "slate",
        },
      ]}
    />
  );
}

/**
 * Quick-look drawer for a user row. Strictly renders the row data the list
 * already holds — the "Open profile" footer action deep-links to the full
 * /users/[id] route, which remains the canonical detail surface.
 */
function UserQuickLook({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  if (!user) return null;
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const masked = maskEmail(user.email);
  const initials =
    `${(user.firstName ?? "").trim().charAt(0)}${(user.lastName ?? "").trim().charAt(0)}`.toUpperCase() ||
    user.email.charAt(0).toUpperCase();
  const plan = user.subscription?.plan || "FREE_TRIAL";
  const status = user.deletedAt ? "BLOCKED" : user.subscription?.status || "—";
  const health = computeUserHealth({
    lastLoginAt: user.lastActivityAt,
    subscriptionStatus: user.subscription?.status ?? null,
    addresses: user._count.addresses,
    services: user._count.services,
    blocked: Boolean(user.deletedAt),
  });
  return (
    <QuickDrawer
      open
      onClose={onClose}
      eyebrow="Customer"
      title={name || masked}
      subtitle={masked}
      initials={initials}
      tone="cool"
      meta={
        <>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PLAN_COLORS[plan] || "bg-muted text-muted-foreground"}`}
          >
            {plan.replace("_", " ")}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[user.deletedAt ? "BLOCKED" : user.subscription?.status || ""] || "bg-muted text-muted-foreground"}`}
          >
            {status}
          </span>
          <HealthPill tone={health.tone} label={health.label} title={health.detail} />
        </>
      }
      stats={[
        { value: user._count.addresses, label: "addresses" },
        { value: user._count.services, label: "services" },
        { value: user._count.movingPlans, label: "moves" },
      ]}
      footer={
        <>
          <Link href={`/users/${user.id}`} className="au-qbtn pri">
            <ExternalLink aria-hidden="true" />
            Open profile
          </Link>
          <button type="button" className="au-qbtn ghost" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <QuickDrawerSection title="Plan & billing">
        <QuickDrawerRow
          icon={CreditCard}
          tone="cool"
          title={plan.replace("_", " ")}
          sub={`Status · ${status}${
            user.subscription?.trialEndsAt
              ? ` · trial ends ${new Date(user.subscription.trialEndsAt).toLocaleDateString()}`
              : ""
          }`}
        />
        {user._count.movingPlans > 0 ? (
          <QuickDrawerRow
            icon={Truck}
            tone="family"
            title={`${user._count.movingPlans} moving plan${user._count.movingPlans === 1 ? "" : "s"}`}
            sub="Across this account"
          />
        ) : null}
      </QuickDrawerSection>
      <QuickDrawerSection title="Activity">
        <QuickDrawerRow
          icon={CalendarDays}
          tone="mint"
          title={`Joined ${new Date(user.createdAt).toLocaleDateString()}`}
          sub={
            user.deletedAt
              ? `Blocked / deleted ${new Date(user.deletedAt).toLocaleDateString()}`
              : undefined
          }
        />
        <QuickDrawerRow
          icon={Clock}
          tone="slate"
          title={
            user.lastActivityAt
              ? `Last active ${new Date(user.lastActivityAt).toLocaleDateString()}`
              : "No recorded activity"
          }
          sub={health.detail}
        />
        <QuickDrawerRow
          icon={MapPin}
          tone="cool"
          title={`${user._count.addresses} address${user._count.addresses === 1 ? "" : "es"} · ${user._count.services} service${user._count.services === 1 ? "" : "s"}`}
          sub="Linked to this account"
        />
        {user._count.serviceNotes > 0 ? (
          <QuickDrawerRow
            icon={FileText}
            tone="slate"
            title={`${user._count.serviceNotes} service note${user._count.serviceNotes === 1 ? "" : "s"}`}
            sub="Personal reviews on services"
          />
        ) : null}
      </QuickDrawerSection>
    </QuickDrawer>
  );
}

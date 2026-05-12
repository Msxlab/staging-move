"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, ChevronLeft, ChevronRight, Eye, Trash2, Users, UserPlus,
  CreditCard, Filter, X, Download, ArrowUpDown,
  ChevronDown, ChevronUp, CheckSquare, Square,
} from "lucide-react";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ColumnSettingsMenu } from "@/components/column-settings-menu";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
import { TierStamp } from "@/components/premium/tier-stamp";
import { HealthPill } from "@/components/premium/health-pill";
import { computeUserHealth } from "@/lib/user-health";
import { maskEmail } from "@/lib/privacy";
import { AdminPageHeader } from "@/components/admin-page-header";

// Health column is on by default — support team's #1 ask. Sticker is part
// of the "user" cell, not its own column, so it always rides next to the
// user's name.
const USER_COLUMNS = [
  { key: "user", label: "User", alwaysOn: true },
  { key: "plan", label: "Plan" },
  { key: "status", label: "Status" },
  { key: "health", label: "Health", defaultVisible: true },
  { key: "addresses", label: "Addresses", defaultVisible: true },
  { key: "services", label: "Services", defaultVisible: true },
  { key: "reviews", label: "Reviews", defaultVisible: false },
  { key: "moves", label: "Moves", defaultVisible: true },
  { key: "joined", label: "Joined" },
  { key: "deletedAt", label: "Blocked/Deleted", defaultVisible: true },
  { key: "actions", label: "Actions", alwaysOn: true },
];

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
  _count: { addresses: number; services: number; providerReviews: number; movingPlans: number };
}

const PLAN_COLORS: Record<string, string> = {
  FREE_TRIAL: "bg-tone-honey-bg text-tone-honey-fg",
  INDIVIDUAL: "bg-tone-sky-bg text-tone-sky-fg",
  FAMILY: "bg-tone-foil-bg text-tone-foil-fg",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-tone-sage-bg text-tone-sage-fg",
  TRIALING: "bg-tone-cyan-bg text-tone-cyan-fg",
  CANCELED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-tone-slate-bg text-muted-foreground",
  BLOCKED: "bg-destructive/10 text-destructive",
};

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const selectableUsers = users.filter((user) => !user.deletedAt);
  const bulk = useBulkSelection(selectableUsers);
  const cols = useColumnVisibility({
    storageKey: "admin.users.cols",
    // Bump version when adding columns so the saved defaults migrate.
    version: 3,
    columns: USER_COLUMNS,
  });
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [accountStatus, setAccountStatus] = useState<"active" | "deleted" | "all">("active");
  const [filters, setFilters] = useState({ plan: "", subStatus: "", hasReviews: "", hasMoving: "", dateFrom: "", dateTo: "" });
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "single"; userId: string; email: string }
    | { type: "bulk"; count: number }
    | null
  >(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const perPage = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), perPage: String(perPage),
        search, sortBy, sortDir,
        status: accountStatus,
      });
      if (filters.plan) params.set("plan", filters.plan);
      if (filters.subStatus) params.set("subStatus", filters.subStatus);
      if (filters.hasReviews) params.set("hasReviews", filters.hasReviews);
      if (filters.hasMoving) params.set("hasMoving", filters.hasMoving);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      if (data.stats) setStats(data.stats);
    } catch { toast.error("Failed to fetch users"); }
    finally { setLoading(false); }
  }, [page, search, sortBy, sortDir, accountStatus, filters]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (accountStatus !== "active" ? 1 : 0);

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="ml-1 inline h-3 w-3" /> : <ChevronDown className="ml-1 inline h-3 w-3" />;
  }

  function handleDelete(userId: string, email: string) {
    setDeleteError(null);
    setPendingDelete({ type: "single", userId, email });
  }

  function handleBulkDelete() {
    if (bulk.count === 0) return;
    setDeleteError(null);
    setPendingDelete({ type: "bulk", count: bulk.count });
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
              body: JSON.stringify({ ids: bulk.selectedIds, ...stepUp }),
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
      bulk.clear();
      fetchUsers();
    } catch {
      setDeleteError("Delete failed");
      toast.error("Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

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

  function clearFilters() {
    setFilters({ plan: "", subStatus: "", hasReviews: "", hasMoving: "", dateFrom: "", dateTo: "" });
    setAccountStatus("active");
    bulk.clear();
    setPage(1);
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="People"
        title="<em>Users</em>"
        subtitle={`${total} user${total !== 1 ? "s" : ""} found`}
        actions={
          <>
            <ColumnSettingsMenu
              columns={cols.columns}
              onToggle={cols.toggle}
              onReset={cols.reset}
              hiddenCount={cols.hiddenCount}
            />
            <button onClick={openExport} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
              <Download className="h-3.5 w-3.5" /> Export{bulk.count > 0 ? ` (${bulk.count})` : ""}
            </button>
          </>
        }
      />

      {/* KPI Cards — same data, foil hairline + Fraunces values */}
      {stats && (
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
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.planMap || {}).map(([plan, count]) => (
                <button key={plan} onClick={() => { setFilters({ ...filters, plan: filters.plan === plan ? "" : plan }); setPage(1); }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${filters.plan === plan ? "bg-primary text-primary-foreground" : PLAN_COLORS[plan] || "bg-muted text-muted-foreground"}`}>
                  {plan}: {count as number}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Account Access</label>
              <select
                value={accountStatus}
                onChange={(e) => {
                  setAccountStatus(e.target.value as "active" | "deleted" | "all");
                  bulk.clear();
                  setPage(1);
                }}
                className={inputCls}
              >
                <option value="active">Active</option>
                <option value="deleted">Blocked / Deleted</option>
                <option value="all">All</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Plan</label>
              <select value={filters.plan} onChange={(e) => { setFilters({ ...filters, plan: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">All Plans</option>
                <option value="FREE_TRIAL">Free Trial</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="FAMILY">Family</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Status</label>
              <select value={filters.subStatus} onChange={(e) => { setFilters({ ...filters, subStatus: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIALING">Trialing</option>
                <option value="CANCELED">Canceled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Has Reviews</label>
              <select value={filters.hasReviews} onChange={(e) => { setFilters({ ...filters, hasReviews: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">Any</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Has Moves</label>
              <select value={filters.hasMoving} onChange={(e) => { setFilters({ ...filters, hasMoving: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">Any</option>
                <option value="true">Yes</option>
              </select>
            </div>
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

      {/* Bulk Actions */}
      {bulk.count > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{bulk.count} selected</span>
          <div className="h-4 w-px bg-border" />
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={openExport} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={bulk.clear} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear selection</button>
        </div>
      )}

      {/* Table — admin-panel chrome (foil hairline + warm hover) */}
      <div className="admin-panel overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-3 text-left">
                <button onClick={bulk.toggleAll} className="text-muted-foreground hover:text-foreground">
                  {bulk.allVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </button>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground cursor-pointer" onClick={() => toggleSort("name")}>
                User <SortIcon col="name" />
              </th>
              {cols.isVisible("plan") && <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Plan</th>}
              {cols.isVisible("status") && <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>}
              {cols.isVisible("health") && <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Health</th>}
              {cols.isVisible("addresses") && <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Addr</th>}
              {cols.isVisible("services") && <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Svc</th>}
              {cols.isVisible("reviews") && <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Rev</th>}
              {cols.isVisible("moves") && <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Moves</th>}
              {cols.isVisible("joined") && (
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground cursor-pointer" onClick={() => toggleSort("createdAt")}>
                  Joined <SortIcon col="createdAt" />
                </th>
              )}
              {cols.isVisible("deletedAt") && <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Blocked / Deleted</th>}
              <th className="px-3 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(() => {
              // +1 for the bulk-select checkbox column which sits outside the
              // user-configurable column set.
              const visibleColCount = cols.columns.filter((c) => c.visible).length + 1;
              if (loading) {
                return <tr><td colSpan={visibleColCount} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>;
              }
              if (users.length === 0) {
                return <tr><td colSpan={visibleColCount} className="px-4 py-12 text-center text-muted-foreground">No users found</td></tr>;
              }
              return null;
            })()}
            {!loading && users.length > 0 && (
              users.map((user) => (
                <tr key={user.id} className={`bg-card transition-colors ${bulk.isSelected(user.id) ? "bg-primary/5" : "hover:bg-accent/50"}`}>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => !user.deletedAt && bulk.toggle(user.id)}
                      disabled={Boolean(user.deletedAt)}
                      className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {bulk.isSelected(user.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="min-w-0 flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-foreground text-sm truncate">{user.firstName} {user.lastName}</p>
                          <TierStamp plan={user.subscription?.plan} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{maskEmail(user.email)}</p>
                      </div>
                    </div>
                  </td>
                  {cols.isVisible("plan") && (
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PLAN_COLORS[user.subscription?.plan || "FREE_TRIAL"] || "bg-muted text-muted-foreground"}`}>
                        {user.subscription?.plan || "FREE_TRIAL"}
                      </span>
                    </td>
                  )}
                  {cols.isVisible("status") && (
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[user.deletedAt ? "BLOCKED" : user.subscription?.status || ""] || "bg-muted text-muted-foreground"}`}>
                        {user.deletedAt ? "BLOCKED" : user.subscription?.status || "—"}
                      </span>
                    </td>
                  )}
                  {cols.isVisible("health") && (
                    <td className="px-3 py-3">
                      {(() => {
                        const h = computeUserHealth({
                          lastLoginAt: user.lastActivityAt,
                          subscriptionStatus: user.subscription?.status ?? null,
                          addresses: user._count.addresses,
                          services: user._count.services,
                          blocked: Boolean(user.deletedAt),
                        });
                        return <HealthPill tone={h.tone} label={h.label} title={h.detail} />;
                      })()}
                    </td>
                  )}
                  {cols.isVisible("addresses") && <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.addresses}</td>}
                  {cols.isVisible("services") && <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.services}</td>}
                  {cols.isVisible("reviews") && <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.providerReviews}</td>}
                  {cols.isVisible("moves") && <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.movingPlans}</td>}
                  {cols.isVisible("joined") && <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>}
                  {cols.isVisible("deletedAt") && (
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {user.deletedAt ? new Date(user.deletedAt).toLocaleString() : "—"}
                    </td>
                  )}
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => router.push(`/users/${user.id}`)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="View details">
                        <Eye className="h-4 w-4" />
                      </button>
                      {!user.deletedAt && (
                        <button onClick={() => handleDelete(user.id, user.email)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete user">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm text-muted-foreground">Page {page} / {totalPages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
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
    </div>
  );
}

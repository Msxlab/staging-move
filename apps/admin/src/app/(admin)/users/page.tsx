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
import { PasswordConfirmModal } from "@/components/password-confirm-modal";
import { maskEmail } from "@/lib/privacy";

const USER_COLUMNS = [
  { key: "user", label: "User", alwaysOn: true },
  { key: "plan", label: "Plan" },
  { key: "status", label: "Status" },
  { key: "addresses", label: "Addresses", defaultVisible: true },
  { key: "services", label: "Services", defaultVisible: true },
  { key: "reviews", label: "Reviews", defaultVisible: false },
  { key: "moves", label: "Moves", defaultVisible: true },
  { key: "joined", label: "Joined" },
  { key: "actions", label: "Actions", alwaysOn: true },
];

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  subscription: { plan: string; status: string; trialEndsAt: string | null } | null;
  profile: { familyStatus: string | null; hasChildren: boolean } | null;
  _count: { addresses: number; services: number; providerReviews: number; movingPlans: number };
}

const PLAN_COLORS: Record<string, string> = {
  FREE_TRIAL: "bg-yellow-500/10 text-yellow-500",
  INDIVIDUAL: "bg-blue-500/10 text-blue-500",
  FAMILY: "bg-purple-500/10 text-purple-500",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-500/10 text-green-500",
  TRIALING: "bg-cyan-500/10 text-cyan-500",
  CANCELED: "bg-red-500/10 text-red-500",
  EXPIRED: "bg-gray-500/10 text-gray-400",
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
  const bulk = useBulkSelection(users);
  const cols = useColumnVisibility({
    storageKey: "admin.users.cols",
    version: 1,
    columns: USER_COLUMNS,
  });
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [filters, setFilters] = useState({ plan: "", subStatus: "", hasReviews: "", hasMoving: "", dateFrom: "", dateTo: "" });
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "single"; userId: string; email: string }
    | { type: "bulk"; count: number }
    | null
  >(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const perPage = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), perPage: String(perPage),
        search, sortBy, sortDir,
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
  }, [page, search, sortBy, sortDir, filters]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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

  async function confirmDelete(confirmPassword: string) {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res =
        pendingDelete.type === "single"
          ? await fetch(`/api/users/${pendingDelete.userId}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ confirmPassword }),
            })
          : await fetch("/api/users", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: bulk.selectedIds, confirmPassword }),
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

  function exportCSV() {
    const header = "ID,Email,First Name,Last Name,Plan,Status,Addresses,Services,Reviews,Moves,Joined";
    const rows = users.filter((u) => bulk.count === 0 || bulk.isSelected(u.id)).map((u) =>
      `${u.id},${u.email},${u.firstName || ""},${u.lastName || ""},${u.subscription?.plan || "FREE_TRIAL"},${u.subscription?.status || ""},${u._count.addresses},${u._count.services},${u._count.providerReviews},${u._count.movingPlans},${new Date(u.createdAt).toISOString().split("T")[0]}`
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "users.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} users`);
  }

  function clearFilters() {
    setFilters({ plan: "", subStatus: "", hasReviews: "", hasMoving: "", dateFrom: "", dateTo: "" });
    setPage(1);
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Users</h1>
          <p className="mt-1 text-muted-foreground">{total} user{total !== 1 ? "s" : ""} found</p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnSettingsMenu
            columns={cols.columns}
            onToggle={cols.toggle}
            onReset={cols.reset}
            hiddenCount={cols.hiddenCount}
          />
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
            <Download className="h-3.5 w-3.5" /> Export{bulk.count > 0 ? ` (${bulk.count})` : ""}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Users</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{stats.totalAll}</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2.5"><Users className="h-5 w-5 text-blue-500" /></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">New This Week</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold text-foreground">{stats.newThisWeek}</span>
                  {stats.weeklyTrend !== 0 && (
                    <span className={`text-xs font-medium ${stats.weeklyTrend > 0 ? "text-green-500" : "text-red-500"}`}>
                      {stats.weeklyTrend > 0 ? "+" : ""}{stats.weeklyTrend}%
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-green-500/10 p-2.5"><UserPlus className="h-5 w-5 text-green-500" /></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Subscriptions</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{stats.activeSubCount}</p>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-2.5"><CreditCard className="h-5 w-5 text-purple-500" /></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Plan Distribution</p>
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
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={bulk.clear} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear selection</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
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
              {cols.isVisible("addresses") && <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Addr</th>}
              {cols.isVisible("services") && <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Svc</th>}
              {cols.isVisible("reviews") && <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Rev</th>}
              {cols.isVisible("moves") && <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Moves</th>}
              {cols.isVisible("joined") && (
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground cursor-pointer" onClick={() => toggleSort("createdAt")}>
                  Joined <SortIcon col="createdAt" />
                </th>
              )}
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
                    <button onClick={() => bulk.toggle(user.id)} className="text-muted-foreground hover:text-foreground">
                      {bulk.isSelected(user.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{maskEmail(user.email)}</p>
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
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[user.subscription?.status || ""] || "bg-muted text-muted-foreground"}`}>
                        {user.subscription?.status || "—"}
                      </span>
                    </td>
                  )}
                  {cols.isVisible("addresses") && <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.addresses}</td>}
                  {cols.isVisible("services") && <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.services}</td>}
                  {cols.isVisible("reviews") && <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.providerReviews}</td>}
                  {cols.isVisible("moves") && <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.movingPlans}</td>}
                  {cols.isVisible("joined") && <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>}
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => router.push(`/users/${user.id}`)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="View details">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(user.id, user.email)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete user">
                        <Trash2 className="h-4 w-4" />
                      </button>
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
    </div>
  );
}

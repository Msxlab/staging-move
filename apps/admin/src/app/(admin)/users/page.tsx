"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, ChevronLeft, ChevronRight, Eye, Trash2, Users, UserPlus,
  CreditCard, TrendingUp, Filter, X, Download, ArrowUpDown,
  ChevronDown, ChevronUp, Star, FileText, Truck, CheckSquare, Square,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  subscription: { plan: string; status: string; trialEndsAt: string | null } | null;
  profile: { lastActiveDate: string | null; totalPoints: number } | null;
  _count: { addresses: number; services: number; reviews: number; documents: number; movingPlans: number };
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [filters, setFilters] = useState({ plan: "", subStatus: "", hasReviews: "", hasMoving: "", hasDocs: "", dateFrom: "", dateTo: "" });
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
      if (filters.hasDocs) params.set("hasDocs", filters.hasDocs);
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

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSelectAll() {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  }

  async function handleDelete(userId: string, email: string) {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Failed to delete user"); return; }
      toast.success(data.message || "User deletion queued");
      setSelected((prev) => { const n = new Set(prev); n.delete(userId); return n; });
      fetchUsers();
    } catch { toast.error("Failed to delete user"); }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} users? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Bulk delete failed"); return; }
      toast.success(data.message || `${selected.size} user deletion request(s) queued`);
      setSelected(new Set());
      fetchUsers();
    } catch { toast.error("Bulk delete failed"); }
  }

  function exportCSV() {
    const header = "ID,Email,First Name,Last Name,Plan,Status,Addresses,Services,Reviews,Documents,Moves,Joined";
    const rows = users.filter((u) => selected.size === 0 || selected.has(u.id)).map((u) =>
      `${u.id},${u.email},${u.firstName || ""},${u.lastName || ""},${u.subscription?.plan || "FREE_TRIAL"},${u.subscription?.status || ""},${u._count.addresses},${u._count.services},${u._count.reviews},${u._count.documents},${u._count.movingPlans},${new Date(u.createdAt).toISOString().split("T")[0]}`
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "users.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} users`);
  }

  function clearFilters() {
    setFilters({ plan: "", subStatus: "", hasReviews: "", hasMoving: "", hasDocs: "", dateFrom: "", dateTo: "" });
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
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
            <Download className="h-3.5 w-3.5" /> Export{selected.size > 0 ? ` (${selected.size})` : ""}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Has Docs</label>
              <select value={filters.hasDocs} onChange={(e) => { setFilters({ ...filters, hasDocs: e.target.value }); setPage(1); }} className={inputCls}>
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
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{selected.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear selection</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-3 text-left">
                <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                  {selected.size === users.length && users.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </button>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground cursor-pointer" onClick={() => toggleSort("name")}>
                User <SortIcon col="name" />
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Plan</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Addr</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Svc</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Rev</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Docs</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Moves</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase text-muted-foreground cursor-pointer" onClick={() => toggleSort("createdAt")}>
                Joined <SortIcon col="createdAt" />
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">No users found</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className={`bg-card transition-colors ${selected.has(user.id) ? "bg-primary/5" : "hover:bg-accent/50"}`}>
                  <td className="px-3 py-3">
                    <button onClick={() => toggleSelect(user.id)} className="text-muted-foreground hover:text-foreground">
                      {selected.has(user.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PLAN_COLORS[user.subscription?.plan || "FREE_TRIAL"] || "bg-muted text-muted-foreground"}`}>
                      {user.subscription?.plan || "FREE_TRIAL"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[user.subscription?.status || ""] || "bg-muted text-muted-foreground"}`}>
                      {user.subscription?.status || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.addresses}</td>
                  <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.services}</td>
                  <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.reviews}</td>
                  <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.documents}</td>
                  <td className="px-3 py-3 text-center text-sm text-foreground">{user._count.movingPlans}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
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
    </div>
  );
}

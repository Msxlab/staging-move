"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, ChevronLeft, ChevronRight, CreditCard, Users, Calendar,
  TrendingUp, Filter, X, Eye, Clock, XCircle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface Sub {
  id: string;
  plan: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCurrentPeriodEnd: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
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

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState<Sub | null>(null);
  const [filters, setFilters] = useState({ plan: "", status: "", dateFrom: "", dateTo: "" });
  const perPage = 20;

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage), search });
      if (filters.plan) params.set("plan", filters.plan);
      if (filters.status) params.set("status", filters.status);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await fetch(`/api/subscriptions?${params}`);
      const data = await res.json();
      setSubs(data.subscriptions || []);
      setTotal(data.total || 0);
      if (data.stats) setStats(data.stats);
    } catch { toast.error("Failed to fetch subscriptions"); }
    finally { setLoading(false); }
  }, [page, search, filters]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const totalPages = Math.ceil(total / perPage);

  function daysUntil(date: string | null) {
    if (!date) return null;
    const d = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return d;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Subscriptions</h1>
        <p className="mt-1 text-muted-foreground">{total} subscription{total !== 1 ? "s" : ""} found</p>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{stats.totalAll}</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2"><CreditCard className="h-4 w-4 text-blue-500" /></div>
            </div>
          </div>
          <button onClick={() => { setFilters({ ...filters, status: filters.status === "ACTIVE" ? "" : "ACTIVE" }); setPage(1); }}
            className={`rounded-xl border bg-card p-4 text-left transition-all ${filters.status === "ACTIVE" ? "border-green-500/30 bg-green-500/5" : "border-border hover:border-green-500/20"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active</p>
                <p className="mt-1 text-2xl font-bold text-green-500">{stats.activeCount}</p>
              </div>
              <div className="rounded-lg bg-green-500/10 p-2"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
            </div>
          </button>
          <button onClick={() => { setFilters({ ...filters, status: filters.status === "TRIALING" ? "" : "TRIALING" }); setPage(1); }}
            className={`rounded-xl border bg-card p-4 text-left transition-all ${filters.status === "TRIALING" ? "border-cyan-500/30 bg-cyan-500/5" : "border-border hover:border-cyan-500/20"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Trialing</p>
                <p className="mt-1 text-2xl font-bold text-cyan-500">{stats.trialingCount}</p>
              </div>
              <div className="rounded-lg bg-cyan-500/10 p-2"><Clock className="h-4 w-4 text-cyan-500" /></div>
            </div>
          </button>
          <button onClick={() => { setFilters({ ...filters, status: filters.status === "CANCELED" ? "" : "CANCELED" }); setPage(1); }}
            className={`rounded-xl border bg-card p-4 text-left transition-all ${filters.status === "CANCELED" ? "border-red-500/30 bg-red-500/5" : "border-border hover:border-red-500/20"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Canceled</p>
                <p className="mt-1 text-2xl font-bold text-red-500">{stats.canceledCount}</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-2"><XCircle className="h-4 w-4 text-red-500" /></div>
            </div>
          </button>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">New This Month</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{stats.newThisMonth}</p>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-2"><TrendingUp className="h-4 w-4 text-purple-500" /></div>
            </div>
          </div>
        </div>
      )}

      {/* Plan distribution pills */}
      {stats?.planMap && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Plans:</span>
          {Object.entries(stats.planMap).map(([plan, count]) => (
            <button key={plan} onClick={() => { setFilters({ ...filters, plan: filters.plan === plan ? "" : plan }); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filters.plan === plan ? "bg-primary text-primary-foreground" : PLAN_COLORS[plan] || "bg-muted text-muted-foreground"}`}>
              {plan.replace("_", " ")} ({count as number})
            </button>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search by user name or email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${showFilters ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
          <Filter className="h-3.5 w-3.5" /> Filters {activeFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFilterCount}</span>}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={() => { setFilters({ plan: "", status: "", dateFrom: "", dateTo: "" }); setPage(1); }} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIALING">Trialing</option>
                <option value="CANCELED">Canceled</option>
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

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Trial Ends</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Period End</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
            ) : subs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No subscriptions found</td></tr>
            ) : subs.map((sub) => {
              const trialDays = daysUntil(sub.trialEndsAt);
              return (
                <tr key={sub.id} className="bg-card hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground text-sm">{sub.user.firstName} {sub.user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{sub.user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PLAN_COLORS[sub.plan] || "bg-muted text-muted-foreground"}`}>
                      {sub.plan.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[sub.status] || "bg-muted text-muted-foreground"}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {sub.trialEndsAt ? (
                      <span className={trialDays !== null && trialDays <= 3 ? "text-red-500 font-medium" : trialDays !== null && trialDays <= 7 ? "text-yellow-500" : ""}>
                        {new Date(sub.trialEndsAt).toLocaleDateString()}
                        {trialDays !== null && trialDays > 0 && <span className="ml-1">({trialDays}d)</span>}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {sub.stripeCurrentPeriodEnd ? new Date(sub.stripeCurrentPeriodEnd).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(sub.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetail(sub)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="View details">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => router.push(`/users/${sub.user.id}`)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="View user">
                        <Users className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">Subscription Detail</h2>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="font-medium text-foreground text-sm">{detail.user.firstName} {detail.user.lastName}</p>
                  <p className="text-xs text-muted-foreground">{detail.user.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailItem label="Plan" value={detail.plan.replace("_", " ")} />
                <DetailItem label="Status" value={detail.status} />
                <DetailItem label="Created" value={new Date(detail.createdAt).toLocaleDateString()} />
                <DetailItem label="Updated" value={new Date(detail.updatedAt).toLocaleDateString()} />
                <DetailItem label="Trial Ends" value={detail.trialEndsAt ? new Date(detail.trialEndsAt).toLocaleDateString() : "—"} />
                <DetailItem label="Canceled At" value={detail.canceledAt ? new Date(detail.canceledAt).toLocaleDateString() : "—"} />
                <DetailItem label="Period End" value={detail.stripeCurrentPeriodEnd ? new Date(detail.stripeCurrentPeriodEnd).toLocaleDateString() : "—"} />
                <DetailItem label="Stripe Customer" value={detail.stripeCustomerId || "—"} />
              </div>

              {detail.stripeSubscriptionId && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Stripe Subscription ID</p>
                  <p className="text-xs text-foreground font-mono break-all">{detail.stripeSubscriptionId}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setDetail(null); router.push(`/users/${detail.user.id}`); }}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  View User Profile
                </button>
                <button onClick={() => setDetail(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

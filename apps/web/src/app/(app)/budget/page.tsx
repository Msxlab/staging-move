"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, PiggyBank, Plus, X, Loader2, Calendar, BarChart3, ArrowLeft, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CardSkeleton } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import Link from "next/link";

const inputCls = "w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition";
const labelCls = "text-xs font-medium text-muted-foreground";

interface Budget {
  id: string;
  month: string;
  year: number;
  plannedIncome: number | null;
  actualIncome: number | null;
  plannedExpenses: number | null;
  actualExpenses: number;
  categoryBreakdown?: any;
  notes?: string;
  addressId?: string;
}

interface ServiceSummary { category: string; monthlyCost: number; }
interface AddressOption { id: string; nickname?: string; city: string; state: string; }

const BUDGET_CATEGORIES = [
  "Housing", "Utilities", "Insurance", "Transportation", "Groceries",
  "Healthcare", "Subscriptions", "Entertainment", "Dining Out",
  "Shopping", "Education", "Savings", "Debt Payments", "Other",
];

const catColors: Record<string, string> = {
  Housing: "bg-orange-500", Utilities: "bg-cyan-500", Insurance: "bg-amber-500",
  Transportation: "bg-emerald-500", Groceries: "bg-lime-500", Healthcare: "bg-rose-500",
  Subscriptions: "bg-indigo-500", Entertainment: "bg-pink-500", "Dining Out": "bg-orange-500",
  Shopping: "bg-teal-500", Education: "bg-blue-500", Savings: "bg-emerald-400",
  "Debt Payments": "bg-red-500", Other: "bg-foreground/30",
};

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "history">("overview");

  const now = new Date();
  const [form, setForm] = useState({
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    plannedIncome: "",
    actualIncome: "",
    plannedExpenses: "",
    actualExpenses: "",
    notes: "",
    addressId: "",
    categories: {} as Record<string, string>,
  });

  const resetForm = () => {
    const n = new Date();
    setForm({
      month: `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`,
      plannedIncome: "", actualIncome: "", plannedExpenses: "", actualExpenses: "",
      notes: "", addressId: "", categories: {},
    });
    setEditingId(null);
  };

  const fetchBudgets = () => {
    fetch("/api/budget")
      .then((res) => res.json())
      .then((data) => setBudgets(data.budgets || []))
      .catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/budget").then((r) => r.json()),
      fetch("/api/addresses").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
    ]).then(([budgetData, addrData, svcData]) => {
      setBudgets(budgetData.budgets || []);
      setAddresses(addrData.addresses || []);
      setServices((svcData.services || []).map((s: any) => ({ category: s.category, monthlyCost: s.monthlyCost || 0 })));
    }).catch(() => { toast.error("Failed to load budget data"); }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.actualExpenses && !form.plannedExpenses) {
      toast.error("Please enter at least planned or actual expenses");
      return;
    }
    setSaving(true);
    const [yearStr] = form.month.split("-");
    const payload: any = {
      month: `${form.month}-01`,
      year: parseInt(yearStr),
      actualExpenses: parseFloat(form.actualExpenses) || 0,
    };
    if (form.plannedIncome) payload.plannedIncome = parseFloat(form.plannedIncome);
    if (form.actualIncome) payload.actualIncome = parseFloat(form.actualIncome);
    if (form.plannedExpenses) payload.plannedExpenses = parseFloat(form.plannedExpenses);
    if (form.notes) payload.notes = form.notes;
    if (form.addressId) payload.addressId = form.addressId;

    const breakdown: Record<string, number> = {};
    Object.entries(form.categories).forEach(([cat, val]) => {
      const num = parseFloat(val);
      if (num > 0) breakdown[cat] = num;
    });
    if (Object.keys(breakdown).length > 0) payload.categoryBreakdown = JSON.stringify(breakdown);

    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(editingId ? "Budget updated!" : "Budget added!");
      resetForm();
      setShowForm(false);
      fetchBudgets();
    } catch {
      toast.error("Failed to save budget");
    }
    setSaving(false);
  };

  if (loading) return <CardSkeleton />;

  const totalPlanned = budgets.reduce((sum, b) => sum + (b.plannedExpenses || 0), 0);
  const totalActual = budgets.reduce((sum, b) => sum + (b.actualExpenses || 0), 0);
  const totalIncome = budgets.reduce((sum, b) => sum + (b.actualIncome || 0), 0);

  // Auto-calculated from services
  const svcMonthly = services.reduce((s, sv) => s + sv.monthlyCost, 0);
  const svcByCategory: Record<string, number> = {};
  services.forEach((s) => {
    const cat = s.category || "Other";
    svcByCategory[cat] = (svcByCategory[cat] || 0) + s.monthlyCost;
  });
  const svcCats = Object.entries(svcByCategory).sort(([, a], [, b]) => b - a);
  const maxSvcCat = svcCats.length > 0 ? Math.max(...svcCats.map(([, v]) => v)) : 1;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <button className="p-2 rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Budget</h1>
            <p className="text-muted-foreground mt-1">Monthly expense tracking & planning</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition"
          onClick={() => { resetForm(); setShowForm(!showForm); }}
        >
          {showForm ? <><X className="h-4 w-4" />Cancel</> : <><Plus className="h-4 w-4" />Add Budget</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-foreground/5 w-fit">
        {(["overview", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === t ? "bg-orange-500 text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "overview" ? "Overview" : "History"}
          </button>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-2xl border border-orange-500/20 bg-foreground/5 backdrop-blur-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{editingId ? "Edit Budget" : "New Monthly Budget"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Month *</label>
              <input type="month" className={inputCls} value={form.month} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, month: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Address (optional)</label>
              <select className={inputCls} value={form.addressId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((p) => ({ ...p, addressId: e.target.value }))}>
                <option value="">All addresses</option>
                {addresses.map((a) => <option key={a.id} value={a.id}>{a.nickname || `${a.city}, ${a.state}`}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Planned Income", key: "plannedIncome" },
              { label: "Actual Income", key: "actualIncome" },
              { label: "Planned Expenses", key: "plannedExpenses" },
              { label: "Actual Expenses *", key: "actualExpenses" },
            ].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className={labelCls}>{field.label}</label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
                  <input
                    className={`${inputCls} pl-8`}
                    type="number" step="0.01" placeholder="0.00"
                    value={(form as any)[field.key]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Category limits */}
          <div className="space-y-1.5">
            <label className={labelCls}>Category Limits (optional)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {BUDGET_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${catColors[cat] || "bg-foreground/20"}`} />
                  <span className="text-[11px] w-20 truncate text-muted-foreground">{cat}</span>
                  <input
                    className={`${inputCls} h-7 text-xs flex-1`}
                    type="number" step="0.01" placeholder="0"
                    value={form.categories[cat] || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, categories: { ...p.categories, [cat]: e.target.value } }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Notes</label>
            <input className={inputCls} placeholder="Optional notes..." value={form.notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex justify-end">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
              onClick={handleSave} disabled={saving}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Save Budget"}
            </button>
          </div>
        </div>
      )}

      {tab === "overview" ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Service Costs", value: formatCurrency(svcMonthly), sub: `${services.length} services`, icon: DollarSign, color: "orange" },
              { label: "Budgeted", value: formatCurrency(totalPlanned), sub: `${budgets.length} budgets`, icon: Target, color: "cyan" },
              { label: "Actual Spent", value: formatCurrency(totalActual), sub: totalPlanned > 0 ? `${Math.round((totalActual / totalPlanned) * 100)}% of budget` : "No budget set", icon: totalActual > totalPlanned && totalPlanned > 0 ? TrendingUp : TrendingDown, color: totalActual > totalPlanned && totalPlanned > 0 ? "red" : "emerald" },
              { label: "Net Savings", value: formatCurrency(totalIncome - totalActual), sub: totalIncome > 0 ? `${Math.round(((totalIncome - totalActual) / totalIncome) * 100)}% saved` : "No income data", icon: PiggyBank, color: "amber" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg bg-${stat.color}-500/10 border border-${stat.color}-500/20`}>
                    <stat.icon className={`h-3.5 w-3.5 text-${stat.color}-400`} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-foreground/40 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Spending by Category (from services) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-orange-400" />
                <h3 className="text-sm font-semibold text-foreground">Spending by Category</h3>
              </div>
              {svcCats.length === 0 ? (
                <p className="text-xs text-foreground/40 text-center py-6">No services registered yet</p>
              ) : (
                <div className="space-y-3">
                  {svcCats.map(([cat, amt]) => {
                    const pct = maxSvcCat > 0 ? (amt / maxSvcCat) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{cat}</span>
                          <span className="text-xs font-semibold text-foreground/80">{formatCurrency(amt)}/mo</span>
                        </div>
                        <div className="h-2 bg-foreground/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${catColors[cat] || "bg-orange-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Budget vs Actual Chart */}
            <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-foreground">Budget vs Actual</h3>
              </div>
              {budgets.length === 0 ? (
                <p className="text-xs text-foreground/40 text-center py-6">Add a budget to see comparison</p>
              ) : (
                <div className="space-y-4">
                  {budgets.slice(0, 6).map((b) => {
                    const label = new Date(b.month).toLocaleDateString("en-US", { month: "short" });
                    const planned = b.plannedExpenses || 0;
                    const actual = b.actualExpenses;
                    const maxVal = Math.max(planned, actual, 1);
                    const overBudget = planned > 0 && actual > planned;
                    return (
                      <div key={b.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">{label} {b.year}</span>
                          <span className={`text-[10px] font-medium ${overBudget ? "text-red-400" : "text-emerald-400"}`}>
                            {planned > 0 ? `${Math.round((actual / planned) * 100)}%` : "—"}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <div className="flex-1 space-y-1">
                            <div className="h-2 bg-foreground/5 rounded-full overflow-hidden">
                              <div className="h-full bg-cyan-500/60 rounded-full" style={{ width: `${(planned / maxVal) * 100}%` }} />
                            </div>
                            <div className="h-2 bg-foreground/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${overBudget ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${(actual / maxVal) * 100}%` }} />
                            </div>
                          </div>
                          <div className="w-16 text-right">
                            <p className="text-[9px] text-cyan-400">{formatCurrency(planned)}</p>
                            <p className={`text-[9px] ${overBudget ? "text-red-400" : "text-emerald-400"}`}>{formatCurrency(actual)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-4 pt-2 border-t border-border">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-cyan-500/60" /><span className="text-[10px] text-foreground/40">Planned</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-emerald-500" /><span className="text-[10px] text-foreground/40">Actual</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* History Tab — Budget list */
        <>
          {budgets.length === 0 && !showForm ? (
            <EmptyState
              icon={DollarSign}
              title="No budget data yet"
              description="Add your first monthly budget to start tracking expenses."
            />
          ) : (
            <div className="space-y-3">
              {budgets.map((b) => {
                const monthLabel = new Date(b.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
                const overBudget = b.actualExpenses > (b.plannedExpenses || Infinity);
                let breakdown: Record<string, number> = {};
                try { if (b.categoryBreakdown) breakdown = typeof b.categoryBreakdown === "string" ? JSON.parse(b.categoryBreakdown) : b.categoryBreakdown; } catch {}
                const cats = Object.entries(breakdown).sort(([, a], [, b]) => b - a);
                const maxCat = cats.length > 0 ? Math.max(...cats.map(([, v]) => v)) : 1;

                return (
                  <div key={b.id} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                          <Calendar className="h-5 w-5 text-orange-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{monthLabel}</h3>
                          <p className="text-xs text-muted-foreground">
                            {b.actualIncome ? `Income: ${formatCurrency(b.actualIncome)}` : ""}
                            {b.actualIncome && b.actualExpenses ? " · " : ""}
                            Expenses: {formatCurrency(b.actualExpenses)}
                            {b.plannedExpenses ? ` / ${formatCurrency(b.plannedExpenses)} planned` : ""}
                          </p>
                        </div>
                      </div>
                      {b.plannedExpenses ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          overBudget
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {overBudget ? "Over Budget" : "On Track"}
                        </span>
                      ) : null}
                    </div>

                    {/* Progress bar */}
                    {b.plannedExpenses ? (
                      <div className="space-y-1">
                        <div className="h-2 bg-foreground/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min((b.actualExpenses / b.plannedExpenses) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-foreground/35 text-right">
                          {Math.round((b.actualExpenses / b.plannedExpenses) * 100)}% used
                        </p>
                      </div>
                    ) : null}

                    {cats.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-border">
                        {cats.slice(0, 5).map(([cat, amt]) => (
                          <div key={cat} className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${catColors[cat] || "bg-foreground/20"}`} />
                            <span className="text-[11px] w-24 truncate text-muted-foreground">{cat}</span>
                            <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${catColors[cat] || "bg-orange-500"}`} style={{ width: `${(amt / maxCat) * 100}%` }} />
                            </div>
                            <span className="text-[11px] font-medium w-16 text-right text-muted-foreground">{formatCurrency(amt)}</span>
                          </div>
                        ))}
                        {cats.length > 5 && <p className="text-[10px] text-foreground/35">+{cats.length - 5} more</p>}
                      </div>
                    )}
                    {b.notes && <p className="text-[11px] text-foreground/35 italic pt-1">{b.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

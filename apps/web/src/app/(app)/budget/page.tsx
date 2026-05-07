"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  DollarSign,
  Loader2,
  PiggyBank,
  Plus,
  Target,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { CardSkeleton } from "@/components/shared/loading-state";
import {
  BUDGET_CATEGORY_LABELS,
  calculateBudgetPlan,
  parseBudgetCategoryLimits,
  type BudgetCategoryLabel,
  type ServiceCostInput,
} from "@/lib/budget-planning";
import { formatCurrency } from "@/lib/utils";

const inputCls = "w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition";
const labelCls = "text-xs font-medium text-muted-foreground";

interface Budget {
  id: string;
  month: string;
  year: number;
  plannedIncome: number | null;
  actualIncome: number | null;
  plannedExpenses: number | null;
  actualExpenses: number;
  categoryBreakdown?: string | null;
  notes?: string | null;
  addressId?: string | null;
}

interface AddressOption {
  id: string;
  nickname?: string | null;
  city: string;
  state: string;
}

interface BudgetFormState {
  month: string;
  addressId: string;
  budgetLimit: string;
  plannedIncome: string;
  notes: string;
  categories: Partial<Record<BudgetCategoryLabel, string>>;
}

const categoryColors: Record<BudgetCategoryLabel, string> = {
  Utilities: "bg-tone-cyan-fg",
  "Internet & Phone": "bg-tone-sky-fg",
  Insurance: "bg-tone-honey-fg",
  Subscriptions: "bg-tone-foil-bg",
  "Banking / Financial": "bg-tone-emerald-fg",
  Government: "bg-muted-foreground",
  Moving: "bg-tone-orange-fg",
  Shopping: "bg-tone-emerald-bg",
  Transportation: "bg-tone-sage-bg",
  Other: "bg-foreground/30",
};

const statTone = {
  orange: { box: "bg-tone-orange-bg border-tone-orange-br", icon: "text-tone-orange-fg" },
  cyan: { box: "bg-tone-cyan-bg border-tone-cyan-br", icon: "text-tone-cyan-fg" },
  emerald: { box: "bg-tone-emerald-bg border-tone-emerald-br", icon: "text-tone-emerald-fg" },
  red: { box: "bg-destructive/10 border-destructive", icon: "text-destructive" },
} as const;

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthDateFromKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, 1);
}

function budgetMonthKey(month: string | Date) {
  const date = month instanceof Date ? month : new Date(month);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string) {
  return monthDateFromKey(monthKey).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function emptyForm(): BudgetFormState {
  return {
    month: currentMonthKey(),
    addressId: "",
    budgetLimit: "",
    plannedIncome: "",
    notes: "",
    categories: {},
  };
}

function addressLabel(addresses: AddressOption[], addressId?: string | null) {
  if (!addressId) return "All addresses";
  const address = addresses.find((item) => item.id === addressId);
  return address ? address.nickname || `${address.city}, ${address.state}` : "Selected address";
}

function toServices(rows: any[]): ServiceCostInput[] {
  return rows.map((service) => ({
    id: service.id,
    providerName: service.providerName,
    category: service.category,
    addressId: service.addressId,
    monthlyCost: typeof service.monthlyCost === "number" ? service.monthlyCost : Number(service.monthlyCost || 0),
    billingCycle: service.billingCycle,
    isActive: service.isActive,
    activatedAt: service.activatedAt,
    createdAt: service.createdAt,
  }));
}

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [services, setServices] = useState<ServiceCostInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [form, setForm] = useState<BudgetFormState>(() => emptyForm());

  const loadBudgetData = () => {
    Promise.all([
      fetch("/api/budget").then((response) => response.json()),
      fetch("/api/addresses").then((response) => response.json()),
      fetch("/api/services?limit=200").then((response) => response.json()),
    ])
      .then(([budgetData, addressData, serviceData]) => {
        setBudgets(budgetData.budgets || []);
        setAddresses(addressData.addresses || []);
        setServices(toServices(serviceData.services || []));
      })
      .catch(() => {
        toast.error("Failed to load budget data");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBudgetData();
  }, []);

  const selectedMonthDate = useMemo(() => monthDateFromKey(selectedMonth), [selectedMonth]);
  const selectedAddress = selectedAddressId || null;

  const currentBudget = useMemo(
    () =>
      budgets.find(
        (budget) =>
          budgetMonthKey(budget.month) === selectedMonth &&
          (budget.addressId || "") === (selectedAddressId || ""),
      ) || null,
    [budgets, selectedAddressId, selectedMonth],
  );

  const budgetSummary = useMemo(
    () => calculateBudgetPlan(services, { month: selectedMonthDate, addressId: selectedAddress }),
    [services, selectedAddress, selectedMonthDate],
  );

  const budgetLimit = currentBudget?.plannedExpenses || 0;
  const categoryLimits = parseBudgetCategoryLimits(currentBudget?.categoryBreakdown || null);
  const budgetDelta = budgetLimit > 0 ? budgetLimit - budgetSummary.projectedThisMonth : null;
  const budgetUsedPercent = budgetLimit > 0 ? Math.min((budgetSummary.projectedThisMonth / budgetLimit) * 100, 100) : 0;
  const hasServiceCosts = budgetSummary.monthlyCommitted > 0 || budgetSummary.oneTimeThisMonth > 0;

  const openBudgetForm = () => {
    const limits = parseBudgetCategoryLimits(currentBudget?.categoryBreakdown || null);
    setForm({
      month: selectedMonth,
      addressId: selectedAddressId,
      budgetLimit: currentBudget?.plannedExpenses ? String(currentBudget.plannedExpenses) : "",
      plannedIncome: currentBudget?.plannedIncome ? String(currentBudget.plannedIncome) : "",
      notes: currentBudget?.notes || "",
      categories: Object.fromEntries(
        BUDGET_CATEGORY_LABELS.map((category) => [category, limits[category] ? String(limits[category]) : ""]),
      ) as Partial<Record<BudgetCategoryLabel, string>>,
    });
    setShowForm(true);
  };

  const closeBudgetForm = () => {
    setForm(emptyForm());
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.budgetLimit && !Object.values(form.categories).some((value) => value && Number(value) > 0)) {
      toast.error("Set a monthly budget limit or at least one category limit.");
      return;
    }

    const [yearStr] = form.month.split("-");
    const payload: Record<string, unknown> = {
      month: `${form.month}-01`,
      year: Number(yearStr),
    };

    if (form.addressId) payload.addressId = form.addressId;
    if (form.budgetLimit) payload.plannedExpenses = Number(form.budgetLimit);
    if (form.plannedIncome) payload.plannedIncome = Number(form.plannedIncome);
    if (form.notes.trim()) payload.notes = form.notes.trim();

    const categoryBreakdown = Object.fromEntries(
      Object.entries(form.categories)
        .map(([category, value]) => [category, Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value) && value > 0),
    );
    if (Object.keys(categoryBreakdown).length > 0) {
      payload.categoryBreakdown = categoryBreakdown;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to save budget");
      toast.success("Monthly budget saved");
      setSelectedMonth(form.month);
      setSelectedAddressId(form.addressId);
      closeBudgetForm();
      loadBudgetData();
    } catch {
      toast.error("Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CardSkeleton />;

  const overviewStats = [
    {
      label: "Monthly Committed",
      value: formatCurrency(budgetSummary.monthlyCommitted),
      sub: `${budgetSummary.costedRecurringServices.length} recurring service${budgetSummary.costedRecurringServices.length === 1 ? "" : "s"}`,
      icon: DollarSign,
      tone: "orange" as const,
    },
    {
      label: "Monthly Budget Limit",
      value: budgetLimit > 0 ? formatCurrency(budgetLimit) : "Not set",
      sub: addressLabel(addresses, selectedAddressId),
      icon: Target,
      tone: "cyan" as const,
    },
    {
      label: "Projected This Month",
      value: formatCurrency(budgetSummary.projectedThisMonth),
      sub: budgetSummary.oneTimeThisMonth > 0 ? `${formatCurrency(budgetSummary.oneTimeThisMonth)} one-time` : monthLabel(selectedMonth),
      icon: Calendar,
      tone: "emerald" as const,
    },
    {
      label: "Over / Under Budget",
      value: budgetDelta === null ? "Set budget" : formatCurrency(Math.abs(budgetDelta)),
      sub: budgetDelta === null ? "No monthly limit yet" : budgetDelta >= 0 ? "Under budget" : "Over budget",
      icon: PiggyBank,
      tone: budgetDelta !== null && budgetDelta < 0 ? "red" as const : "emerald" as const,
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <button className="p-2 rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition" aria-label="Back to settings">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Budget</h1>
            <p className="text-muted-foreground mt-1">Plan monthly service commitments and one-time moving costs.</p>
          </div>
        </div>
        <button
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:bg-tone-orange-bg transition"
          onClick={showForm ? closeBudgetForm : openBudgetForm}
        >
          {showForm ? <><X className="h-4 w-4" />Cancel</> : <><Plus className="h-4 w-4" />Manage Budget Limits</>}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelCls}>Month</label>
          <input className={inputCls} type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Address</label>
          <select className={inputCls} value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)}>
            <option value="">All addresses</option>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.nickname || `${address.city}, ${address.state}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-tone-orange-br bg-foreground/5 backdrop-blur-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Set Monthly Budget</h2>
            <p className="text-xs text-muted-foreground mt-1">Budget limits compare against active service costs for the selected month and address.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Month</label>
              <input className={inputCls} type="month" value={form.month} onChange={(event) => setForm((prev) => ({ ...prev, month: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Address</label>
              <select className={inputCls} value={form.addressId} onChange={(event) => setForm((prev) => ({ ...prev, addressId: event.target.value }))}>
                <option value="">All addresses</option>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.nickname || `${address.city}, ${address.state}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Monthly Budget Limit</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
                <input
                  className={`${inputCls} pl-8`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.budgetLimit}
                  onChange={(event) => setForm((prev) => ({ ...prev, budgetLimit: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Optional Monthly Income</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
                <input
                  className={`${inputCls} pl-8`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={form.plannedIncome}
                  onChange={(event) => setForm((prev) => ({ ...prev, plannedIncome: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Category Budget Limits</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {BUDGET_CATEGORY_LABELS.map((category) => (
                <div key={category} className="flex items-center gap-2 rounded-xl border border-border bg-background/30 px-3 py-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${categoryColors[category]}`} />
                  <span className="text-xs text-muted-foreground min-w-0 flex-1 truncate">{category}</span>
                  <input
                    className="w-24 rounded-lg border border-border bg-foreground/5 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={form.categories[category] || ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, categories: { ...prev.categories, [category]: event.target.value } }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Notes</label>
            <input className={inputCls} placeholder="Optional notes..." value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </div>

          <div className="flex justify-end">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:bg-tone-orange-bg transition disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Save Budget Limits"}
            </button>
          </div>
        </div>
      )}

      {!currentBudget && hasServiceCosts && (
        <div className="rounded-2xl border border-tone-cyan-br bg-tone-cyan-bg p-4 flex gap-3">
          <Target className="h-4 w-4 text-tone-cyan-fg shrink-0 mt-0.5" />
          <p className="text-sm text-tone-cyan-fg">
            Your active services currently total {formatCurrency(budgetSummary.monthlyCommitted)}/mo. Set a monthly budget to compare your costs.
          </p>
        </div>
      )}

      {!hasServiceCosts && (
        <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-4 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-tone-honey-fg shrink-0 mt-0.5" />
          <p className="text-sm text-tone-honey-fg">Add costs to your services to enable budget tracking.</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {overviewStats.map((stat) => {
          const tone = statTone[stat.tone];
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg border ${tone.box}`}>
                  <Icon className={`h-3.5 w-3.5 ${tone.icon}`} />
                </div>
                <span className="text-[11px] text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-foreground/40 mt-0.5">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-tone-orange-fg" />
            <h2 className="text-sm font-semibold text-foreground">Spending by Friendly Category</h2>
          </div>
          {budgetSummary.byBudgetCategory.length === 0 ? (
            <p className="text-xs text-foreground/40 text-center py-6">No service cost data for this filter.</p>
          ) : (
            <div className="space-y-3">
              {budgetSummary.byBudgetCategory.map((row) => {
                const limit = categoryLimits[row.category] || 0;
                const pct = Math.min((row.amount / Math.max(budgetSummary.projectedThisMonth, 1)) * 100, 100);
                const overCategory = limit > 0 && row.amount > limit;
                return (
                  <div key={row.category}>
                    <div className="flex items-center justify-between mb-1 gap-3">
                      <span className="text-xs text-muted-foreground">{row.category}</span>
                      <span className={`text-xs font-semibold ${overCategory ? "text-destructive" : "text-foreground/80"}`}>
                        {formatCurrency(row.amount)}
                        {limit > 0 ? ` / ${formatCurrency(limit)}` : ""}
                      </span>
                    </div>
                    <div className="h-2 bg-foreground/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${categoryColors[row.category]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-tone-cyan-fg" />
            <h2 className="text-sm font-semibold text-foreground">Budget vs Committed</h2>
          </div>
          {budgetLimit <= 0 ? (
            <p className="text-xs text-foreground/40 text-center py-6">Set a monthly budget limit to compare your committed and projected costs.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Projected this month</span>
                <span className="font-semibold text-foreground">{formatCurrency(budgetSummary.projectedThisMonth)}</span>
              </div>
              <div className="h-3 bg-foreground/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${budgetSummary.projectedThisMonth > budgetLimit ? "bg-destructive" : "bg-tone-emerald-fg"}`} style={{ width: `${budgetUsedPercent}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-background/30 border border-border p-3">
                  <p className="text-[10px] text-muted-foreground">Monthly committed</p>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(budgetSummary.monthlyCommitted)}</p>
                </div>
                <div className="rounded-xl bg-background/30 border border-border p-3">
                  <p className="text-[10px] text-muted-foreground">One-time</p>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(budgetSummary.oneTimeThisMonth)}</p>
                </div>
                <div className="rounded-xl bg-background/30 border border-border p-3">
                  <p className="text-[10px] text-muted-foreground">{budgetDelta !== null && budgetDelta < 0 ? "Over" : "Under"}</p>
                  <p className={`text-sm font-semibold ${budgetDelta !== null && budgetDelta < 0 ? "text-destructive" : "text-tone-emerald-fg"}`}>
                    {budgetDelta === null ? "$0.00" : formatCurrency(Math.abs(budgetDelta))}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <WalletCards className="h-4 w-4 text-tone-honey-fg" />
            <h2 className="text-sm font-semibold text-foreground">One-time Costs This Month</h2>
          </div>
          {budgetSummary.oneTimeServicesThisMonth.length === 0 ? (
            <p className="text-xs text-foreground/40 text-center py-6">No one-time service costs for {monthLabel(selectedMonth)}.</p>
          ) : (
            <div className="space-y-2">
              {budgetSummary.oneTimeServicesThisMonth.map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/30 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{service.providerName}</p>
                    <p className="text-[11px] text-muted-foreground">{service.friendlyCategory} - {service.budgetCategory}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(service.oneTimeAmount)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-tone-honey-fg" />
            <h2 className="text-sm font-semibold text-foreground">Services Missing Cost</h2>
          </div>
          {budgetSummary.missingCostServices.length === 0 ? (
            <p className="text-xs text-foreground/40 text-center py-6">All active services in this filter have cost data.</p>
          ) : (
            <div className="space-y-2">
              {budgetSummary.missingCostServices.slice(0, 8).map((service) => (
                <div key={service.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/30 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{service.providerName}</p>
                    <p className="text-[11px] text-muted-foreground">{service.friendlyCategory} - {service.budgetCategory}</p>
                  </div>
                  <Link className="text-xs font-medium text-tone-orange-fg hover:text-tone-orange-fg shrink-0" href={`/services/${service.id}/edit`}>
                    Add cost
                  </Link>
                </div>
              ))}
              {budgetSummary.missingCostServices.length > 8 && (
                <p className="text-[11px] text-foreground/40">+{budgetSummary.missingCostServices.length - 8} more services missing cost data</p>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4 text-tone-orange-fg" />
          <h2 className="text-sm font-semibold text-foreground">Budget History</h2>
        </div>
        {budgets.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="No budget limits yet"
            description={
              hasServiceCosts
                ? `Your active services currently total ${formatCurrency(budgetSummary.monthlyCommitted)}/mo. Set a monthly budget to compare your costs.`
                : "Add costs to your services to enable budget tracking."
            }
            actionLabel="Set Monthly Budget"
            onAction={openBudgetForm}
          />
        ) : (
          <div className="space-y-3">
            {budgets.map((budget) => {
              const key = budgetMonthKey(budget.month);
              const limit = budget.plannedExpenses || 0;
              const projectedSnapshot = budget.actualExpenses || 0;
              const delta = limit > 0 ? limit - projectedSnapshot : null;
              const limits = parseBudgetCategoryLimits(budget.categoryBreakdown || null);
              return (
                <div key={budget.id} className="rounded-xl border border-border bg-background/30 p-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{monthLabel(key)}</h3>
                      <p className="text-xs text-muted-foreground">{addressLabel(addresses, budget.addressId)}</p>
                    </div>
                    {delta !== null && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium w-fit ${
                        delta < 0
                          ? "bg-destructive/10 text-destructive border-destructive"
                          : "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br"
                      }`}>
                        {delta < 0 ? "Over Budget" : "Under Budget"}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Budget limit</p>
                      <p className="font-semibold text-foreground">{limit > 0 ? formatCurrency(limit) : "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Projected snapshot</p>
                      <p className="font-semibold text-foreground">{formatCurrency(projectedSnapshot)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Over / under</p>
                      <p className={`font-semibold ${delta !== null && delta < 0 ? "text-destructive" : "text-tone-emerald-fg"}`}>
                        {delta === null ? "Not set" : formatCurrency(Math.abs(delta))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Optional income</p>
                      <p className="font-semibold text-foreground">{budget.plannedIncome ? formatCurrency(budget.plannedIncome) : "Not set"}</p>
                    </div>
                  </div>
                  {Object.keys(limits).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {Object.entries(limits).map(([category, amount]) => (
                        <span key={category} className="text-[10px] rounded-full border border-border px-2 py-1 text-muted-foreground">
                          {category}: {formatCurrency(amount || 0)}
                        </span>
                      ))}
                    </div>
                  )}
                  {budget.notes && <p className="text-[11px] text-foreground/40 italic">{budget.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

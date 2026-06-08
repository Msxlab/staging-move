export const BUDGET_CATEGORY_LABELS = [
  "Utilities",
  "Internet & Phone",
  "Insurance",
  "Subscriptions",
  "Banking / Financial",
  "Government",
  "Moving",
  "Shopping",
  "Transportation",
  "Other",
] as const;

export type BudgetCategoryLabel = (typeof BUDGET_CATEGORY_LABELS)[number];

/**
 * A per-MONTH realized actual for a service line (one ServiceCostLog row). The
 * source of truth for budget actuals — see the `costLogs` field on
 * ServiceCostInput. `month` is the first day of the month at 00:00:00 UTC.
 */
export interface ServiceCostLogInput {
  month: Date | string;
  amount: number;
}

export interface ServiceCostInput {
  id: string;
  providerName: string;
  category?: string | null;
  addressId?: string | null;
  monthlyCost?: number | null;
  /**
   * LEGACY single scalar for the actual per-cycle amount the user paid (same
   * cycle semantics as `monthlyCost`). This is the FALLBACK only: when
   * `costLogs` is undefined the engine still reads this so old call-sites keep
   * working. When `costLogs` IS supplied, the per-month log for the selected
   * month wins and this field is ignored — making the budget month-stepper show
   * each month's real actual instead of one overwriting number. `null`/undefined
   * (with no matching log) means "not yet logged" → the line is excluded from
   * realized-actual / savings totals for that month.
   */
  actualMonthlyCost?: number | null;
  /**
   * Per-MONTH realized actuals (ServiceCostLog rows) for this service. When
   * present, the actual for the SELECTED month is resolved from the row whose
   * `month` matches that month; no row → "estimate only" for that month. This is
   * the real source of truth; `actualMonthlyCost` is the legacy fallback used
   * only when this is undefined.
   */
  costLogs?: ServiceCostLogInput[];
  billingCycle?: string | null;
  isActive?: boolean | null;
  activatedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface NormalizedServiceCost {
  amount: number;
  monthlyCommitted: number;
  oneTimeThisMonth: number;
  billingCycle: string;
  hasCost: boolean;
  isOneTime: boolean;
}

export interface BudgetPlanSummary {
  monthlyCommitted: number;
  oneTimeThisMonth: number;
  projectedThisMonth: number;
  costedRecurringServices: Array<ServiceCostInput & { normalizedMonthlyCost: number; budgetCategory: BudgetCategoryLabel; friendlyCategory: string }>;
  oneTimeServicesThisMonth: Array<ServiceCostInput & { oneTimeAmount: number; budgetCategory: BudgetCategoryLabel; friendlyCategory: string }>;
  missingCostServices: Array<ServiceCostInput & { budgetCategory: BudgetCategoryLabel; friendlyCategory: string }>;
  byBudgetCategory: Array<{ category: BudgetCategoryLabel; amount: number }>;
}

function normalizedCategory(category?: string | null): string {
  return (category || "OTHER").trim().toUpperCase();
}

export function getFriendlyServiceCategoryLabel(category?: string | null): string {
  const value = normalizedCategory(category);

  const exact: Record<string, string> = {
    GOVERNMENT_POSTAL: "Mail & Postal",
    UTILITY_WATER: "Water",
    UTILITY_ELECTRIC: "Electric",
    UTILITY_GAS: "Gas",
    UTILITY_INTERNET: "Internet",
    UTILITY_PHONE: "Phone",
    FINANCIAL_BANK: "Banking",
    SHOPPING_SUBSCRIPTION: "Subscriptions",
    SHOPPING_RETAIL: "Shopping",
    HOUSING_MOVING: "Moving",
  };
  if (exact[value]) return exact[value];

  if (value.startsWith("FINANCIAL_INSURANCE_")) return "Insurance";
  if (value.startsWith("TRANSPORTATION_")) return "Transportation";
  if (value.startsWith("GOVERNMENT_")) return "Government";
  return "Other";
}

export function getBudgetCategoryForService(category?: string | null): BudgetCategoryLabel {
  const value = normalizedCategory(category);

  if (["UTILITY_ELECTRIC", "UTILITY_GAS", "UTILITY_WATER", "UTILITY_TRASH", "UTILITY_SEWER"].includes(value)) {
    return "Utilities";
  }
  if (["UTILITY_INTERNET", "UTILITY_PHONE", "UTILITY_CABLE"].includes(value)) {
    return "Internet & Phone";
  }
  if (value.startsWith("FINANCIAL_INSURANCE_")) return "Insurance";
  if (value === "SHOPPING_SUBSCRIPTION") return "Subscriptions";
  if (
    value === "FINANCIAL_BANK" ||
    value === "FINANCIAL_CREDIT_CARD" ||
    value === "FINANCIAL_FINTECH" ||
    value === "FINANCIAL_MORTGAGE" ||
    value === "FINANCIAL_LOAN"
  ) {
    return "Banking / Financial";
  }
  if (value.startsWith("GOVERNMENT_")) return "Government";
  if (value === "HOUSING_MOVING") return "Moving";
  if (value === "SHOPPING_RETAIL" || value === "GROCERY_DELIVERY" || value === "LOCAL_DINING") return "Shopping";
  if (value.startsWith("TRANSPORTATION_")) return "Transportation";
  return "Other";
}

export function isDateInMonth(date: Date | string | null | undefined, month: Date): boolean {
  if (!date) return false;
  const parsed = date instanceof Date ? date : new Date(date);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.getUTCFullYear() === month.getUTCFullYear() &&
    parsed.getUTCMonth() === month.getUTCMonth()
  );
}

/**
 * Convert a raw per-cycle amount (the `monthlyCost` field actually stores the
 * amount as typed for the chosen cycle — the name is historical) into its true
 * monthly-committed value. ONE_TIME has no recurring monthly cost → 0. This is
 * the single source of truth for cycle math, shared by budget planning and the
 * tax export so the two can never drift.
 */
export function monthlyAmountForCycle(amount: number, billingCycle: string | null | undefined): number {
  const cycle = (billingCycle || "MONTHLY").trim().toUpperCase();
  if (cycle === "ONE_TIME") return 0;
  if (cycle === "YEARLY" || cycle === "ANNUAL") return amount / 12;
  if (cycle === "WEEKLY") return (amount * 52) / 12;
  if (cycle === "QUARTERLY") return amount / 3;
  return amount;
}

export function normalizeServiceCost(service: ServiceCostInput, month: Date): NormalizedServiceCost {
  const amount = Number(service.monthlyCost || 0);
  const hasCost = Number.isFinite(amount) && amount > 0;
  const billingCycle = (service.billingCycle || "MONTHLY").trim().toUpperCase();
  const isOneTime = billingCycle === "ONE_TIME";

  if (!hasCost) {
    return { amount: 0, monthlyCommitted: 0, oneTimeThisMonth: 0, billingCycle, hasCost: false, isOneTime };
  }

  if (isOneTime) {
    const serviceDate = service.activatedAt || service.createdAt;
    return {
      amount,
      monthlyCommitted: 0,
      oneTimeThisMonth: isDateInMonth(serviceDate, month) ? amount : 0,
      billingCycle,
      hasCost: true,
      isOneTime: true,
    };
  }

  const monthlyCommitted = monthlyAmountForCycle(amount, billingCycle);

  return { amount, monthlyCommitted, oneTimeThisMonth: 0, billingCycle, hasCost: true, isOneTime: false };
}

export function calculateBudgetPlan(
  services: ServiceCostInput[],
  options: { month: Date; addressId?: string | null },
): BudgetPlanSummary {
  const categoryTotals = new Map<BudgetCategoryLabel, number>();
  const missingCostServices: BudgetPlanSummary["missingCostServices"] = [];
  const costedRecurringServices: BudgetPlanSummary["costedRecurringServices"] = [];
  const oneTimeServicesThisMonth: BudgetPlanSummary["oneTimeServicesThisMonth"] = [];

  for (const service of services) {
    if (service.isActive === false) continue;
    if (options.addressId && service.addressId !== options.addressId) continue;

    const budgetCategory = getBudgetCategoryForService(service.category);
    const friendlyCategory = getFriendlyServiceCategoryLabel(service.category);
    const normalized = normalizeServiceCost(service, options.month);

    if (!normalized.hasCost) {
      missingCostServices.push({ ...service, budgetCategory, friendlyCategory });
      continue;
    }

    if (normalized.isOneTime) {
      if (normalized.oneTimeThisMonth > 0) {
        oneTimeServicesThisMonth.push({ ...service, oneTimeAmount: normalized.oneTimeThisMonth, budgetCategory, friendlyCategory });
        categoryTotals.set(budgetCategory, (categoryTotals.get(budgetCategory) || 0) + normalized.oneTimeThisMonth);
      }
      continue;
    }

    costedRecurringServices.push({ ...service, normalizedMonthlyCost: normalized.monthlyCommitted, budgetCategory, friendlyCategory });
    categoryTotals.set(budgetCategory, (categoryTotals.get(budgetCategory) || 0) + normalized.monthlyCommitted);
  }

  const monthlyCommitted = costedRecurringServices.reduce((sum, service) => sum + service.normalizedMonthlyCost, 0);
  const oneTimeThisMonth = oneTimeServicesThisMonth.reduce((sum, service) => sum + service.oneTimeAmount, 0);
  const byBudgetCategory = [...categoryTotals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    monthlyCommitted,
    oneTimeThisMonth,
    projectedThisMonth: monthlyCommitted + oneTimeThisMonth,
    costedRecurringServices,
    oneTimeServicesThisMonth,
    missingCostServices,
    byBudgetCategory,
  };
}

export function parseBudgetCategoryLimits(value: unknown): Partial<Record<BudgetCategoryLabel, number>> {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([category, amount]) => [category, Number(amount)] as const)
        .filter(([category, amount]) => BUDGET_CATEGORY_LABELS.includes(category as BudgetCategoryLabel) && Number.isFinite(amount) && amount > 0),
    ) as Partial<Record<BudgetCategoryLabel, number>>;
  } catch {
    return {};
  }
}

// ==================== ACTUAL vs PROJECTED ====================

/**
 * Resolve the ACTUAL per-cycle amount a service line was logged at for a SPECIFIC
 * month. Per-month `costLogs` (ServiceCostLog rows) are the source of truth: when
 * present, the row whose `month` matches the selected month wins, and no matching
 * row means "not logged this month" (→ `null`). Only when `costLogs` is undefined
 * does the legacy single `actualMonthlyCost` scalar apply, so existing call-sites
 * that haven't been wired to per-month logs keep their old behavior. Returns
 * `null` for "no logged actual for this month".
 */
export function resolveActualAmountForMonth(service: ServiceCostInput, month: Date): number | null {
  if (service.costLogs !== undefined) {
    // Per-month source of truth: match the selected month's bucket exactly.
    for (const log of service.costLogs) {
      if (log === null || log === undefined) continue;
      if (!isDateInMonth(log.month, month)) continue;
      const amount = Number(log.amount);
      if (!Number.isFinite(amount) || amount < 0) return null;
      return amount;
    }
    return null;
  }
  // Legacy fallback (no per-month logs supplied): the single scalar.
  const raw = service.actualMonthlyCost;
  if (raw === null || raw === undefined) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

/**
 * Normalize a per-line ACTUAL amount into the same monthly-vs-one-time shape the
 * projection uses, so estimate and actual are always compared on equal footing.
 * The amount is resolved for the SELECTED month from the service's per-month
 * `costLogs` (falling back to the legacy scalar — see `resolveActualAmountForMonth`).
 * Returns `null` when the line has no logged actual for that month (caller treats
 * it as "estimate only" — it counts toward projected but NOT realized actuals).
 */
export function normalizeActualServiceCost(
  service: ServiceCostInput,
  month: Date,
): { monthly: number; oneTimeThisMonth: number } | null {
  if (service.isActive === false) return null;
  const amount = resolveActualAmountForMonth(service, month);
  if (amount === null) return null;

  const billingCycle = (service.billingCycle || "MONTHLY").trim().toUpperCase();
  if (billingCycle === "ONE_TIME") {
    const serviceDate = service.activatedAt || service.createdAt;
    return { monthly: 0, oneTimeThisMonth: isDateInMonth(serviceDate, month) ? amount : 0 };
  }
  return { monthly: monthlyAmountForCycle(amount, billingCycle), oneTimeThisMonth: 0 };
}

export interface BudgetCategoryVariance {
  category: BudgetCategoryLabel;
  /** Projected (estimated) monthly-equivalent + one-time for this month. */
  projected: number;
  /** Realized actual for the SAME services that have a logged actual. */
  actual: number;
  /** projected − actual. Positive = under estimate (saved money). */
  variance: number;
  /** How many lines in this category have a logged/confirmed actual. */
  loggedCount: number;
  /** Total lines in this category (logged + estimate-only). */
  totalCount: number;
}

export interface BudgetActualsSummary {
  /** Sum of projected (estimate) for services that ALSO have a logged actual. */
  projectedForLoggedServices: number;
  /** Sum of realized actuals (this month) across logged services. */
  actualThisMonth: number;
  /**
   * projectedForLoggedServices − actualThisMonth. Positive = the user is paying
   * LESS than estimated → genuine monthly savings. Compared only over services
   * that have a confirmed actual so the figure is substantiated, never inflated
   * by un-logged lines.
   */
  monthlySavings: number;
  /** monthlySavings × 12 — the headline annual savings figure. */
  annualSavings: number;
  /**
   * Fraction saved vs. the estimate for logged services, in [-1, 1+].
   * Written to Budget.savingsRate. 0.10 = paying 10% under estimate. Null when
   * there is no logged-actual baseline yet (nothing to substantiate).
   */
  savingsRate: number | null;
  /** Count of service lines with a confirmed/logged actual. */
  loggedServiceCount: number;
  /** Count of active in-scope service lines still estimate-only. */
  pendingServiceCount: number;
  perCategory: BudgetCategoryVariance[];
}

/**
 * Estimate-vs-actual reconciliation for a month + scope. This is the MONEY-LAYER
 * core: it compares what we PROJECTED a service would cost against what the user
 * logged it ACTUALLY cost, per category, and derives a substantiated savings
 * figure (only over lines with a confirmed actual — never a fabricated total).
 */
export function calculateBudgetActuals(
  services: ServiceCostInput[],
  options: { month: Date; addressId?: string | null },
): BudgetActualsSummary {
  const projectedByCategory = new Map<BudgetCategoryLabel, number>();
  const actualByCategory = new Map<BudgetCategoryLabel, number>();
  const loggedByCategory = new Map<BudgetCategoryLabel, number>();
  const totalByCategory = new Map<BudgetCategoryLabel, number>();

  let projectedForLoggedServices = 0;
  let actualThisMonth = 0;
  let loggedServiceCount = 0;
  let pendingServiceCount = 0;

  for (const service of services) {
    if (service.isActive === false) continue;
    if (options.addressId && service.addressId !== options.addressId) continue;

    const category = getBudgetCategoryForService(service.category);
    totalByCategory.set(category, (totalByCategory.get(category) || 0) + 1);

    const projected = normalizeServiceCost(service, options.month);
    const projectedAmount = projected.isOneTime ? projected.oneTimeThisMonth : projected.monthlyCommitted;

    const actual = normalizeActualServiceCost(service, options.month);
    if (!actual) {
      // Estimate-only line: it still has a projection but no substantiated actual.
      if (projected.hasCost) pendingServiceCount += 1;
      continue;
    }

    const actualAmount = actual.oneTimeThisMonth + actual.monthly;
    loggedServiceCount += 1;
    loggedByCategory.set(category, (loggedByCategory.get(category) || 0) + 1);

    projectedForLoggedServices += projectedAmount;
    actualThisMonth += actualAmount;
    projectedByCategory.set(category, (projectedByCategory.get(category) || 0) + projectedAmount);
    actualByCategory.set(category, (actualByCategory.get(category) || 0) + actualAmount);
  }

  const monthlySavings = projectedForLoggedServices - actualThisMonth;
  const savingsRate =
    projectedForLoggedServices > 0 ? monthlySavings / projectedForLoggedServices : null;

  const perCategory: BudgetCategoryVariance[] = [...totalByCategory.entries()]
    .map(([category, totalCount]) => {
      const projected = projectedByCategory.get(category) || 0;
      const actual = actualByCategory.get(category) || 0;
      return {
        category,
        projected,
        actual,
        variance: projected - actual,
        loggedCount: loggedByCategory.get(category) || 0,
        totalCount,
      };
    })
    // Surface categories the user has actually reconciled first, then by spend.
    .filter((row) => row.loggedCount > 0 || row.projected > 0)
    .sort((a, b) => b.loggedCount - a.loggedCount || b.actual - a.actual);

  return {
    projectedForLoggedServices,
    actualThisMonth,
    monthlySavings,
    annualSavings: monthlySavings * 12,
    savingsRate,
    loggedServiceCount,
    pendingServiceCount,
    perCategory,
  };
}

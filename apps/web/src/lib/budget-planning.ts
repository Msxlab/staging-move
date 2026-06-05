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

export interface ServiceCostInput {
  id: string;
  providerName: string;
  category?: string | null;
  addressId?: string | null;
  monthlyCost?: number | null;
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

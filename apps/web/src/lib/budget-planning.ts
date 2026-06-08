// The budget projection + actuals engine now lives in @locateflow/shared so the
// mobile app can reuse it (single source of truth — see
// packages/shared/src/budget-planning.ts). This module re-exports it for the
// many existing `@/lib/budget-planning` web imports; do NOT re-add logic here.
export * from "@locateflow/shared";
export {
  BUDGET_CATEGORY_LABELS,
  calculateBudgetPlan,
  calculateBudgetActuals,
  parseBudgetCategoryLimits,
  getBudgetCategoryForService,
  getFriendlyServiceCategoryLabel,
  normalizeServiceCost,
  normalizeActualServiceCost,
  monthlyAmountForCycle,
  isDateInMonth,
  type BudgetCategoryLabel,
  type ServiceCostInput,
  type NormalizedServiceCost,
  type BudgetPlanSummary,
  type BudgetActualsSummary,
  type BudgetCategoryVariance,
} from "@locateflow/shared";

/**
 * Billing-metric helpers now live in @locateflow/shared (single source of truth,
 * also consumed by the web admin-daily-digest cron). Re-exported here so existing
 * `@/lib/billing-metrics` admin imports and the billing-metrics unit tests keep
 * working unchanged. Do NOT re-add logic here — edit packages/shared/src/billing-metrics.ts.
 */
export {
  computeMonthlyChurnRate,
  computeLtv,
  monthlyEquivalentUsd,
  computeMrr,
  computeArpuByPlan,
  computeMrrMovement,
  computeTrialConversion,
  computeMrrTrend,
  type RevenueSub,
  type PlanArpuRow,
  type MrrMovement,
  type TrialConversion,
  type MrrTrendPoint,
} from "@locateflow/shared";

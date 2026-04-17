import { BILLING_PLAN_DEFINITIONS, type BillingPlan } from "@/lib/shared-billing";

export function getMonthlyPlanPrice(plan: BillingPlan) {
  return BILLING_PLAN_DEFINITIONS[plan].monthlyPriceUsd;
}

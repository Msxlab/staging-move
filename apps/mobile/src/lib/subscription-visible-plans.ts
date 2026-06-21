type PlanKey = string | null | undefined;

function isPaidPlan(planKey: PlanKey) {
  return planKey === "INDIVIDUAL" || planKey === "FAMILY" || planKey === "PRO";
}

export function shouldShowMobileConsumerFreePanel({
  loading,
  managementKind,
  effectivePlanKey,
  effectiveActive,
}: {
  loading: boolean;
  managementKind: string | null | undefined;
  effectivePlanKey: PlanKey;
  effectiveActive: boolean;
}) {
  if (loading) return false;
  if (!effectiveActive || !isPaidPlan(effectivePlanKey)) return false;
  if (managementKind == null) return false;
  return managementKind !== "stripe" && managementKind !== "store";
}

export function shouldShowMobileSubscriptionPlan({
  planKey,
  currentPlanKey,
  isNativeStorePlatform,
  mobileStorePurchasesEnabled,
  hasConfiguredNativeSku,
}: {
  planKey: PlanKey;
  currentPlanKey: PlanKey;
  isNativeStorePlatform: boolean;
  mobileStorePurchasesEnabled: boolean;
  hasConfiguredNativeSku: boolean;
}) {
  if (!isNativeStorePlatform) return true;
  if (planKey !== "INDIVIDUAL" && planKey !== "FAMILY" && planKey !== "PRO") return true;
  if (!mobileStorePurchasesEnabled) return true;
  if (planKey === "INDIVIDUAL") return true;
  return planKey === currentPlanKey || hasConfiguredNativeSku;
}

export function shouldRenderMobileSubscriptionPlanCard({
  planKey,
  currentPlanKey,
}: {
  planKey: PlanKey;
  currentPlanKey: PlanKey;
}) {
  if (planKey === "FREE_TRIAL" && currentPlanKey === "FREE_TRIAL") return false;
  return true;
}

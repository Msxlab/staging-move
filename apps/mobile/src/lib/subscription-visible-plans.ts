type PlanKey = string | null | undefined;

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

type PlanKey = string | null | undefined;

function isPaidPlan(planKey: PlanKey) {
  return planKey === "INDIVIDUAL" || planKey === "FAMILY" || planKey === "PRO";
}

/**
 * CONSUMER_FREE signal for the mobile subscription screen. True only for an
 * active, full-access consumer whose access is NOT managed by a real Stripe or
 * store subscription (managementKind "stripe"/"store" are real payers who keep
 * the full management screen). The server only emits a non-billing
 * managementKind for an active consumer-free entitlement, so when the flag is
 * OFF this returns false for ordinary accounts and every buy/hide branch below
 * stays BYTE-IDENTICAL to today.
 *
 * This is the single predicate the screen uses both to (a) show the
 * "everything included" panel and (b) suppress the IAP buy UI / visible plans —
 * keeping the two decisions impossible to drift apart.
 */
export function isMobileConsumerFreeEntitlement({
  managementKind,
  effectivePlanKey,
  effectiveStatus,
  effectiveActive,
}: {
  managementKind: string | null | undefined;
  effectivePlanKey: PlanKey;
  effectiveStatus?: string | null | undefined;
  effectiveActive: boolean;
}) {
  if (!effectiveActive) return false;
  if (managementKind == null) return false;
  if (managementKind === "stripe" || managementKind === "store") return false;
  return isPaidPlan(effectivePlanKey) || effectiveStatus === "FREE_ACCESS";
}

export function shouldShowMobileConsumerFreePanel({
  loading,
  managementKind,
  effectivePlanKey,
  effectiveStatus,
  effectiveActive,
}: {
  loading: boolean;
  managementKind: string | null | undefined;
  effectivePlanKey: PlanKey;
  effectiveStatus?: string | null | undefined;
  effectiveActive: boolean;
}) {
  if (loading) return false;
  return isMobileConsumerFreeEntitlement({
    managementKind,
    effectivePlanKey,
    effectiveStatus,
    effectiveActive,
  });
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

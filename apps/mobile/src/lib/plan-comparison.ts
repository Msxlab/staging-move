import {
  BILLING_PLAN_DEFINITIONS,
  BILLING_PLAN_ORDER,
  type BillingPlan,
} from "@locateflow/shared";

export type ComparisonCycle = "monthly" | "yearly";

export interface PlanComparisonEntry {
  key: BillingPlan;
  name: string;
  shortDescription: string;
  /** Empty string when store policy hides this plan's price on this platform. */
  priceLabel: string;
  features: string[];
  isPaid: boolean;
  isCurrent: boolean;
}

export interface PlanComparisonInput {
  /** Effective (entitlement-aware) plan key; null/unknown falls back to Free. */
  currentPlanKey: string | null | undefined;
  isNativeStorePlatform: boolean;
  mobileStoreCommerceAdvertisable: boolean;
  /** Whether StoreKit/Play returned a purchasable product for this plan. */
  hasAvailableNativeSku: (planKey: string) => boolean;
  /** Localized store price (StoreKit/Play displayPrice) when loaded. */
  getStorePriceLabel?: (planKey: string, cycle: ComparisonCycle) => string | null;
}

function normalizePlanKey(planKey: string | null | undefined): BillingPlan {
  const match = BILLING_PLAN_ORDER.find((key) => key === planKey);
  return match || "FREE_TRIAL";
}

/**
 * Mirrors the purchase-card price rule (`canAdvertiseThisMobilePlan` /
 * `hideUnavailableMobileCommerce` in app/settings/subscription.tsx): on a
 * native store platform a paid plan's price is shown only when store commerce
 * is advertisable AND the store returned a purchasable product — or when the
 * user already holds the plan. Free plans and non-store platforms always show.
 */
export function shouldShowComparisonPrice({
  isPaid,
  isCurrent,
  isNativeStorePlatform,
  mobileStoreCommerceAdvertisable,
  planHasAvailableNativeSku,
}: {
  isPaid: boolean;
  isCurrent: boolean;
  isNativeStorePlatform: boolean;
  mobileStoreCommerceAdvertisable: boolean;
  planHasAvailableNativeSku: boolean;
}): boolean {
  if (!isNativeStorePlatform || !isPaid || isCurrent) return true;
  return mobileStoreCommerceAdvertisable && planHasAvailableNativeSku;
}

/**
 * Compact price line for a comparison row: "Free", or
 * "$3.99/month · $39.99/year". Prefers localized store prices when loaded so
 * the informational matrix never contradicts the purchase buttons.
 */
export function comparisonPriceLabel(
  planKey: BillingPlan,
  getStorePriceLabel?: PlanComparisonInput["getStorePriceLabel"],
): string {
  const def = BILLING_PLAN_DEFINITIONS[planKey];
  if (!def.isPaid) return def.priceLabel;
  const localizedMonthly = getStorePriceLabel?.(planKey, "monthly") || null;
  const localizedYearly = getStorePriceLabel?.(planKey, "yearly") || null;
  const monthly = localizedMonthly
    ? `${localizedMonthly}/month`
    : `${def.priceLabel}${def.periodLabel}`;
  const yearly = localizedYearly
    ? `${localizedYearly}/year`
    : def.yearlyPriceLabel || null;
  return yearly ? `${monthly} · ${yearly}` : monthly;
}

/**
 * Side-by-side "what you get with each plan" rows for the subscription screen.
 * Derived entirely from shared BILLING_PLAN_DEFINITIONS so the feature copy
 * (AI move briefing, New Home Dossier, smart provider suggestions, member /
 * address / service limits, Partner Hub, exports) stays in lockstep with web —
 * no duplicated hardcoded lists. Always returns every tier, even ones whose
 * purchase cards are hidden on this platform.
 */
export function buildPlanComparison(input: PlanComparisonInput): PlanComparisonEntry[] {
  const current = normalizePlanKey(input.currentPlanKey);
  return BILLING_PLAN_ORDER.map((key) => {
    const def = BILLING_PLAN_DEFINITIONS[key];
    const isCurrent = key === current;
    const showPrice = shouldShowComparisonPrice({
      isPaid: def.isPaid,
      isCurrent,
      isNativeStorePlatform: input.isNativeStorePlatform,
      mobileStoreCommerceAdvertisable: input.mobileStoreCommerceAdvertisable,
      planHasAvailableNativeSku: input.hasAvailableNativeSku(key),
    });
    return {
      key,
      name: def.displayName,
      shortDescription: def.shortDescription,
      priceLabel: showPrice ? comparisonPriceLabel(key, input.getStorePriceLabel) : "",
      features: def.features,
      isPaid: def.isPaid,
      isCurrent,
    };
  });
}

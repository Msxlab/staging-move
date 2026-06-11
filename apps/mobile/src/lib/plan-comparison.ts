import {
  BILLING_PLAN_DEFINITIONS,
  BILLING_PLAN_ORDER,
  type BillingPlan,
} from "@locateflow/shared";

export type ComparisonCycle = "monthly" | "yearly";

/**
 * One feature line in a plan's accordion. `key` is an i18n key under
 * `settings.` resolved by the subscription screen so the matrix is en/es
 * localized; `value` carries the interpolation payload for count rows
 * (addresses / services / members). Lines are emitted only for the plans
 * that actually include the capability, so the bullet list is an honest
 * "what you get" — never a list of features with a cross next to them.
 */
export interface PlanComparisonFeature {
  key: string;
  value?: number;
}

export interface PlanComparisonEntry {
  key: BillingPlan;
  name: string;
  shortDescription: string;
  /** Empty string when store policy hides this plan's price on this platform. */
  priceLabel: string;
  /** Localized, matrix-derived "what you get" lines (i18n keys + payload). */
  features: PlanComparisonFeature[];
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

/**
 * Address / service caps and member seats per plan.
 *
 * MIRRORED from the web "Compare plans" matrix
 * (apps/web/src/components/marketing/plan-compare-table.tsx — MAX_ADDRESSES /
 * MAX_SERVICES and FEATURES[plan].seatLimit) so web and mobile never disagree.
 * The web table pins these against ground truth in its own test; the colocated
 * plan-comparison.test.ts pins the mirrored values here so drift fails CI
 * instead of shipping a contradictory cell. Caps: addresses 3/10/15/25,
 * services 25/100/500/1000. Seats (members): 1/1/5/10.
 */
const MAX_ADDRESSES: Record<BillingPlan, number> = {
  FREE_TRIAL: 3,
  INDIVIDUAL: 10,
  FAMILY: 15,
  PRO: 25,
};

const MAX_SERVICES: Record<BillingPlan, number> = {
  FREE_TRIAL: 25,
  INDIVIDUAL: 100,
  FAMILY: 500,
  PRO: 1000,
};

const MEMBER_SEATS: Record<BillingPlan, number> = {
  FREE_TRIAL: 1,
  INDIVIDUAL: 1,
  FAMILY: 5,
  PRO: 10,
};

/** Premium-capability flags this accordion renders, per plan. */
interface PlanCapabilities {
  vehicleCheck: boolean;
  weatherDigest: boolean;
  homeDossier: boolean;
  aiBriefing: boolean;
  realMap: boolean;
  moverSuggestions: boolean;
  /** seatLimit > 1 — a shared household workspace (Family and up). */
  sharedWorkspace: boolean;
  addressValidation: boolean;
  dossierPdf: boolean;
  /** advancedExport — Pro tax/property export. */
  advancedExport: boolean;
  partnerHub: boolean;
  /** concurrentPlanLimit > 1 — multiple move plans at once (Pro). */
  multiPlan: boolean;
  prioritySupport: boolean;
}

/**
 * Per-plan capability matrix.
 *
 * MIRRORED from FEATURES in packages/shared/src/workspace-entitlements.ts — the
 * single source of truth the API actually gates on. The mobile `@locateflow/
 * shared` bundle (index.mobile.ts) deliberately omits workspace-entitlements,
 * so the booleans are duplicated here as literals (the same pattern the web
 * compare table uses for its address/service caps). The colocated
 * plan-comparison.test.ts pins every cell so any drift from the entitlement
 * ladder fails CI instead of shipping a contradictory bullet. Owner-ratified
 * ladder (2026-06-10): VIN/weather/dossier/address-validation at Individual+;
 * AI briefing + real map + shared workspace at Family+; movers + dossier PDF +
 * multi-plan + Partner Hub + tax export + priority support are Pro only.
 */
const PLAN_MATRIX: Record<BillingPlan, PlanCapabilities> = {
  FREE_TRIAL: {
    vehicleCheck: false, weatherDigest: false, homeDossier: false, aiBriefing: false,
    realMap: false, moverSuggestions: false, sharedWorkspace: false, addressValidation: false,
    dossierPdf: false, advancedExport: false, partnerHub: false, multiPlan: false,
    prioritySupport: false,
  },
  INDIVIDUAL: {
    vehicleCheck: true, weatherDigest: true, homeDossier: true, aiBriefing: false,
    realMap: false, moverSuggestions: false, sharedWorkspace: false, addressValidation: true,
    dossierPdf: false, advancedExport: false, partnerHub: false, multiPlan: false,
    prioritySupport: false,
  },
  FAMILY: {
    vehicleCheck: true, weatherDigest: true, homeDossier: true, aiBriefing: true,
    realMap: true, moverSuggestions: false, sharedWorkspace: true, addressValidation: true,
    dossierPdf: false, advancedExport: false, partnerHub: false, multiPlan: false,
    prioritySupport: false,
  },
  PRO: {
    vehicleCheck: true, weatherDigest: true, homeDossier: true, aiBriefing: true,
    realMap: true, moverSuggestions: true, sharedWorkspace: true, addressValidation: true,
    dossierPdf: true, advancedExport: true, partnerHub: true, multiPlan: true,
    prioritySupport: true,
  },
};

/** Concurrent move-plan ceiling per plan (FEATURES[plan].concurrentPlanLimit). */
const CONCURRENT_PLAN_LIMIT: Record<BillingPlan, number> = {
  FREE_TRIAL: 1,
  INDIVIDUAL: 1,
  FAMILY: 1,
  PRO: 3,
};

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
 * The accordion "what you get" lines for one tier, in display order.
 *
 * EVERY toggle is DERIVED from the same constants the app enforces — the
 * overhauled FEATURES matrix in packages/shared/src/workspace-entitlements.ts
 * (via planFeatures), BILLING_PLAN_DEFINITIONS.isPaid, and the caps/seats
 * mirrored above — so this list and the web compare table describe the exact
 * same matrix. Owner-ratified ladder (2026-06-10):
 *   - VIN check + weather/digest + New Home Dossier + address validation:
 *     Individual and up.
 *   - AI move briefing + real map + shared workspace/child accounts:
 *     Family and up.
 *   - FMCSA mover suggestions + dossier PDF export + multiple concurrent move
 *     plans + Partner Hub + tax/property export + priority support: Pro only.
 * Lines appear only when the plan includes the capability — the bullet list is
 * a positive "included" list, never feature-with-a-cross.
 */
export function planComparisonFeatures(planKey: BillingPlan): PlanComparisonFeature[] {
  const def = BILLING_PLAN_DEFINITIONS[planKey];
  const f = PLAN_MATRIX[planKey];
  const lines: PlanComparisonFeature[] = [];

  // Essentials — every tier.
  lines.push({ key: "subscription_featAddresses", value: MAX_ADDRESSES[planKey] });
  lines.push({ key: "subscription_featServices", value: MAX_SERVICES[planKey] });
  lines.push({ key: "subscription_featProvidersReminders" });
  lines.push({ key: "subscription_featSmartSuggestions" });

  // Moving — Free previews the plan, paid tiers unlock it.
  lines.push(
    def.isPaid
      ? { key: "subscription_featMovePlanFull" }
      : { key: "subscription_featMovePlanPreview" },
  );
  if (f.vehicleCheck) lines.push({ key: "subscription_featVehicleCheck" });
  if (f.weatherDigest) lines.push({ key: "subscription_featWeatherDigest" });
  if (f.homeDossier) lines.push({ key: "subscription_featHomeDossier" });
  if (f.aiBriefing) lines.push({ key: "subscription_featAiBriefing" });
  if (f.realMap) lines.push({ key: "subscription_featRealMap" });
  if (f.moverSuggestions) lines.push({ key: "subscription_featMovers" });

  // Household — shared seats unlock the workspace + child accounts.
  if (f.sharedWorkspace) {
    lines.push({ key: "subscription_featMembers", value: MEMBER_SEATS[planKey] });
    lines.push({ key: "subscription_featSharedWorkspace" });
    lines.push({ key: "subscription_featChildAccounts" });
  }

  // Power tools.
  if (f.addressValidation) lines.push({ key: "subscription_featAddressValidation" });
  if (def.isPaid) lines.push({ key: "subscription_featExport" });
  if (f.dossierPdf) lines.push({ key: "subscription_featDossierPdf" });
  if (f.advancedExport) lines.push({ key: "subscription_featTaxExport" });
  if (f.partnerHub) lines.push({ key: "subscription_featPartnerHub" });
  if (f.multiPlan) {
    lines.push({ key: "subscription_featConcurrentPlans", value: CONCURRENT_PLAN_LIMIT[planKey] });
  }
  if (f.prioritySupport) lines.push({ key: "subscription_featPrioritySupport" });

  return lines;
}

/**
 * Side-by-side "what you get with each plan" rows for the subscription screen.
 * Feature lines come from planComparisonFeatures (the overhauled entitlement
 * matrix) so the copy stays in lockstep with the web compare table — no
 * duplicated hardcoded lists. Always returns every tier, even ones whose
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
      features: planComparisonFeatures(key),
      isPaid: def.isPaid,
      isCurrent,
    };
  });
}

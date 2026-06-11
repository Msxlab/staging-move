import { describe, expect, it } from "vitest";
import {
  buildPlanComparison,
  comparisonPriceLabel,
  shouldShowComparisonPrice,
  type PlanComparisonEntry,
} from "./plan-comparison";

const webInput = {
  currentPlanKey: null,
  isNativeStorePlatform: false,
  mobileStoreCommerceAdvertisable: false,
  hasAvailableNativeSku: () => false,
};

/** Feature i18n keys present for a plan (order-preserving). */
function featureKeysOf(entries: PlanComparisonEntry[], key: string): string[] {
  const entry = entries.find((e) => e.key === key);
  if (!entry) throw new Error(`missing plan ${key}`);
  return entry.features.map((f) => f.key);
}

function hasFeature(entries: PlanComparisonEntry[], plan: string, key: string): boolean {
  return featureKeysOf(entries, plan).includes(key);
}

function valueOf(entries: PlanComparisonEntry[], plan: string, key: string): number | undefined {
  const entry = entries.find((e) => e.key === plan);
  return entry?.features.find((f) => f.key === key)?.value;
}

describe("buildPlanComparison", () => {
  it("always lists every tier in shared order, even when purchase cards are hidden", () => {
    const entries = buildPlanComparison({
      currentPlanKey: "FREE_TRIAL",
      isNativeStorePlatform: true,
      mobileStoreCommerceAdvertisable: false,
      hasAvailableNativeSku: () => false,
    });
    expect(entries.map((e) => e.key)).toEqual(["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"]);
    expect(entries.map((e) => e.name)).toEqual(["Free", "Individual", "Family", "Pro"]);
    for (const entry of entries) {
      expect(entry.features.length).toBeGreaterThan(0);
      expect(entry.shortDescription.length).toBeGreaterThan(0);
    }
  });

  // Mirrors the web compare table exactly: AI move briefing is Family+Pro only
  // (the cost-control cap, not an Individual feature).
  it("puts AI move briefing in Family and Pro only", () => {
    const entries = buildPlanComparison(webInput);
    expect(hasFeature(entries, "FAMILY", "subscription_featAiBriefing")).toBe(true);
    expect(hasFeature(entries, "PRO", "subscription_featAiBriefing")).toBe(true);
    expect(hasFeature(entries, "FREE_TRIAL", "subscription_featAiBriefing")).toBe(false);
    expect(hasFeature(entries, "INDIVIDUAL", "subscription_featAiBriefing")).toBe(false);
  });

  // New Home Dossier (the dossier screen) + VIN/weather/digest start at Individual.
  it("puts New Home Dossier, vehicle check and weather digest in Individual and up, not Free", () => {
    const entries = buildPlanComparison(webInput);
    for (const paid of ["INDIVIDUAL", "FAMILY", "PRO"]) {
      expect(hasFeature(entries, paid, "subscription_featHomeDossier")).toBe(true);
      expect(hasFeature(entries, paid, "subscription_featVehicleCheck")).toBe(true);
      expect(hasFeature(entries, paid, "subscription_featWeatherDigest")).toBe(true);
    }
    for (const k of ["subscription_featHomeDossier", "subscription_featVehicleCheck", "subscription_featWeatherDigest"]) {
      expect(hasFeature(entries, "FREE_TRIAL", k)).toBe(false);
    }
  });

  // Real map is Family+Pro only.
  it("puts the real map in Family and Pro only", () => {
    const entries = buildPlanComparison(webInput);
    expect(hasFeature(entries, "FAMILY", "subscription_featRealMap")).toBe(true);
    expect(hasFeature(entries, "PRO", "subscription_featRealMap")).toBe(true);
    expect(hasFeature(entries, "FREE_TRIAL", "subscription_featRealMap")).toBe(false);
    expect(hasFeature(entries, "INDIVIDUAL", "subscription_featRealMap")).toBe(false);
  });

  // Movers, dossier PDF, multiple concurrent plans and priority support are Pro-only.
  it("puts movers, dossier PDF, multi-plan and priority support in Pro only", () => {
    const entries = buildPlanComparison(webInput);
    const proOnly = [
      "subscription_featMovers",
      "subscription_featDossierPdf",
      "subscription_featConcurrentPlans",
      "subscription_featPrioritySupport",
      "subscription_featPartnerHub",
      "subscription_featTaxExport",
    ];
    for (const k of proOnly) {
      expect(hasFeature(entries, "PRO", k)).toBe(true);
      for (const lower of ["FREE_TRIAL", "INDIVIDUAL", "FAMILY"]) {
        expect(hasFeature(entries, lower, k)).toBe(false);
      }
    }
    // Pro advertises running 3 move plans at once.
    expect(valueOf(entries, "PRO", "subscription_featConcurrentPlans")).toBe(3);
  });

  it("includes smart provider suggestions with FCC & utility data in every tier, including Free", () => {
    const entries = buildPlanComparison(webInput);
    for (const key of ["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"]) {
      expect(hasFeature(entries, key, "subscription_featSmartSuggestions")).toBe(true);
    }
  });

  // Caps and seats mirror the web compare table — drift fails CI here.
  it("mirrors web address/service caps (3/10/15/25 · 10/100/500/1000) and seats (1/1/5/10)", () => {
    const entries = buildPlanComparison(webInput);
    expect(valueOf(entries, "FREE_TRIAL", "subscription_featAddresses")).toBe(3);
    expect(valueOf(entries, "INDIVIDUAL", "subscription_featAddresses")).toBe(10);
    expect(valueOf(entries, "FAMILY", "subscription_featAddresses")).toBe(15);
    expect(valueOf(entries, "PRO", "subscription_featAddresses")).toBe(25);

    expect(valueOf(entries, "FREE_TRIAL", "subscription_featServices")).toBe(10);
    expect(valueOf(entries, "INDIVIDUAL", "subscription_featServices")).toBe(100);
    expect(valueOf(entries, "FAMILY", "subscription_featServices")).toBe(500);
    expect(valueOf(entries, "PRO", "subscription_featServices")).toBe(1000);

    // Members only listed on shared tiers (seatLimit > 1): Family 5, Pro 10.
    expect(hasFeature(entries, "FREE_TRIAL", "subscription_featMembers")).toBe(false);
    expect(hasFeature(entries, "INDIVIDUAL", "subscription_featMembers")).toBe(false);
    expect(valueOf(entries, "FAMILY", "subscription_featMembers")).toBe(5);
    expect(valueOf(entries, "PRO", "subscription_featMembers")).toBe(10);
  });

  it("keeps move plan and export differentiators honest", () => {
    const entries = buildPlanComparison(webInput);
    // Free previews the move plan; paid tiers unlock the full one.
    expect(hasFeature(entries, "FREE_TRIAL", "subscription_featMovePlanPreview")).toBe(true);
    expect(hasFeature(entries, "FREE_TRIAL", "subscription_featMovePlanFull")).toBe(false);
    for (const paid of ["INDIVIDUAL", "FAMILY", "PRO"]) {
      expect(hasFeature(entries, paid, "subscription_featMovePlanFull")).toBe(true);
      expect(hasFeature(entries, paid, "subscription_featExport")).toBe(true);
    }
    // CSV/PDF export is paid-only.
    expect(hasFeature(entries, "FREE_TRIAL", "subscription_featExport")).toBe(false);
  });

  it("marks the effective plan as current and falls back to Free for unknown plans", () => {
    const family = buildPlanComparison({ ...webInput, currentPlanKey: "FAMILY" });
    expect(family.filter((e) => e.isCurrent).map((e) => e.key)).toEqual(["FAMILY"]);
    const none = buildPlanComparison({ ...webInput, currentPlanKey: null });
    expect(none.filter((e) => e.isCurrent).map((e) => e.key)).toEqual(["FREE_TRIAL"]);
    const unknown = buildPlanComparison({ ...webInput, currentPlanKey: "LEGACY_X" });
    expect(unknown.filter((e) => e.isCurrent).map((e) => e.key)).toEqual(["FREE_TRIAL"]);
  });

  it("shows definition prices off-store and hides paid prices when store commerce is not advertisable", () => {
    const web = buildPlanComparison(webInput);
    expect(web.find((e) => e.key === "FREE_TRIAL")?.priceLabel).toBe("Free");
    expect(web.find((e) => e.key === "INDIVIDUAL")?.priceLabel).toBe("$3.99/month · $39.99/year");

    const store = buildPlanComparison({
      currentPlanKey: "FREE_TRIAL",
      isNativeStorePlatform: true,
      mobileStoreCommerceAdvertisable: false,
      hasAvailableNativeSku: () => false,
    });
    expect(store.find((e) => e.key === "FREE_TRIAL")?.priceLabel).toBe("Free");
    for (const paid of ["INDIVIDUAL", "FAMILY", "PRO"]) {
      expect(store.find((e) => e.key === paid)?.priceLabel).toBe("");
    }
  });

  it("shows prices only for store-purchasable plans on native platforms, keeping the current plan visible", () => {
    const entries = buildPlanComparison({
      currentPlanKey: "PRO",
      isNativeStorePlatform: true,
      mobileStoreCommerceAdvertisable: true,
      hasAvailableNativeSku: (planKey) => planKey === "INDIVIDUAL",
    });
    expect(entries.find((e) => e.key === "INDIVIDUAL")?.priceLabel).toBe("$3.99/month · $39.99/year");
    expect(entries.find((e) => e.key === "FAMILY")?.priceLabel).toBe("");
    // The user's own plan stays priced even without a native SKU.
    expect(entries.find((e) => e.key === "PRO")?.priceLabel).toBe("$19.99/month · $199/year");
  });

  it("prefers localized store prices when loaded", () => {
    const entries = buildPlanComparison({
      currentPlanKey: "FREE_TRIAL",
      isNativeStorePlatform: true,
      mobileStoreCommerceAdvertisable: true,
      hasAvailableNativeSku: (planKey) => planKey === "INDIVIDUAL",
      getStorePriceLabel: (planKey, cycle) =>
        planKey === "INDIVIDUAL" ? (cycle === "monthly" ? "$3.49" : "$34.99") : null,
    });
    expect(entries.find((e) => e.key === "INDIVIDUAL")?.priceLabel).toBe("$3.49/month · $34.99/year");
  });
});

describe("comparisonPriceLabel", () => {
  it("falls back to definition labels when no localized price exists", () => {
    expect(comparisonPriceLabel("FAMILY")).toBe("$9.99/month · $99/year");
    expect(comparisonPriceLabel("FREE_TRIAL")).toBe("Free");
  });
});

describe("shouldShowComparisonPrice", () => {
  it("requires advertisable commerce plus an available SKU for non-current paid plans on store platforms", () => {
    const base = {
      isPaid: true,
      isCurrent: false,
      isNativeStorePlatform: true,
      mobileStoreCommerceAdvertisable: true,
      planHasAvailableNativeSku: true,
    };
    expect(shouldShowComparisonPrice(base)).toBe(true);
    expect(shouldShowComparisonPrice({ ...base, planHasAvailableNativeSku: false })).toBe(false);
    expect(shouldShowComparisonPrice({ ...base, mobileStoreCommerceAdvertisable: false })).toBe(false);
    expect(shouldShowComparisonPrice({ ...base, isCurrent: true, planHasAvailableNativeSku: false })).toBe(true);
    expect(shouldShowComparisonPrice({ ...base, isPaid: false, planHasAvailableNativeSku: false })).toBe(true);
    expect(
      shouldShowComparisonPrice({ ...base, isNativeStorePlatform: false, planHasAvailableNativeSku: false }),
    ).toBe(true);
  });
});

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

function featuresOf(entries: PlanComparisonEntry[], key: string): string[] {
  const entry = entries.find((e) => e.key === key);
  if (!entry) throw new Error(`missing plan ${key}`);
  return entry.features;
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

  it("puts AI move briefing and New Home Dossier in every paid tier but not Free", () => {
    const entries = buildPlanComparison(webInput);
    for (const paid of ["INDIVIDUAL", "FAMILY", "PRO"]) {
      const features = featuresOf(entries, paid);
      expect(features.some((f) => f.includes("AI move briefing"))).toBe(true);
      expect(features.some((f) => f.includes("New Home Dossier"))).toBe(true);
    }
    const free = featuresOf(entries, "FREE_TRIAL");
    expect(free.some((f) => f.includes("AI move briefing"))).toBe(false);
    expect(free.some((f) => f.includes("New Home Dossier"))).toBe(false);
  });

  it("includes smart provider suggestions with FCC & utility data in every tier, including Free", () => {
    const entries = buildPlanComparison(webInput);
    for (const key of ["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"]) {
      expect(
        featuresOf(entries, key).some((f) => f.includes("Smart provider suggestions")),
      ).toBe(true);
    }
  });

  it("keeps existing differentiators honest: move plan, members, Partner Hub, exports", () => {
    const entries = buildPlanComparison(webInput);
    // Free previews the move plan; Individual unlocks the full one.
    expect(featuresOf(entries, "FREE_TRIAL").some((f) => f.includes("Preview your move plan"))).toBe(true);
    expect(featuresOf(entries, "INDIVIDUAL").some((f) => f.includes("Full personalized move plan"))).toBe(true);
    // Member counts come from the shared definitions (6 / 10 seats).
    expect(featuresOf(entries, "FAMILY").some((f) => f.includes("Up to 6 members"))).toBe(true);
    expect(featuresOf(entries, "PRO").some((f) => f.includes("up to 10 members"))).toBe(true);
    // Partner Hub is Pro-only; CSV/PDF export is paid-tier.
    expect(featuresOf(entries, "PRO").some((f) => f.includes("Partner Hub"))).toBe(true);
    for (const key of ["FREE_TRIAL", "INDIVIDUAL", "FAMILY"]) {
      expect(featuresOf(entries, key).some((f) => f.includes("Partner Hub"))).toBe(false);
    }
    expect(featuresOf(entries, "INDIVIDUAL").some((f) => f.includes("CSV, PDF"))).toBe(true);
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

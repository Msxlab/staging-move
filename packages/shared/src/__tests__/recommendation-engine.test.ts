import { describe, it, expect } from "vitest";
import {
  CATEGORY_META,
  PROVIDER_CATEGORY_VALUES,
  scoreProviders,
  type Provider,
  type UserProfile,
} from "../recommendation-engine";

describe("category taxonomy", () => {
  it("every PROVIDER_CATEGORY_VALUES entry has matching CATEGORY_META", () => {
    const missing = PROVIDER_CATEGORY_VALUES.filter((v) => !CATEGORY_META[v]);
    expect(missing).toEqual([]);
  });

  it("CATEGORY_META has no orphan keys outside PROVIDER_CATEGORY_VALUES", () => {
    const canonical = new Set<string>(PROVIDER_CATEGORY_VALUES);
    const orphans = Object.keys(CATEGORY_META).filter((k) => !canonical.has(k));
    expect(orphans).toEqual([]);
  });

  it("CATEGORY_META orders are unique", () => {
    const orders = Object.values(CATEGORY_META).map((m) => m.order);
    const unique = new Set(orders);
    expect(unique.size).toBe(orders.length);
  });

  it("every CATEGORY_META entry has non-empty label and icon", () => {
    for (const [key, meta] of Object.entries(CATEGORY_META)) {
      expect(meta.label, `${key} missing label`).toBeTruthy();
      expect(meta.icon, `${key} missing icon`).toBeTruthy();
    }
  });
});

describe("provider recommendation safety", () => {
  const baseProfile: UserProfile = {
    hasChildren: false,
    childrenCount: 0,
    hasPets: false,
    hasSenior: false,
    carCount: 1,
    hasDisability: false,
    needsStorage: false,
    hasMotorcycle: false,
    hasBoatRV: false,
    currentPhase: 1,
  };

  function provider(overrides: Partial<Provider>): Provider {
    return {
      id: overrides.id || "provider",
      name: overrides.name || "Provider",
      slug: overrides.slug || "provider",
      category: overrides.category || "UTILITY_ELECTRIC",
      description: null,
      website: null,
      phone: null,
      scope: overrides.scope || "STATE",
      states: overrides.states || ["TX"],
      tags: overrides.tags || [],
      popularityScore: overrides.popularityScore ?? 0,
      displayOrder: overrides.displayOrder ?? 0,
      userCount: overrides.userCount ?? 0,
      coverageModel: overrides.coverageModel,
      coverageMatchLevel: overrides.coverageMatchLevel,
      coverageNote: overrides.coverageNote,
      coverageSourceUrl: overrides.coverageSourceUrl,
      requiresAddressCheck: overrides.requiresAddressCheck,
      requiresPolygonCheck: overrides.requiresPolygonCheck,
    };
  }

  it("ranks high-confidence local utilities above broad national listings", () => {
    const scored = scoreProviders(
      [
        provider({
          id: "national-electric",
          name: "National Electric Listing",
          scope: "FEDERAL",
          popularityScore: 100,
          coverageModel: "live_address",
          coverageMatchLevel: "live_address",
          requiresAddressCheck: true,
        }),
        provider({
          id: "local-electric",
          name: "Local Electric Utility",
          scope: "STATE",
          popularityScore: 1,
          coverageModel: "zip_prefix",
          coverageMatchLevel: "prefix",
        }),
      ],
      baseProfile,
      "TX",
    );

    expect(scored[0].id).toBe("local-electric");
    expect(scored[0].explanation.coverageConfidence).toBe("ZIP_PREFIX");
    expect(scored[0].explanation.recommendationUse).toBe("MANUAL_TRACKING_CANDIDATE");
  });

  it("returns caveats and manual confirmation language for weak coverage", () => {
    const [scored] = scoreProviders(
      [
        provider({
          id: "state-water",
          name: "State Water Listing",
          category: "UTILITY_WATER",
          coverageModel: "state",
          coverageMatchLevel: "state",
        }),
      ],
      baseProfile,
      "TX",
    );

    expect(scored.explanation.coverageConfidence).toBe("STATE_LEVEL");
    expect(scored.explanation.caveat).toContain("not proof");
    expect(scored.explanation.manualConfirmationNote).toContain("manual guidance");
  });
});

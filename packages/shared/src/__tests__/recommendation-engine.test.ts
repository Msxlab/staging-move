import { describe, it, expect } from "vitest";
import {
  CATEGORY_META,
  PROVIDER_CATEGORY_VALUES,
  DEFAULT_SCORING_WEIGHTS,
  getRecommendedProviders,
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

  it("does not put address-sensitive unverified coverage into the recommended shortlist", () => {
    const scored = scoreProviders(
      [
        provider({
          id: "unknown-water",
          name: "Unknown Water",
          category: "UTILITY_WATER",
          coverageMatchLevel: undefined,
          coverageModel: undefined,
          popularityScore: 100,
        }),
        provider({
          id: "state-water",
          name: "State Water",
          category: "UTILITY_WATER",
          coverageMatchLevel: "state",
          coverageModel: "state",
          popularityScore: 1,
        }),
      ],
      baseProfile,
      "TX",
    );

    expect(getRecommendedProviders(scored).map((p) => p.id)).toEqual(["state-water"]);
  });
});

describe("profile-aware urgency tiers", () => {
  function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
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
      ...overrides,
    };
  }

  function provider(category: string): Provider {
    return {
      id: category,
      name: category,
      slug: category.toLowerCase(),
      category,
      description: null,
      website: null,
      phone: null,
      scope: "FEDERAL",
      states: [],
      tags: [],
      popularityScore: 50,
      displayOrder: 0,
      userCount: 0,
    };
  }

  function tierFor(category: string, profile: UserProfile): string {
    const [scored] = scoreProviders([provider(category)], profile, "TX");
    return scored.urgencyTier;
  }

  it("demotes vehicle categories to OPTIONAL for a carless user", () => {
    const carless = baseProfile({ carCount: 0 });
    expect(tierFor("FINANCIAL_INSURANCE_AUTO", carless)).toBe("OPTIONAL");
    expect(tierFor("TRANSPORTATION_TOLL", carless)).toBe("OPTIONAL");
  });

  it("keeps vehicle categories at their base tier when the user owns a car", () => {
    const driver = baseProfile({ carCount: 2 });
    expect(tierFor("FINANCIAL_INSURANCE_AUTO", driver)).toBe("CRITICAL");
    expect(tierFor("TRANSPORTATION_TOLL", driver)).toBe("IMPORTANT");
  });

  it("demotes kids categories to OPTIONAL for a childless user", () => {
    const childless = baseProfile({ hasChildren: false });
    expect(tierFor("KIDS_SCHOOL", childless)).toBe("OPTIONAL");
    const parent = baseProfile({ hasChildren: true, childrenCount: 2 });
    expect(tierFor("KIDS_SCHOOL", parent)).toBe("IMPORTANT");
  });

  it("gates pet categories on pet ownership", () => {
    expect(tierFor("HEALTHCARE_VET", baseProfile({ hasPets: false }))).toBe("OPTIONAL");
    expect(tierFor("HEALTHCARE_VET", baseProfile({ hasPets: true }))).toBe("RECOMMENDED");
  });

  it("steers home vs renters insurance by ownership", () => {
    const renter = baseProfile({ ownership: "RENT" });
    expect(tierFor("FINANCIAL_INSURANCE_HOME", renter)).toBe("OPTIONAL");
    expect(tierFor("FINANCIAL_MORTGAGE", renter)).toBe("OPTIONAL");
    expect(tierFor("FINANCIAL_INSURANCE_RENTERS", renter)).toBe("CRITICAL");

    const owner = baseProfile({ ownership: "OWN" });
    expect(tierFor("FINANCIAL_INSURANCE_HOME", owner)).toBe("CRITICAL");
    expect(tierFor("FINANCIAL_INSURANCE_RENTERS", owner)).toBe("OPTIONAL");
  });

  it("does not gate DMV — license/ID transfer applies regardless of vehicle ownership", () => {
    expect(tierFor("GOVERNMENT_DMV", baseProfile({ carCount: 0 }))).toBe("CRITICAL");
  });
});

describe("onboarding-signal wiring", () => {
  function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      hasSenior: false,
      carCount: 0,
      hasDisability: false,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
      currentPhase: 1,
      ...overrides,
    };
  }

  function provider(overrides: Partial<Provider>): Provider {
    return {
      id: overrides.id || "p",
      name: overrides.name || "Provider",
      slug: overrides.slug || (overrides.id || "p"),
      category: overrides.category || "GOVERNMENT_OTHER",
      description: null,
      website: null,
      phone: null,
      scope: overrides.scope || "FEDERAL",
      states: overrides.states || [],
      tags: overrides.tags || [],
      popularityScore: overrides.popularityScore ?? 50,
      displayOrder: 0,
      userCount: 0,
    };
  }

  function scoreOf(p: Provider, profile: UserProfile): number {
    return scoreProviders([p], profile, "TX")[0].recommendationScore;
  }

  it("boosts military/veteran benefits for a military profile and deprioritizes for others", () => {
    const va = provider({ id: "va", category: "GOVERNMENT_BENEFITS", tags: ["veterans", "government", "military"] });
    const military = scoreOf(va, baseProfile({ isMilitary: true }));
    const civilian = scoreOf(va, baseProfile({ isMilitary: false }));
    expect(military).toBeGreaterThan(civilian);
  });

  it("derives military steering even when only moveType=MILITARY is supplied via isMilitary fold (route-level), tag matcher fires on isMilitary", () => {
    const sss = provider({ id: "sss", category: "GOVERNMENT_OTHER", tags: ["military", "government"] });
    expect(scoreOf(sss, baseProfile({ isMilitary: true }))).toBeGreaterThan(
      scoreOf(sss, baseProfile({ isMilitary: false })),
    );
  });

  it("boosts immigration services for immigrants and deprioritizes immigration LEGAL services for non-immigrants", () => {
    const uscis = provider({ id: "uscis", category: "GOVERNMENT_IMMIGRATION", tags: ["immigration", "government", "essential"] });
    expect(scoreOf(uscis, baseProfile({ isImmigrant: true }))).toBeGreaterThan(
      scoreOf(uscis, baseProfile({ isImmigrant: false })),
    );

    const immigrationLawyer = provider({ id: "imm-law", category: "LEGAL_SERVICES", tags: ["immigration", "legal"] });
    expect(scoreOf(immigrationLawyer, baseProfile({ isImmigrant: true }))).toBeGreaterThan(
      scoreOf(immigrationLawyer, baseProfile({ isImmigrant: false })),
    );
  });

  it("never penalizes the federal GOVERNMENT_IMMIGRATION AR-11 task for non-immigrants", () => {
    // USCIS carries the immigration tag but is the legally-required AR-11 task —
    // a non-immigrant (or non-disclosing) profile must not see it negatively scored.
    const uscis = provider({ id: "uscis", category: "GOVERNMENT_IMMIGRATION", tags: ["immigration", "government", "essential"] });
    const nonImmigrantOnImmigrationLegal = scoreOf(
      provider({ id: "imm-law", category: "LEGAL_SERVICES", tags: ["immigration", "legal"] }),
      baseProfile({ isImmigrant: false }),
    );
    const legalBaseline = scoreOf(
      provider({ id: "plain-law", category: "LEGAL_SERVICES", tags: ["legal"] }),
      baseProfile({ isImmigrant: false }),
    );
    // The immigration-tagged legal service is penalized (−10) vs a plain legal service…
    expect(nonImmigrantOnImmigrationLegal).toBeLessThan(legalBaseline);
    // …but the federal immigration task is NOT penalized below an equivalent
    // non-immigration federal service of the same urgency.
    const uscisNonImmigrant = scoreOf(uscis, baseProfile({ isImmigrant: false }));
    const otherFederal = scoreOf(
      provider({ id: "other-imm", category: "GOVERNMENT_IMMIGRATION", tags: ["government"] }),
      baseProfile({ isImmigrant: false }),
    );
    expect(uscisNonImmigrant).toBeGreaterThanOrEqual(otherFederal);
  });

  it("boosts business-relocation services for business owners and deprioritizes for others", () => {
    const sba = provider({ id: "sba", category: "GOVERNMENT_OTHER", tags: ["business", "government", "loan"] });
    expect(scoreOf(sba, baseProfile({ isBusinessOwner: true }))).toBeGreaterThan(
      scoreOf(sba, baseProfile({ isBusinessOwner: false })),
    );
  });
});

describe("injectable scoring weights", () => {
  function profile(): UserProfile {
    return {
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
  }

  function provider(category: string): Provider {
    return {
      id: category,
      name: category,
      slug: category.toLowerCase(),
      category,
      description: null,
      website: null,
      phone: null,
      scope: "FEDERAL",
      states: [],
      tags: [],
      popularityScore: 50,
      displayOrder: 0,
      userCount: 0,
    };
  }

  it("reproduces default behaviour when no overrides are supplied", () => {
    const withoutContext = scoreProviders([provider("UTILITY_ELECTRIC")], profile(), "TX")[0];
    const withEmptyContext = scoreProviders([provider("UTILITY_ELECTRIC")], profile(), "TX", undefined, undefined, {})[0];
    expect(withEmptyContext.recommendationScore).toBe(withoutContext.recommendationScore);
  });

  it("applies an urgency-tier weight override additively", () => {
    const p = provider("UTILITY_ELECTRIC");
    const base = scoreProviders([p], profile(), "TX")[0].recommendationScore;
    const bumped = scoreProviders([p], profile(), "TX", undefined, undefined, {
      weights: { urgencyTier: { ...DEFAULT_SCORING_WEIGHTS.urgencyTier, CRITICAL: DEFAULT_SCORING_WEIGHTS.urgencyTier.CRITICAL + 50 } },
    })[0].recommendationScore;
    expect(bumped - base).toBe(50);
  });

  it("applies an essential-category weight override additively", () => {
    const p = provider("UTILITY_ELECTRIC");
    const base = scoreProviders([p], profile(), "TX")[0].recommendationScore;
    const bumped = scoreProviders([p], profile(), "TX", undefined, undefined, {
      weights: { essentialCategories: { UTILITY_ELECTRIC: (DEFAULT_SCORING_WEIGHTS.essentialCategories.UTILITY_ELECTRIC || 0) + 10 } },
    })[0].recommendationScore;
    expect(bumped - base).toBe(10);
  });
});

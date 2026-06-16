import { describe, it, expect } from "vitest";
import {
  CATEGORY_META,
  PROVIDER_CATEGORY_VALUES,
  DEFAULT_SCORING_WEIGHTS,
  buildRecommendationClusters,
  getRecommendedProviders,
  getEssentialSetupCategories,
  scoreProviders,
  type Provider,
  type UserProfile,
} from "../recommendation-engine";

describe("getEssentialSetupCategories (dashboard AI card source)", () => {
  const renterNoCarNoKids: UserProfile = {
    hasChildren: false,
    childrenCount: 0,
    hasPets: false,
    hasSenior: false,
    carCount: 0,
    hasDisability: false,
    needsStorage: false,
    hasMotorcycle: false,
    hasBoatRV: false,
    ownership: "RENT",
  };

  it("returns profile-gated CRITICAL + IMPORTANT categories, dropping irrelevant ones", () => {
    const { critical, important } = getEssentialSetupCategories(renterNoCarNoKids, []);
    // Universal essentials are present.
    expect(critical).toContain("GOVERNMENT_POSTAL");
    expect(critical).toContain("UTILITY_ELECTRIC");
    expect(important).toContain("UTILITY_INTERNET");
    expect(important).toContain("FINANCIAL_BANK");
    // Renter → renters insurance is critical, home insurance is gated out.
    expect(critical).toContain("FINANCIAL_INSURANCE_RENTERS");
    expect(critical).not.toContain("FINANCIAL_INSURANCE_HOME");
    // No car → auto insurance + toll gated out; no kids → school gated out.
    expect(critical).not.toContain("FINANCIAL_INSURANCE_AUTO");
    expect(important).not.toContain("KIDS_SCHOOL");
    expect(important).not.toContain("TRANSPORTATION_TOLL");
  });

  it("includes car/kid categories when the profile is relevant", () => {
    const carParentOwner: UserProfile = {
      ...renterNoCarNoKids,
      carCount: 2,
      hasChildren: true,
      ownership: "OWN",
    };
    const { critical, important } = getEssentialSetupCategories(carParentOwner, []);
    expect(critical).toContain("FINANCIAL_INSURANCE_AUTO");
    expect(critical).toContain("FINANCIAL_INSURANCE_HOME");
    expect(critical).not.toContain("FINANCIAL_INSURANCE_RENTERS");
    expect(important).toContain("KIDS_SCHOOL");
  });

  it("closes a category once it is completed (case-insensitive)", () => {
    const before = getEssentialSetupCategories(renterNoCarNoKids, []);
    expect(before.important).toContain("FINANCIAL_BANK");
    const after = getEssentialSetupCategories(renterNoCarNoKids, ["financial_bank", "UTILITY_ELECTRIC"]);
    expect(after.important).not.toContain("FINANCIAL_BANK");
    expect(after.critical).not.toContain("UTILITY_ELECTRIC");
  });
});

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

  it("treats utilityServiceable=true as available-at-address, identically to fccServiceable", () => {
    // utilityServiceable is set by the upstream OpenEI electric-utility lookup
    // (apps/web/src/lib/electric-utility.ts) and must mirror fccServiceable:
    // confirmed providers win AVAILABLE_AT_ADDRESS confidence over the
    // catalog-derived live_address tier; unconfirmed siblings keep the
    // "check availability" posture.
    const scored = scoreProviders(
      [
        provider({
          id: "confirmed-electric",
          name: "Austin Energy",
          scope: "FEDERAL",
          coverageModel: "live_address",
          coverageMatchLevel: "live_address",
          requiresAddressCheck: true,
        }),
        provider({
          id: "unconfirmed-electric",
          name: "Other Electric Co",
          scope: "FEDERAL",
          coverageModel: "live_address",
          coverageMatchLevel: "live_address",
          requiresAddressCheck: true,
        }),
      ].map((p) => (p.id === "confirmed-electric" ? { ...p, utilityServiceable: true } : p)),
      baseProfile,
      "TX",
    );

    const confirmed = scored.find((p) => p.id === "confirmed-electric")!;
    const unconfirmed = scored.find((p) => p.id === "unconfirmed-electric")!;

    expect(confirmed.explanation.coverageConfidence).toBe("AVAILABLE_AT_ADDRESS");
    expect(confirmed.explanation.qualityProfile.score).toBeGreaterThan(unconfirmed.explanation.qualityProfile.score);
    expect(confirmed.explanation.qualityProfile.gaps.map((gap) => gap.code)).not.toContain("coverage_precision");
    expect(confirmed.matchReasons).toContain("Available at your address");
    expect(unconfirmed.explanation.coverageConfidence).toBe("ADDRESS_CHECK_REQUIRED");
    expect(confirmed.recommendationScore).toBeGreaterThan(unconfirmed.recommendationScore);
  });

  it("falls back to catalog confidence when utilityServiceable is absent or false", () => {
    const base = {
      id: "electric",
      name: "Electric Co",
      scope: "FEDERAL",
      coverageModel: "live_address" as const,
      coverageMatchLevel: "live_address" as const,
      requiresAddressCheck: true,
    };
    const [absent] = scoreProviders([provider(base)], baseProfile, "TX");
    const [explicitFalse] = scoreProviders(
      [{ ...provider(base), utilityServiceable: false }],
      baseProfile,
      "TX",
    );

    expect(absent.explanation.coverageConfidence).toBe("ADDRESS_CHECK_REQUIRED");
    expect(explicitFalse.explanation.coverageConfidence).toBe("ADDRESS_CHECK_REQUIRED");
    expect(explicitFalse.recommendationScore).toBe(absent.recommendationScore);
  });

  it("boosts time-sensitive setups as the move date nears (proximity signal)", () => {
    const electric = provider({ id: "electric", category: "UTILITY_ELECTRIC", popularityScore: 50 });

    const soon = scoreProviders([electric], { ...baseProfile, daysUntilMove: 3 }, "TX")[0];
    const later = scoreProviders([electric], { ...baseProfile, daysUntilMove: 60 }, "TX")[0];
    const noDate = scoreProviders([electric], { ...baseProfile, daysUntilMove: undefined }, "TX")[0];

    // A move 3 days out ranks the same utility higher than one 60 days out / no date.
    expect(soon.recommendationScore).toBeGreaterThan(later.recommendationScore);
    expect(soon.recommendationScore).toBeGreaterThan(noDate.recommendationScore);
    // Deadline-aware reason surfaces inside the 14-day window.
    expect(soon.matchReasons.join(" ")).toContain("Move in 3 days");
    // 60 days out is past the proximity window → no proximity reason.
    expect(later.matchReasons.join(" ")).not.toContain("set this up now");
  });

  it("ranks address-tied essentials above moving logistics in phase 0 (no truck-before-bank)", () => {
    // Regression: in early-planning (phase 0) the moving-truck category used to
    // get an oversized phase boost and outrank the bank/utilities a move forces
    // you to update. Day-one essentials must lead; logistics stay mid-list.
    const bank = provider({ id: "bank", category: "FINANCIAL_BANK" });
    const electric = provider({ id: "elec", category: "UTILITY_ELECTRIC" });
    const uhaul = provider({ id: "uhaul", category: "HOUSING_MOVING" });
    const scored = scoreProviders([uhaul, bank, electric], { ...baseProfile, currentPhase: 0 }, "TX");
    const scoreOf = (id: string) => scored.find((p) => p.id === id)!.recommendationScore;
    expect(scoreOf("bank")).toBeGreaterThan(scoreOf("uhaul"));
    expect(scoreOf("elec")).toBeGreaterThan(scoreOf("uhaul"));
  });

  it("damps optional extras in the final week before the move", () => {
    // HEALTHCARE_VET with no pets resolves to OPTIONAL.
    const vet = provider({ id: "vet", category: "HEALTHCARE_VET", popularityScore: 80 });
    const noPets = { ...baseProfile, hasPets: false };

    const soon = scoreProviders([vet], { ...noPets, daysUntilMove: 3 }, "TX")[0];
    const later = scoreProviders([vet], { ...noPets, daysUntilMove: 60 }, "TX")[0];

    expect(soon.urgencyTier).toBe("OPTIONAL");
    expect(soon.recommendationScore).toBeLessThan(later.recommendationScore);
  });

  it("excludes dismissed providers from clusters but keeps them browseable", () => {
    const scored = scoreProviders(
      [
        provider({ id: "elec", category: "UTILITY_ELECTRIC" }),
        provider({ id: "water", category: "UTILITY_WATER" }),
      ],
      baseProfile,
      "TX",
    );
    const result = buildRecommendationClusters(scored, [], new Set(["elec"]));
    const clusterIds = result.clusters.flatMap((c) => c.providers.map((p) => p.id));

    expect(clusterIds).not.toContain("elec"); // dismissed → out of the recommendation clusters
    expect(clusterIds).toContain("water");
    expect(result.allProviders.map((p) => p.id)).toContain("elec"); // still in the full directory
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

describe("extended onboarding signals (block 4d)", () => {
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

  it("familyStatus FAMILY ranks family-relevant providers above COUPLE, which ranks above SINGLE", () => {
    const school = provider({ id: "school", category: "KIDS_SCHOOL", tags: ["kids", "education"] });
    const parent = (familyStatus?: string) =>
      baseProfile({ hasChildren: true, childrenCount: 1, familyStatus });

    const family = scoreOf(school, parent("FAMILY"));
    const couple = scoreOf(school, parent("COUPLE"));
    const single = scoreOf(school, parent("SINGLE"));

    expect(family).toBeGreaterThan(couple);
    expect(couple).toBeGreaterThan(single);
    // Conservative by contract: the whole familyStatus swing stays modest (≤15).
    expect(family - single).toBeLessThanOrEqual(15);
  });

  it("familyStatus FAMILY can flip the ranking toward a family-relevant category", () => {
    // Same tier (RECOMMENDED for a parent), no tags; the gym leads on raw
    // popularity until the FAMILY signal nudges the kids activity ahead.
    const activity = provider({ id: "kids-activity", category: "KIDS_ACTIVITY", popularityScore: 50 });
    const gym = provider({ id: "gym", category: "FITNESS_GYM", popularityScore: 80 });
    const parent = (familyStatus: string) =>
      baseProfile({ hasChildren: true, childrenCount: 1, familyStatus });

    const without = scoreProviders([activity, gym], parent("SINGLE"), "TX").map((p) => p.id);
    const withFamily = scoreProviders([activity, gym], parent("FAMILY"), "TX").map((p) => p.id);

    expect(without).toEqual(["gym", "kids-activity"]);
    expect(withFamily).toEqual(["kids-activity", "gym"]);
  });

  it("ageRange 55+ boosts senior/medicare-tagged providers without requiring the household-senior boolean", () => {
    const medicare = provider({ id: "medicare", category: "GOVERNMENT_HEALTH", tags: ["medicare", "senior"] });

    const older = scoreOf(medicare, baseProfile({ ageRange: "55+" }));
    const younger = scoreOf(medicare, baseProfile({ ageRange: "25-34" }));
    const undisclosed = scoreOf(medicare, baseProfile());

    expect(older).toBeGreaterThan(younger);
    expect(younger).toBe(undisclosed); // non-senior buckets carry no signal
  });

  it("petTypes listed ranks pet-tagged providers slightly above the bare hasPets boolean", () => {
    const vet = provider({ id: "vet", category: "HEALTHCARE_VET", tags: ["vet", "pet"] });

    const withTypes = scoreOf(vet, baseProfile({ hasPets: true, petTypes: ["dog", "cat"] }));
    const booleanOnly = scoreOf(vet, baseProfile({ hasPets: true, petTypes: [] }));

    expect(withTypes).toBeGreaterThan(booleanOnly);
    // "Slightly above": modest by contract, never a tier-sized jump.
    expect(withTypes - booleanOnly).toBeLessThanOrEqual(15);
    // Blank entries are not a signal.
    const blankTypes = scoreOf(vet, baseProfile({ hasPets: true, petTypes: ["  "] }));
    expect(blankTypes).toBe(booleanOnly);
  });

  it("businessType deepens the business-services boost beyond the isBusinessOwner boolean", () => {
    const sba = provider({ id: "sba", category: "GOVERNMENT_OTHER", tags: ["business", "government"] });

    const typed = scoreOf(sba, baseProfile({ isBusinessOwner: true, businessType: "LLC" }));
    const booleanOnly = scoreOf(sba, baseProfile({ isBusinessOwner: true }));

    expect(typed).toBeGreaterThan(booleanOnly);
    expect(typed - booleanOnly).toBeLessThanOrEqual(15);
  });

  it("an active immigration status reinforces the immigration path beyond isImmigrant; CITIZEN/blank carry no signal", () => {
    const uscis = provider({ id: "uscis", category: "GOVERNMENT_IMMIGRATION", tags: ["immigration", "government"] });

    const active = scoreOf(uscis, baseProfile({ isImmigrant: true, immigrationStatus: "GREEN_CARD" }));
    const booleanOnly = scoreOf(uscis, baseProfile({ isImmigrant: true }));
    const citizen = scoreOf(uscis, baseProfile({ isImmigrant: true, immigrationStatus: "CITIZEN" }));
    const blank = scoreOf(uscis, baseProfile({ isImmigrant: true, immigrationStatus: "" }));

    expect(active).toBeGreaterThan(booleanOnly);
    expect(citizen).toBe(booleanOnly);
    expect(blank).toBe(booleanOnly);
  });

  it("treats absent/non-matching extended signals as no-signal (scores unchanged)", () => {
    const school = provider({ id: "school", category: "KIDS_SCHOOL", tags: ["kids"] });
    const plain = scoreOf(school, baseProfile({ hasChildren: true }));
    const explicitNoSignal = scoreOf(
      school,
      baseProfile({
        hasChildren: true,
        familyStatus: "OTHER",
        ageRange: "",
        petTypes: [],
        businessType: null,
        immigrationStatus: null,
      }),
    );
    expect(explicitNoSignal).toBe(plain);
  });

  it("keeps every extended-signal weight modest (≤15) and overridable through the weights table", () => {
    for (const [key, value] of Object.entries(DEFAULT_SCORING_WEIGHTS.signalBoosts)) {
      expect(value, `${key} must stay modest`).toBeLessThanOrEqual(15);
      expect(value, `${key} must be non-negative`).toBeGreaterThanOrEqual(0);
    }

    // RECOMMENDATION_SCORING_WEIGHTS-style override is applied additively,
    // exactly like the other weight groups.
    const vet = provider({ id: "vet", category: "HEALTHCARE_VET", tags: ["vet"] });
    const petProfile = baseProfile({ hasPets: true, petTypes: ["dog"] });
    const base = scoreProviders([vet], petProfile, "TX")[0].recommendationScore;
    const bumped = scoreProviders([vet], petProfile, "TX", undefined, undefined, {
      weights: {
        signalBoosts: {
          ...DEFAULT_SCORING_WEIGHTS.signalBoosts,
          petTypesListed: DEFAULT_SCORING_WEIGHTS.signalBoosts.petTypesListed + 5,
        },
      },
    })[0].recommendationScore;
    expect(bumped - base).toBe(5);
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

describe("true geo-local ranking", () => {
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

  function provider(overrides: Partial<Provider>): Provider {
    return {
      id: overrides.id || "p",
      name: overrides.name || overrides.id || "Provider",
      slug: overrides.slug || overrides.id || "p",
      category: overrides.category || "HOUSING_HOME_SERVICE",
      description: null,
      website: null,
      phone: null,
      scope: overrides.scope || "STATE",
      states: overrides.states || ["TX"],
      tags: overrides.tags || [],
      popularityScore: overrides.popularityScore ?? 50,
      displayOrder: overrides.displayOrder ?? 0,
      userCount: overrides.userCount ?? 0,
      coverageModel: overrides.coverageModel,
      coverageMatchLevel: overrides.coverageMatchLevel,
      latitude: overrides.latitude,
      longitude: overrides.longitude,
    };
  }

  // Austin, TX as the user's destination.
  const userLat = 30.2672;
  const userLng = -97.7431;

  it("ranks the nearer geo-bearing provider higher when both have coordinates", () => {
    const near = provider({ id: "near", latitude: 30.27, longitude: -97.74 }); // ~0.5km
    const far = provider({ id: "far", latitude: 32.7767, longitude: -96.797 }); // Dallas, ~300km
    const scored = scoreProviders(
      [far, near],
      baseProfile({ latitude: userLat, longitude: userLng }),
      "TX",
    );
    expect(scored.map((p) => p.id)).toEqual(["near", "far"]);
    // The nearer provider should also carry the larger proximity bonus in score.
    const nearScore = scored.find((p) => p.id === "near")!.recommendationScore;
    const farScore = scored.find((p) => p.id === "far")!.recommendationScore;
    expect(nearScore).toBeGreaterThan(farScore);
  });

  it("ignores geo when the user has no coordinates (no crash, no reorder by distance)", () => {
    const a = provider({ id: "a", latitude: 30.27, longitude: -97.74, popularityScore: 10 });
    const b = provider({ id: "b", latitude: 40.0, longitude: -80.0, popularityScore: 90 });
    const scored = scoreProviders([a, b], baseProfile(), "TX");
    // Without user coordinates the geo bonus is 0 for both, so the higher-
    // popularity provider wins as it did before the geo feature existed.
    expect(scored[0].id).toBe("b");
  });

  it("leaves a provider without coordinates unaffected by the geo component", () => {
    const geoless = provider({ id: "geoless", popularityScore: 50 });
    const withProfile = baseProfile({ latitude: userLat, longitude: userLng });
    const a = scoreProviders([geoless], withProfile, "TX")[0].recommendationScore;
    const b = scoreProviders([geoless], baseProfile(), "TX")[0].recommendationScore;
    expect(a).toBe(b);
  });

  it("keeps the comparator a transitive strict total order with mixed geo/non-geo providers", () => {
    // Build a deliberately adversarial set: same category/tier, varying score,
    // coverage, displayOrder, popularity, and geo distance — including ties on
    // several fields and providers with/without coordinates.
    const providers: Provider[] = [];
    const coords: Array<[number, number] | null> = [
      [30.27, -97.74], [31.0, -97.0], [32.77, -96.8], null, [30.3, -97.7], null, [29.4, -98.5], [30.27, -97.74],
    ];
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      providers.push(
        provider({
          id: `g${i}`,
          popularityScore: (i * 37) % 100,
          displayOrder: i % 3,
          coverageMatchLevel: i % 2 === 0 ? "state" : "prefix",
          coverageModel: i % 2 === 0 ? "state" : "zip_prefix",
          latitude: c ? c[0] : undefined,
          longitude: c ? c[1] : undefined,
        }),
      );
    }
    const profile = baseProfile({ latitude: userLat, longitude: userLng });
    const scored = scoreProviders(providers, profile, "TX");

    // Recover the comparator by re-scoring single providers and reading the
    // public ordering: the result of scoreProviders is the sorted output, so a
    // transitive comparator means the order is independent of input permutation.
    // Verify by shuffling the input several ways and asserting identical output.
    const permute = (arr: Provider[], seed: number) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = (i * 7 + seed * 13 + 5) % (i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    const baseline = scored.map((p) => p.id);
    for (let seed = 1; seed <= 6; seed++) {
      const reordered = scoreProviders(permute(providers, seed), profile, "TX").map((p) => p.id);
      expect(reordered).toEqual(baseline);
    }
  });
});

describe("robust communityPopular keying", () => {
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

  function provider(overrides: Partial<Provider>): Provider {
    return {
      id: overrides.id || "p",
      name: overrides.name || overrides.id || "Provider",
      slug: overrides.slug ?? (overrides.id || "p"),
      category: overrides.category || "HOUSING_HOME_SERVICE",
      description: null,
      website: null,
      phone: null,
      scope: "STATE",
      states: ["TX"],
      tags: [],
      popularityScore: overrides.popularityScore ?? 0,
      displayOrder: 0,
      userCount: 0,
    };
  }

  it("keys community popularity by provider id (the canonical aggregate key)", () => {
    const p = provider({ id: "prov-id-1", slug: "prov-slug-1" });
    const withSignal = scoreProviders([p], profile(), "TX", { "prov-id-1": 20 })[0].recommendationScore;
    const without = scoreProviders([p], profile(), "TX", {})[0].recommendationScore;
    expect(withSignal - without).toBe(20);
  });

  it("does NOT read the slug namespace at all (id-only contract)", () => {
    // The upstream producer keys strictly by providerId, so a slug-keyed value
    // must be ignored — there is no slug fallback to silently borrow from.
    const p = provider({ id: "prov-id-2", slug: "prov-slug-2" });
    const bySlug = scoreProviders([p], profile(), "TX", { "prov-slug-2": 15 })[0].recommendationScore;
    const without = scoreProviders([p], profile(), "TX", {})[0].recommendationScore;
    expect(bySlug).toBe(without);
  });

  it("does NOT cross-read another namespace: a slug equal to a different provider's id is not borrowed", () => {
    // map is keyed by id only; provider A's slug collides with provider B's id.
    const a = provider({ id: "A", slug: "B" });
    const community = { B: 18 }; // belongs to provider B's id, not A
    const aScore = scoreProviders([a], profile(), "TX", community)[0].recommendationScore;
    const aBaseline = scoreProviders([a], profile(), "TX", {})[0].recommendationScore;
    // A has no id "A" entry; its slug "B" must NOT borrow B's id-keyed value.
    expect(aScore).toBe(aBaseline);
  });

  it("treats an explicit zero id-value as no signal (no truthy short-circuit bug)", () => {
    const p = provider({ id: "z", slug: "z-slug" });
    const community = { z: 0 };
    const score = scoreProviders([p], profile(), "TX", community)[0].recommendationScore;
    const baseline = scoreProviders([p], profile(), "TX", {})[0].recommendationScore;
    expect(score).toBe(baseline);
  });
});

describe("readiness stats — completedCritical (M1)", () => {
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

  function provider(overrides: Partial<Provider>): Provider {
    return {
      id: overrides.id || "p",
      name: overrides.name || overrides.id || "Provider",
      slug: overrides.slug ?? (overrides.id || "p"),
      category: overrides.category || "UTILITY_ELECTRIC",
      description: null,
      website: null,
      phone: null,
      scope: "STATE",
      states: ["TX"],
      tags: [],
      popularityScore: 50,
      displayOrder: 0,
      userCount: 0,
    };
  }

  it("counts only completed CRITICAL categories, never optional ones (gym/streaming)", () => {
    const scored = scoreProviders(
      [
        provider({ id: "elec", category: "UTILITY_ELECTRIC" }), // CRITICAL
        provider({ id: "water", category: "UTILITY_WATER" }), // CRITICAL
        provider({ id: "gym", category: "FITNESS_GYM" }), // OPTIONAL/RECOMMENDED — never critical
        provider({ id: "stream", category: "SHOPPING_SUBSCRIPTION" }), // OPTIONAL
      ],
      profile(),
      "TX",
    );

    // User has completed one CRITICAL category (electric) and two non-critical
    // ones (gym, streaming). The old heuristic counted all 3; completedCritical
    // must count ONLY the critical one.
    const result = buildRecommendationClusters(scored, [
      "UTILITY_ELECTRIC",
      "FITNESS_GYM",
      "SHOPPING_SUBSCRIPTION",
    ]);

    expect(result.stats.completedCritical).toBe(1);
    // It equals the CRITICAL cluster's completedCount by construction.
    const criticalCluster = result.clusters.find((c) => c.tier === "CRITICAL");
    expect(result.stats.completedCritical).toBe(criticalCluster?.completedCount ?? -1);
    // The still-missing critical category (water) is surfaced and not double-counted.
    expect(result.stats.missingCritical).toContain("UTILITY_WATER");
  });

  it("is zero when no critical categories are completed even if optional ones are", () => {
    const scored = scoreProviders(
      [
        provider({ id: "elec", category: "UTILITY_ELECTRIC" }), // CRITICAL, pending
        provider({ id: "gym", category: "FITNESS_GYM" }), // OPTIONAL/RECOMMENDED, completed
      ],
      profile(),
      "TX",
    );
    const result = buildRecommendationClusters(scored, ["FITNESS_GYM"]);
    expect(result.stats.completedCritical).toBe(0);
  });
});

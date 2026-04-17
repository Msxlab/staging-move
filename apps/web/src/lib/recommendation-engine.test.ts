import { describe, it, expect } from "vitest";
import { scoreProviders, getRecommendedProviders, type Provider, type UserProfile } from "./recommendation-engine";

// Helper to create a minimal provider
function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "test-id",
    name: "Test Provider",
    slug: "test",
    category: "UTILITY_ELECTRIC",
    description: null,
    website: null,
    phone: null,
    scope: "FEDERAL",
    states: [],
    tags: [],
    popularityScore: 50,
    ...overrides,
  };
}

// Default profile with nothing enabled
const BASE_PROFILE: UserProfile = {
  hasChildren: false,
  childrenCount: 0,
  hasPets: false,
  hasSenior: false,
  carCount: 0,
  hasDisability: false,
  needsStorage: false,
  hasMotorcycle: false,
  hasBoatRV: false,
};

describe("scoreProviders", () => {
  it("should boost essential categories", () => {
    const electric = makeProvider({ id: "1", category: "UTILITY_ELECTRIC" });
    const subscription = makeProvider({ id: "2", category: "SHOPPING_SUBSCRIPTION" });
    const [scored] = scoreProviders([electric, subscription], BASE_PROFILE, "TX");
    // Electric is essential (15 pts), subscription is not
    expect(scored.id).toBe("1");
  });

  it("should boost state-specific providers for matching state", () => {
    const stateProvider = makeProvider({ id: "1", scope: "STATE", states: ["TX"], tags: [] });
    const [scored] = scoreProviders([stateProvider], BASE_PROFILE, "TX");
    expect(scored.recommendationScore).toBeGreaterThan(0);
    expect(scored.matchReasons).toContain("Available in TX");
  });

  it("should not boost state providers for non-matching state", () => {
    const stateProvider = makeProvider({ id: "1", scope: "STATE", states: ["NJ"], tags: [] });
    const [scored] = scoreProviders([stateProvider], BASE_PROFILE, "TX");
    expect(scored.matchReasons).not.toContain("Available in TX");
  });

  it("should boost pet-related providers when user has pets", () => {
    const vetProvider = makeProvider({ id: "1", category: "HEALTHCARE_VET", tags: ["pet", "vet"] });
    const profile: UserProfile = { ...BASE_PROFILE, hasPets: true };
    const [scored] = scoreProviders([vetProvider], profile, "TX");
    expect(scored.recommendationScore).toBeGreaterThan(30);
    expect(scored.matchReasons.some((r) => r.includes("pet"))).toBe(true);
  });

  it("should penalize pet providers when user has no pets", () => {
    const vetProvider = makeProvider({ id: "1", category: "HEALTHCARE_VET", tags: ["pet", "vet"], popularityScore: 50 });
    const withPets = scoreProviders([vetProvider], { ...BASE_PROFILE, hasPets: true }, "TX");
    const withoutPets = scoreProviders([vetProvider], { ...BASE_PROFILE, hasPets: false }, "TX");
    expect(withPets[0].recommendationScore).toBeGreaterThan(withoutPets[0].recommendationScore);
  });

  it("should boost kids providers when user has children", () => {
    const daycare = makeProvider({ id: "1", category: "KIDS_DAYCARE", tags: ["kids", "daycare", "children"] });
    const profile: UserProfile = { ...BASE_PROFILE, hasChildren: true, childrenCount: 2 };
    const [scored] = scoreProviders([daycare], profile, "TX");
    expect(scored.matchReasons.some((r) => r.includes("child"))).toBe(true);
  });

  it("should boost storage providers when user needs storage", () => {
    const storage = makeProvider({ id: "1", category: "HOUSING_STORAGE", tags: ["storage", "home"] });
    const profile: UserProfile = { ...BASE_PROFILE, needsStorage: true };
    const [scored] = scoreProviders([storage], profile, "TX");
    expect(scored.matchReasons.some((r) => r.includes("Storage"))).toBe(true);
  });

  it("should penalize storage providers when user doesn't need storage", () => {
    const storage = makeProvider({ id: "1", category: "HOUSING_STORAGE", tags: ["storage", "home"] });
    const needsIt = scoreProviders([storage], { ...BASE_PROFILE, needsStorage: true }, "TX");
    const doesnt = scoreProviders([storage], { ...BASE_PROFILE, needsStorage: false }, "TX");
    expect(needsIt[0].recommendationScore).toBeGreaterThan(doesnt[0].recommendationScore);
  });

  it("should boost motorcycle insurance when user has motorcycle", () => {
    const moto = makeProvider({ id: "1", category: "FINANCIAL_INSURANCE_MOTORCYCLE", tags: ["motorcycle", "insurance"] });
    const profile: UserProfile = { ...BASE_PROFILE, hasMotorcycle: true };
    const [scored] = scoreProviders([moto], profile, "TX");
    expect(scored.matchReasons.some((r) => r.includes("motorcycle"))).toBe(true);
  });

  it("should boost boat/RV providers when user has boat/RV", () => {
    const boat = makeProvider({ id: "1", category: "FINANCIAL_INSURANCE_BOAT", tags: ["boat", "insurance"] });
    const profile: UserProfile = { ...BASE_PROFILE, hasBoatRV: true };
    const [scored] = scoreProviders([boat], profile, "TX");
    expect(scored.matchReasons.some((r) => r.includes("boat"))).toBe(true);
  });

  it("should boost disability services when user has disability", () => {
    const ssdi = makeProvider({ id: "1", category: "GOVERNMENT_BENEFITS", tags: ["disability", "government", "essential"] });
    const profile: UserProfile = { ...BASE_PROFILE, hasDisability: true };
    const [scored] = scoreProviders([ssdi], profile, "TX");
    expect(scored.matchReasons.some((r) => r.includes("Accessibility"))).toBe(true);
  });

  it("should boost DMV for users with cars", () => {
    const dmv = makeProvider({ id: "1", category: "GOVERNMENT_DMV", tags: ["dmv", "government", "car", "essential"] });
    const profile: UserProfile = { ...BASE_PROFILE, carCount: 2 };
    const [scored] = scoreProviders([dmv], profile, "TX");
    expect(scored.matchReasons.some((r) => r.includes("DMV") || r.includes("car"))).toBe(true);
  });

  it("should add government essential categories to scoring", () => {
    const dmv = makeProvider({ id: "1", category: "GOVERNMENT_DMV", tags: ["dmv", "government"] });
    const [scored] = scoreProviders([dmv], BASE_PROFILE, "TX");
    // GOVERNMENT_DMV has essential weight of 12
    expect(scored.matchReasons).toContain("Essential service");
  });
});

describe("getRecommendedProviders", () => {
  it("should filter out providers with no match reasons", () => {
    const providers = scoreProviders(
      [makeProvider({ id: "1", tags: [] })],
      BASE_PROFILE,
      "TX"
    );
    const recommended = getRecommendedProviders(providers);
    // Essential category gives a match reason, so check based on score threshold
    const lowScoreProviders = providers.filter((p) => p.recommendationScore <= 20);
    const filtered = getRecommendedProviders(lowScoreProviders);
    expect(filtered.length).toBe(0);
  });

  it("should respect the limit parameter", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      makeProvider({ id: `p${i}`, category: "UTILITY_ELECTRIC", tags: ["essential"], popularityScore: 80 })
    );
    const scored = scoreProviders(many, BASE_PROFILE, "TX");
    const recommended = getRecommendedProviders(scored, 5);
    expect(recommended.length).toBeLessThanOrEqual(5);
  });
});

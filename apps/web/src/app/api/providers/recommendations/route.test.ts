import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
    },
    address: {
      findMany: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    movingPlan: {
      findFirst: vi.fn(),
    },
    serviceProvider: {
      findMany: vi.fn(),
    },
    stateRule: {
      findUnique: vi.fn(),
    },
    recommendationFeedback: {
      findMany: vi.fn(),
    },
    savedProvider: {
      findMany: vi.fn(),
    },
    providerGovernanceIssue: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/request-entitlements", () => ({
  requestHasPlanFeature: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@locateflow/db", () => ({
  getProviderCoverageMetadata: vi.fn(() => null),
  zipCentroid: vi.fn(() => null),
}));

vi.mock("@/lib/recommendation-engine", () => ({
  // Attach a tier + score so the region-grouped top-picks block (which reads
  // urgencyTier/recommendationScore) is exercised; spreads keep enrichment fields
  // like utilityServiceable that the FCC/electric blocks set before scoring.
  scoreProviders: vi.fn((providers: any[]) =>
    providers.map((p) => ({
      ...p,
      urgencyTier: p.urgencyTier ?? "CRITICAL",
      recommendationScore: p.recommendationScore ?? 50,
    })),
  ),
  buildRecommendationClusters: vi.fn((providers: unknown[]) => ({
    recommended: [],
    clusters: [],
    allProviders: providers,
  })),
  getMergedDisplayCategoryLabel: vi.fn((c: string) => c),
  getMergedDisplayCategoryOrder: vi.fn(() => 0),
  getEssentialSetupCategories: vi.fn(() => ({
    critical: ["UTILITY_ELECTRIC"],
    important: ["UTILITY_INTERNET"],
  })),
}));

vi.mock("@/lib/fcc-isp", () => ({
  lookupFccIsps: vi.fn(async () => ({
    status: "not_configured",
    providers: [],
    normalizedBrandNames: new Set<string>(),
    blockGeoid: null,
    reason: "fcc_bdc_disabled",
    source: {
      name: "FCC National Broadband Map (BDC)",
      url: "https://broadbandmap.fcc.gov/",
      selfReported: true,
    },
  })),
  isIspServiceable: vi.fn(() => false),
  normalizeIspName: vi.fn((name: string | null | undefined) =>
    (name || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .replace(/internet|communications|telecom|broadband/g, ""),
  ),
}));

// Electric-utility enrichment is mocked so the route tests can drive each
// lookup status deterministically (the real module is unit-tested in
// src/lib/electric-utility.test.ts). Defaults mirror production defaults:
// unconfigured lookup, nothing serviceable.
vi.mock("@/lib/electric-utility", () => ({
  lookupElectricUtilities: vi.fn(async () => ({
    status: "not_configured",
    utilities: [],
    normalizedNames: new Set<string>(),
    reason: "electric_lookup_disabled",
    source: {
      name: "OpenEI U.S. Utility Rate Database (URDB)",
      url: "https://openei.org/wiki/Utility_Rate_Database",
      modeled: true,
    },
  })),
  isElectricUtilityServiceable: vi.fn(() => false),
  normalizeUtilityName: vi.fn((name: string | null | undefined) =>
    (name || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token && !["city", "of", "energy", "electric", "utility", "company", "texas"].includes(token))
      .sort()
      .join(""),
  ),
  utilityNamesMatch: vi.fn((a: string | null | undefined, b: string | null | undefined) => {
    const clean = (value: string | null | undefined) =>
      (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((token) => token && !["city", "of", "energy", "electric", "utility", "company", "texas"].includes(token));
    const tokensA = new Set(clean(a));
    const tokensB = new Set(clean(b));
    if (tokensA.size === 0 || tokensB.size === 0) return false;
    const [small, large] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
    return [...small].every((token) => large.has(token));
  }),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { requestHasPlanFeature } from "@/lib/request-entitlements";
import { lookupFccIsps, isIspServiceable } from "@/lib/fcc-isp";
import { lookupElectricUtilities, isElectricUtilityServiceable } from "@/lib/electric-utility";
import { scoreProviders } from "@/lib/recommendation-engine";
import { GET } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockProfile = prisma.profile as unknown as { findUnique: Mock };
const mockAddress = prisma.address as unknown as { findMany: Mock };
const mockService = prisma.service as unknown as { findMany: Mock };
const mockMovingPlan = prisma.movingPlan as unknown as { findFirst: Mock };
const mockServiceProvider = prisma.serviceProvider as unknown as { findMany: Mock };
const mockStateRule = prisma.stateRule as unknown as { findUnique: Mock };
const mockRecFeedback = prisma.recommendationFeedback as unknown as { findMany: Mock };
const mockSavedProvider = prisma.savedProvider as unknown as { findMany: Mock };
const mockProviderGovernanceIssue = prisma.providerGovernanceIssue as unknown as {
  findFirst: Mock;
  create: Mock;
};
const rateLimitMock = rateLimit as unknown as Mock;
const requestHasPlanFeatureMock = requestHasPlanFeature as unknown as Mock;
const lookupFccIspsMock = lookupFccIsps as unknown as Mock;
const isIspServiceableMock = isIspServiceable as unknown as Mock;
const lookupElectricUtilitiesMock = lookupElectricUtilities as unknown as Mock;
const isElectricUtilityServiceableMock = isElectricUtilityServiceable as unknown as Mock;
const scoreProvidersMock = scoreProviders as unknown as Mock;

function makeRequest(search = "") {
  return new Request(`http://localhost/api/providers/recommendations${search}`) as any;
}

function electricLookupResult(overrides: Record<string, unknown> = {}) {
  return {
    status: "not_configured",
    utilities: [],
    normalizedNames: new Set<string>(),
    reason: "electric_lookup_disabled",
    source: {
      name: "OpenEI U.S. Utility Rate Database (URDB)",
      url: "https://openei.org/wiki/Utility_Rate_Database",
      modeled: true,
    },
    ...overrides,
  };
}

function fccLookupResult(overrides: Record<string, unknown> = {}) {
  return {
    status: "not_configured",
    providers: [],
    normalizedBrandNames: new Set<string>(),
    blockGeoid: null,
    reason: "fcc_bdc_disabled",
    source: {
      name: "FCC National Broadband Map (BDC)",
      url: "https://broadbandmap.fcc.gov/",
      selfReported: true,
    },
    ...overrides,
  };
}

/** A minimal federal catalog provider row as returned by prisma. */
function dbProvider(overrides: Record<string, unknown> = {}) {
  return {
    id: "provider-1",
    name: "Provider",
    slug: "provider",
    category: "UTILITY_ELECTRIC",
    subCategory: null,
    description: null,
    website: null,
    phone: null,
    logoUrl: null,
    scope: "FEDERAL",
    states: "[]",
    zipCodes: "[]",
    tags: "[]",
    popularityScore: 50,
    displayOrder: 0,
    userCount: 0,
    isActive: true,
    ...overrides,
  };
}

describe("provider recommendations route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockProfile.findUnique.mockResolvedValue(null);
    mockAddress.findMany.mockResolvedValue([]);
    mockService.findMany.mockResolvedValue([]);
    mockMovingPlan.findFirst.mockResolvedValue(null);
    mockServiceProvider.findMany.mockResolvedValue([]);
    mockStateRule.findUnique.mockResolvedValue(null);
    mockRecFeedback.findMany.mockResolvedValue([]);
    mockSavedProvider.findMany.mockResolvedValue([]);
    mockProviderGovernanceIssue.findFirst.mockResolvedValue(null);
    mockProviderGovernanceIssue.create.mockResolvedValue({});
    requestHasPlanFeatureMock.mockResolvedValue(true);
    lookupFccIspsMock.mockResolvedValue(fccLookupResult());
    isIspServiceableMock.mockReturnValue(false);
    lookupElectricUtilitiesMock.mockResolvedValue(electricLookupResult());
    isElectricUtilityServiceableMock.mockReturnValue(false);
  });

  it("keeps no-context recommendations to federal non-transit candidates", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.allProviders).toEqual([]);
    expect(mockServiceProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          scope: "FEDERAL",
          category: { not: "TRANSPORTATION_TRANSIT" },
        }),
        include: { coverages: false },
      }),
    );
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.stringContaining("rl:provider_recommendations:user:"),
      expect.objectContaining({ limit: 120, windowSeconds: 60, failClosed: false }),
    );
  });

  it("uses a generous recommendation limit so normal dashboard usage is not throttled", async () => {
    await GET(makeRequest());

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 120, windowSeconds: 60 }),
    );
  });

  it("heads recommendations with the user's region and groups top picks per category (#3a)", async () => {
    mockAddress.findMany.mockResolvedValue([
      { id: "addr-1", isPrimary: true, city: "Austin", state: "TX", zip: "78701", latitude: null, longitude: null, deletedAt: null },
    ]);
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "electric-1", name: "Austin Energy", category: "UTILITY_ELECTRIC" }),
      dbProvider({ id: "electric-2", name: "Reliant", category: "UTILITY_ELECTRIC" }),
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    // Region label comes straight from the address (no dataset needed).
    expect(body.region).toEqual({ city: "Austin", state: "TX", label: "Austin, TX" });
    // Pending CRITICAL/IMPORTANT category gets a region group with top-N providers.
    expect(Array.isArray(body.regionGroups)).toBe(true);
    const electricGroup = body.regionGroups.find((g: { category: string }) => g.category === "UTILITY_ELECTRIC");
    expect(electricGroup).toBeTruthy();
    expect(electricGroup.providers.length).toBe(2);
    expect(electricGroup.providers.length).toBeLessThanOrEqual(3);
  });

  it("returns the auth gate response instead of a generic 500 when unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(mockServiceProvider.findMany).not.toHaveBeenCalled();
  });

  // ── Extended onboarding signals → scoring profile (engine block 4d) ───────

  it("passes the extended onboarding signals from the profile row into scoring", async () => {
    mockProfile.findUnique.mockResolvedValue({
      hasChildren: true,
      childrenCount: 2,
      hasPets: true,
      // Persisted exactly as the Profile model stores it: a JSON string.
      petTypes: JSON.stringify(["dog", "cat"]),
      familyStatus: "FAMILY",
      ageRange: "55+",
      isBusinessOwner: true,
      businessType: "LLC",
      isImmigrant: true,
      immigrationStatus: "GREEN_CARD",
    });
    mockServiceProvider.findMany.mockResolvedValue([dbProvider()]);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(scoreProvidersMock).toHaveBeenCalledTimes(1);
    const passedProfile = scoreProvidersMock.mock.calls[0][1];
    expect(passedProfile).toMatchObject({
      familyStatus: "FAMILY",
      ageRange: "55+",
      petTypes: ["dog", "cat"], // JSON string parsed into a real array
      businessType: "LLC",
      immigrationStatus: "GREEN_CARD",
    });
  });

  it("returns a recommendation guide with visible onboarding-derived signals", async () => {
    mockProfile.findUnique.mockResolvedValue({
      familyStatus: "FAMILY",
      hasChildren: true,
      childrenCount: 2,
      hasPets: true,
      petTypes: JSON.stringify(["dog"]),
      carCount: 1,
      needsStorage: true,
      isBusinessOwner: false,
      isImmigrant: false,
      isMilitary: false,
      moveType: "PERSONAL",
    });
    mockAddress.findMany.mockResolvedValue([
      {
        id: "addr-1",
        isPrimary: true,
        city: "Queens",
        state: "NY",
        zip: "11105",
        ownership: "RENTER",
        latitude: null,
        longitude: null,
        deletedAt: null,
      },
    ]);
    mockServiceProvider.findMany.mockResolvedValue([dbProvider()]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendationGuide).toBeTruthy();
    expect(body.recommendationGuide.profileSignals).toEqual(
      expect.arrayContaining([
        "Queens, NY",
        "Renter household",
        "Family profile",
        "2 children",
        "Pets: dog",
      ]),
    );
    expect(body.recommendationGuide.completion).toEqual(
      expect.objectContaining({
        score: 0,
        completedCritical: 0,
        missingCritical: 1,
        missingLabels: ["UTILITY_ELECTRIC"],
        nextBestCategory: "UTILITY_ELECTRIC",
      }),
    );
    expect(body.recommendationGuide.setupPlan).toEqual(
      expect.objectContaining({
        primaryNextCategory: "UTILITY_ELECTRIC",
        primaryNextLabel: "UTILITY_ELECTRIC",
        totalOpenCategories: 2,
      }),
    );
    expect(body.recommendationGuide.setupPlan.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "move_in_essentials",
          categories: expect.arrayContaining([
            expect.objectContaining({
              category: "UTILITY_ELECTRIC",
              label: "UTILITY_ELECTRIC",
              urgency: "CRITICAL",
            }),
            expect.objectContaining({
              category: "UTILITY_INTERNET",
              label: "UTILITY_INTERNET",
              urgency: "IMPORTANT",
            }),
          ]),
        }),
      ]),
    );
    expect(body.recommendationGuide.decisionModel.factors).toEqual(
      expect.arrayContaining([
        "Move-in essentials are ranked before nice-to-have services.",
        "Already tracked service categories are removed from setup gaps.",
      ]),
    );
    expect(body.recommendationGuide.decisionModel.learningSignals).toEqual(
      expect.arrayContaining(["6 profile signals tune the recommendation order."]),
    );
  });

  it("defaults the extended signals to no-signal when no profile row exists", async () => {
    mockServiceProvider.findMany.mockResolvedValue([dbProvider()]);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const passedProfile = scoreProvidersMock.mock.calls[0][1];
    expect(passedProfile.familyStatus).toBeUndefined();
    expect(passedProfile.ageRange).toBeUndefined();
    expect(passedProfile.petTypes).toEqual([]); // safeJsonArray of a missing value
    expect(passedProfile.businessType).toBeUndefined();
    expect(passedProfile.immigrationStatus).toBeUndefined();
  });

  // ── FCC ISP serviceability enrichment ─────────────────────────────────────

  it("gates data-checked provider serviceability without address validation entitlement", async () => {
    requestHasPlanFeatureMock.mockResolvedValue(false);
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "internet-1", name: "Xfinity", category: "UTILITY_INTERNET" }),
      dbProvider({ id: "electric-1", name: "Austin Energy", category: "UTILITY_ELECTRIC" }),
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(lookupFccIspsMock).not.toHaveBeenCalled();
    expect(lookupElectricUtilitiesMock).not.toHaveBeenCalled();
    expect(body.meta.fcc).toEqual({ status: "gated", confirmedCount: 0, blockGeoid: null });
    expect(body.meta.electric).toEqual({ status: "gated", confirmedCount: 0, utilityCount: 0 });
  });

  it("checks FCC source health for setup-critical internet even when no internet candidates exist", async () => {
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "electric-1", name: "Austin Energy", category: "UTILITY_ELECTRIC" }),
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(lookupFccIspsMock).toHaveBeenCalledTimes(1);
    expect(body.meta.fcc).toEqual({ status: "not_configured", confirmedCount: 0, blockGeoid: null });
  });

  it("flags matching internet providers fccServiceable when the FCC lookup confirms them", async () => {
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "internet-1", name: "Xfinity", category: "UTILITY_INTERNET" }),
      dbProvider({ id: "internet-2", name: "AT&T Internet", category: "UTILITY_INTERNET" }),
      dbProvider({ id: "electric-1", name: "Austin Energy" }),
    ]);
    lookupFccIspsMock.mockResolvedValue(
      fccLookupResult({
        status: "ok",
        providers: [
          {
            brandName: "Xfinity",
            providerId: "123",
            maxDownloadMbps: 1000,
            maxUploadMbps: 40,
            technologyCodes: [40],
          },
        ],
        normalizedBrandNames: new Set(["xfinity"]),
        blockGeoid: "484530011001",
        reason: null,
      }),
    );
    isIspServiceableMock.mockImplementation((_result: unknown, name: string) => name === "Xfinity");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(lookupFccIspsMock).toHaveBeenCalledTimes(1);

    const confirmed = body.allProviders.find((p: { id: string }) => p.id === "internet-1");
    const unconfirmed = body.allProviders.find((p: { id: string }) => p.id === "internet-2");
    const electric = body.allProviders.find((p: { id: string }) => p.id === "electric-1");
    expect(confirmed.fccServiceable).toBe(true);
    expect(unconfirmed.fccServiceable).toBeUndefined();
    expect(electric.fccServiceable).toBeUndefined();

    expect(body.meta.fcc).toEqual({ status: "ok", confirmedCount: 1, blockGeoid: "484530011001" });
  });

  it("leaves providers untouched when the FCC lookup is not configured", async () => {
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "internet-1", name: "Xfinity", category: "UTILITY_INTERNET" }),
    ]);
    isIspServiceableMock.mockReturnValue(true);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    const provider = body.allProviders.find((p: { id: string }) => p.id === "internet-1");
    expect(provider.fccServiceable).toBeUndefined();
    expect(body.meta.fcc).toEqual({ status: "not_configured", confirmedCount: 0, blockGeoid: null });
  });

  it("degrades gracefully (200, untouched recs) even if the FCC lookup throws", async () => {
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "internet-1", name: "Xfinity", category: "UTILITY_INTERNET" }),
    ]);
    lookupFccIspsMock.mockRejectedValue(new Error("unexpected"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    const provider = body.allProviders.find((p: { id: string }) => p.id === "internet-1");
    expect(provider.fccServiceable).toBeUndefined();
    expect(body.meta.fcc).toEqual({ status: "not_configured", confirmedCount: 0, blockGeoid: null });
  });

  // ── Electric-utility serviceability enrichment (mirrors the FCC block) ────

  it("checks OpenEI source health for setup-critical electric even when no electric candidates exist", async () => {
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "internet-1", name: "Comcast", category: "UTILITY_INTERNET" }),
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(lookupElectricUtilitiesMock).toHaveBeenCalledTimes(1);
    expect(body.meta.electric).toEqual({ status: "not_configured", confirmedCount: 0, utilityCount: 0 });
  });

  it("flags matching electric providers utilityServiceable when the lookup confirms them", async () => {
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "electric-1", name: "Austin Energy" }),
      dbProvider({ id: "electric-2", name: "Reliant Energy" }),
      dbProvider({ id: "internet-1", name: "Comcast", category: "UTILITY_INTERNET" }),
    ]);
    lookupElectricUtilitiesMock.mockResolvedValue(
      electricLookupResult({
        status: "ok",
        utilities: [{ name: "City of Austin, Texas (Utility Company)", eiaId: "16604" }],
        normalizedNames: new Set(["austintexas"]),
        reason: null,
      }),
    );
    isElectricUtilityServiceableMock.mockImplementation(
      (_result: unknown, name: string) => name === "Austin Energy",
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(lookupElectricUtilitiesMock).toHaveBeenCalledTimes(1);

    const confirmed = body.allProviders.find((p: { id: string }) => p.id === "electric-1");
    const unconfirmed = body.allProviders.find((p: { id: string }) => p.id === "electric-2");
    const internet = body.allProviders.find((p: { id: string }) => p.id === "internet-1");
    expect(confirmed.utilityServiceable).toBe(true);
    expect(unconfirmed.utilityServiceable).toBeUndefined();
    // Only electric providers are ever consulted/flagged by this block.
    expect(internet.utilityServiceable).toBeUndefined();

    expect(body.meta.electric).toEqual({ status: "ok", confirmedCount: 1, utilityCount: 1 });
  });

  it("records API-backed missing infrastructure providers for admin review", async () => {
    mockAddress.findMany.mockResolvedValue([
      {
        id: "addr-austin",
        isPrimary: true,
        city: "Austin",
        state: "TX",
        zip: "78701",
        latitude: 30.2672,
        longitude: -97.7431,
        deletedAt: null,
      },
    ]);
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "electric-2", name: "Reliant Energy", category: "UTILITY_ELECTRIC" }),
    ]);
    lookupElectricUtilitiesMock.mockResolvedValue(
      electricLookupResult({
        status: "ok",
        utilities: [{ name: "City of Austin, Texas (Utility Company)", eiaId: "16604" }],
        normalizedNames: new Set(["austintexas"]),
        reason: null,
      }),
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(lookupElectricUtilitiesMock).toHaveBeenCalledTimes(1);
    expect(body.meta.sourceGaps).toEqual([
      expect.objectContaining({
        source: "OPENEI_URDB",
        category: "UTILITY_ELECTRIC",
        name: "City of Austin, Texas (Utility Company)",
        sourceProviderId: "16604",
      }),
    ]);
    expect(mockProviderGovernanceIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueType: "SOURCE_PROVIDER_MISSING",
          severity: "HIGH",
          title: "Source provider missing: UTILITY_ELECTRIC City of Austin, Texas (Utility Company)",
          metadata: expect.objectContaining({
            source: "OPENEI_URDB",
            category: "UTILITY_ELECTRIC",
            providerName: "City of Austin, Texas (Utility Company)",
            state: "TX",
            zip: "78701",
            addressId: "addr-austin",
          }),
        }),
      }),
    );
  });

  it("leaves providers untouched when the electric lookup is not configured", async () => {
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "electric-1", name: "Austin Energy" }),
    ]);
    // Even a (mis)matching predicate must not fire for a non-ok status —
    // the route only consults it once the lookup answered authoritatively.
    isElectricUtilityServiceableMock.mockReturnValue(true);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    const provider = body.allProviders.find((p: { id: string }) => p.id === "electric-1");
    expect(provider.utilityServiceable).toBeUndefined();
    expect(body.meta.electric).toEqual({ status: "not_configured", confirmedCount: 0, utilityCount: 0 });
  });

  it("degrades gracefully (200, untouched recs) even if the electric lookup throws", async () => {
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "electric-1", name: "Austin Energy" }),
    ]);
    lookupElectricUtilitiesMock.mockRejectedValue(new Error("unexpected"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    const provider = body.allProviders.find((p: { id: string }) => p.id === "electric-1");
    expect(provider.utilityServiceable).toBeUndefined();
    expect(body.meta.electric).toEqual({ status: "not_configured", confirmedCount: 0, utilityCount: 0 });
  });
});

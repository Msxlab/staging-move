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
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@locateflow/db", () => ({
  getProviderCoverageMetadata: vi.fn(() => null),
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
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
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
const rateLimitMock = rateLimit as unknown as Mock;
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

  // ── Electric-utility serviceability enrichment (mirrors the FCC block) ────

  it("skips the electric lookup entirely when no electric candidates exist", async () => {
    mockServiceProvider.findMany.mockResolvedValue([
      dbProvider({ id: "internet-1", name: "Comcast", category: "UTILITY_INTERNET" }),
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(lookupElectricUtilitiesMock).not.toHaveBeenCalled();
    expect(body.meta.electric).toEqual({ status: "skipped", confirmedCount: 0, utilityCount: 0 });
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

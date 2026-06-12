import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserPlan: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

// getUserPlan is mocked (no DB); planFeatures stays REAL so the vehicleCheck
// gate exercises the actual @locateflow/shared feature matrix via the request
// entitlement boundary (Individual+).
vi.mock("@/lib/plan-limits", () => ({
  getUserPlan: mocks.getUserPlan,
}));

vi.mock("@/lib/request-entitlements", async () => {
  const { planFeatures } = await vi.importActual<typeof import("@locateflow/shared")>("@locateflow/shared");
  return {
    requestHasPlanFeature: async (_request: Request, userId: string, feature: keyof ReturnType<typeof planFeatures>) => {
      const plan = await mocks.getUserPlan(userId);
      return planFeatures(plan.plan)[feature] === true;
    },
  };
});

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "vehicles:decode:user:user-1"),
  rateLimit: vi.fn(),
}));

// The NHTSA lookup is unit-tested in its own colocated suite — here it is
// mocked so the route tests pin auth, rate limiting, zod VIN validation, and
// the EXACT { vehicle, recalls } response contract.
vi.mock("@/lib/nhtsa", () => ({
  lookupVehicleByVin: vi.fn(),
}));

import { requireDbUserId } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan-limits";
import { rateLimit } from "@/lib/rate-limit";
import { lookupVehicleByVin } from "@/lib/nhtsa";
import { GET } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockGetUserPlan = getUserPlan as unknown as Mock;
const mockRateLimit = rateLimit as unknown as Mock;
const mockLookup = lookupVehicleByVin as unknown as Mock;

const VIN = "2HKRW2H59KH601234";

function decodeRequest(vin?: string) {
  const query = vin === undefined ? "" : `?vin=${encodeURIComponent(vin)}`;
  return new Request(`http://localhost/api/vehicles/decode${query}`) as any;
}

// Lib results intentionally carry EXTRA fields (reason/source) to prove the
// route strips them down to the { vehicle, recalls } contract shape.
const LOOKUP_OK = {
  status: "ok" as const,
  vehicle: { vin: VIN, year: 2019, make: "HONDA", model: "CR-V" },
  recalls: {
    status: "ok" as const,
    count: 2,
    topItems: [
      { campaignNumber: "19V182000", component: "FUEL SYSTEM, GASOLINE", summary: "Fuel pump may fail." },
      { campaignNumber: "20V314000", component: "AIR BAGS", summary: "Inflator may rupture." },
    ],
  },
  reason: null,
  source: { name: "NHTSA", url: "https://www.nhtsa.gov/recalls" },
};

describe("vehicle decode route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    // Default to an entitled tier so the existing contract tests below exercise
    // the decode path; the gate-specific tests override the plan.
    mockGetUserPlan.mockResolvedValue({ plan: "INDIVIDUAL" });
    mockRateLimit.mockResolvedValue({ success: true, remaining: 9, resetAt: Date.now() + 60000 });
    mockLookup.mockResolvedValue(LOOKUP_OK);
  });

  describe("vehicleCheck plan gate", () => {
    it("answers 200 entitled:false for FREE_TRIAL without touching the rate limiter or NHTSA", async () => {
      mockGetUserPlan.mockResolvedValue({ plan: "FREE_TRIAL" });
      const response = await GET(decodeRequest(VIN));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        configured: true,
        entitled: false,
        upgradeRequired: "VEHICLE_CHECK_UPGRADE_REQUIRED",
      });
      expect(mockRateLimit).not.toHaveBeenCalled();
      expect(mockLookup).not.toHaveBeenCalled();
    });

    it("gates before the plan read is even reached when unauthenticated (401 wins)", async () => {
      mockRequireDbUserId.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
      const response = await GET(decodeRequest(VIN));
      expect(response.status).toBe(401);
      expect(mockGetUserPlan).not.toHaveBeenCalled();
    });

    it("entitles INDIVIDUAL, FAMILY and PRO (decode runs)", async () => {
      for (const plan of ["INDIVIDUAL", "FAMILY", "PRO"] as const) {
        vi.clearAllMocks();
        mockRequireDbUserId.mockResolvedValue("user-1");
        mockGetUserPlan.mockResolvedValue({ plan });
        mockRateLimit.mockResolvedValue({ success: true, remaining: 9, resetAt: Date.now() + 60000 });
        mockLookup.mockResolvedValue(LOOKUP_OK);
        const response = await GET(decodeRequest(VIN));
        expect(response.status).toBe(200);
        expect((await response.json()).vehicle.status).toBe("ok");
        expect(mockLookup).toHaveBeenCalledWith(VIN);
      }
    });
  });

  it("returns a structured 401 when the DB-backed session is invalid", async () => {
    mockRequireDbUserId.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    const response = await GET(decodeRequest(VIN));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ code: "UNAUTHORIZED", error: "Please sign in again." });
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-user rate limit is exhausted (no NHTSA call)", async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetAt: Date.now() + 30000 });

    const response = await GET(decodeRequest(VIN));

    expect(response.status).toBe(429);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects invalid VINs with 400 INVALID_VIN before any NHTSA call", async () => {
    const badVins = [
      undefined, // missing param entirely
      "", // empty
      "2HKRW2H59KH60123", // 16 chars
      "2HKRW2H59KH6012345", // 18 chars
      "IHKRW2H59KH601234", // contains I
      "OHKRW2H59KH601234", // contains O
      "QHKRW2H59KH601234", // contains Q
      "2HKRW2H59KH60123!", // punctuation
    ];

    for (const vin of badVins) {
      const response = await GET(decodeRequest(vin));
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.code).toBe("INVALID_VIN");
    }
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("responds with the exact { vehicle, recalls } contract shape (lib internals stripped)", async () => {
    const response = await GET(decodeRequest(VIN));
    const body = await response.json();

    expect(response.status).toBe(200);
    // toEqual pins the FULL contract: reason/source/topItems must NOT leak.
    expect(body).toEqual({
      vehicle: { status: "ok", vin: VIN, year: 2019, make: "HONDA", model: "CR-V" },
      recalls: {
        status: "ok",
        count: 2,
        items: [
          { campaignNumber: "19V182000", component: "FUEL SYSTEM, GASOLINE", summary: "Fuel pump may fail." },
          { campaignNumber: "20V314000", component: "AIR BAGS", summary: "Inflator may rupture." },
        ],
      },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mockLookup).toHaveBeenCalledWith(VIN);
  });

  it("accepts a lowercase VIN and normalizes it before the lookup", async () => {
    const response = await GET(decodeRequest(VIN.toLowerCase()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.vehicle.vin).toBe(VIN);
    expect(mockLookup).toHaveBeenCalledWith(VIN);
  });

  it("passes through no_match per the contract (recalls unavailable, fields null)", async () => {
    mockLookup.mockResolvedValueOnce({
      status: "no_match",
      vehicle: null,
      recalls: { status: "unavailable", count: null, topItems: [] },
      reason: "vin_not_decoded",
      source: { name: "NHTSA", url: "https://www.nhtsa.gov/recalls" },
    });

    const response = await GET(decodeRequest(VIN));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      vehicle: { status: "no_match", vin: VIN, year: null, make: null, model: null },
      recalls: { status: "unavailable", count: null, items: [] },
    });
  });

  it("passes through a lib error as a 200 degraded section (never a 5xx)", async () => {
    mockLookup.mockResolvedValueOnce({
      status: "error",
      vehicle: null,
      recalls: { status: "unavailable", count: null, topItems: [] },
      reason: "NHTSA request failed: HTTP 503",
      source: { name: "NHTSA", url: "https://www.nhtsa.gov/recalls" },
    });

    const response = await GET(decodeRequest(VIN));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.vehicle).toEqual({ status: "error", vin: VIN, year: null, make: null, model: null });
    expect(body.recalls.status).toBe("unavailable");
  });

  it("keeps a vehicle answer when only the recalls block degraded", async () => {
    mockLookup.mockResolvedValueOnce({
      ...LOOKUP_OK,
      recalls: { status: "unavailable", count: null, topItems: [] },
    });

    const response = await GET(decodeRequest(VIN));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.vehicle.status).toBe("ok");
    expect(body.vehicle.make).toBe("HONDA");
    expect(body.recalls).toEqual({ status: "unavailable", count: null, items: [] });
  });

  it("fails closed with 400 if the lib ever reports invalid_vin past zod", async () => {
    mockLookup.mockResolvedValueOnce({
      status: "invalid_vin",
      vehicle: null,
      recalls: { status: "unavailable", count: null, topItems: [] },
      reason: "vin_failed_validation",
      source: { name: "NHTSA", url: "https://www.nhtsa.gov/recalls" },
    });

    const response = await GET(decodeRequest(VIN));
    expect(response.status).toBe(400);
  });
});

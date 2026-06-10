import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: {
      findUnique: vi.fn(),
    },
    movingPlan: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

// The seven dossier lookups are unit-tested in their own colocated suites —
// here they are mocked so the route tests pin auth, 404 behavior, the weather
// window decision, and the EXACT response contract shape.
vi.mock("@/lib/fema-flood", () => ({
  lookupFloodZone: vi.fn(),
}));
vi.mock("@/lib/nces-district", () => ({
  lookupSchoolDistrict: vi.fn(),
}));
vi.mock("@/lib/nws-weather", () => ({
  lookupMoveDayForecast: vi.fn(),
}));
vi.mock("@/lib/fema-nri", () => ({
  lookupHazardRisks: vi.fn(),
}));
vi.mock("@/lib/epa-radon", () => ({
  lookupRadonZone: vi.fn(),
}));
vi.mock("@/lib/epa-water", () => ({
  lookupWaterSystem: vi.fn(),
}));
vi.mock("@/lib/airnow", () => ({
  lookupAirQuality: vi.fn(),
}));

// Plan entitlement: getUserPlan is mocked (no DB); planFeatures stays REAL so
// the gate exercises the actual @locateflow/shared feature matrix.
vi.mock("@/lib/plan-limits", () => ({
  getUserPlan: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan-limits";
import { lookupFloodZone } from "@/lib/fema-flood";
import { lookupSchoolDistrict } from "@/lib/nces-district";
import { lookupMoveDayForecast } from "@/lib/nws-weather";
import { lookupHazardRisks } from "@/lib/fema-nri";
import { lookupRadonZone } from "@/lib/epa-radon";
import { lookupWaterSystem } from "@/lib/epa-water";
import { lookupAirQuality } from "@/lib/airnow";
import { GET } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockGetUserPlan = getUserPlan as unknown as Mock;
const mockAddressFindUnique = prisma.address.findUnique as unknown as Mock;
const mockPlanFindFirst = prisma.movingPlan.findFirst as unknown as Mock;
const mockLookupFloodZone = lookupFloodZone as unknown as Mock;
const mockLookupSchoolDistrict = lookupSchoolDistrict as unknown as Mock;
const mockLookupMoveDayForecast = lookupMoveDayForecast as unknown as Mock;
const mockLookupHazardRisks = lookupHazardRisks as unknown as Mock;
const mockLookupRadonZone = lookupRadonZone as unknown as Mock;
const mockLookupWaterSystem = lookupWaterSystem as unknown as Mock;
const mockLookupAirQuality = lookupAirQuality as unknown as Mock;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addressParams(id = "address-1") {
  return { params: Promise.resolve({ id }) };
}

function dossierRequest(id = "address-1") {
  return new Request(`http://localhost/api/addresses/${id}/dossier`) as any;
}

const BASE_ADDRESS = {
  id: "address-1",
  userId: "user-1",
  workspaceId: null,
  deletedAt: null,
  city: "Austin",
  state: "TX",
  latitude: 30.2672,
  longitude: -97.7431,
};

// Lib results intentionally carry EXTRA fields (reason/source/zoneSubtype) to
// prove the route strips them down to the contract shape.
const FLOOD_OK = {
  status: "ok" as const,
  zone: "AE",
  zoneSubtype: null,
  isHighRisk: true,
  reason: null,
  source: { name: "FEMA National Flood Hazard Layer", url: "https://hazards.fema.gov/" },
};
const SCHOOL_OK = {
  status: "ok" as const,
  districtName: "Austin Independent School District",
  ncesId: "4808940",
  reason: null,
  source: { name: "NCES EDGE School District Boundaries", url: "https://nces.ed.gov/programs/edge/" },
};
const WEATHER_OK = {
  status: "ok" as const,
  forecastDate: "2026-06-12",
  summary: "Partly Sunny",
  tempHighF: 91,
  tempLowF: 76,
  precipChancePct: 40,
  reason: null,
  source: { name: "National Weather Service", url: "https://www.weather.gov/" },
};
const HAZARDS_OK = {
  status: "ok" as const,
  topRisks: [
    { hazard: "Hurricane", rating: "Very High" },
    { hazard: "Heat Wave", rating: "Relatively Moderate" },
  ],
  overallRating: "Relatively High",
  reason: null,
  source: { name: "FEMA National Risk Index", url: "https://hazards.fema.gov/nri/" },
};
const RADON_OK = {
  status: "ok" as const,
  zone: 3 as const,
  countyName: "Travis",
  countyFips: "48453",
  reason: null,
  source: { name: "EPA Map of Radon Zones", url: "https://www.epa.gov/radon" },
};
const WATER_OK = {
  status: "ok" as const,
  systemName: "AUSTIN WATER",
  pwsid: "TX2270001",
  populationServed: 1115323,
  violations5y: 2,
  reason: null,
  source: { name: "EPA Safe Drinking Water Information System", url: "https://www.epa.gov/enviro" },
};
const AIR_OK = {
  status: "ok" as const,
  aqi: 52,
  category: "Moderate",
  parameter: "PM2.5",
  reportingArea: "Austin",
  reason: null,
  source: { name: "AirNow", url: "https://www.airnow.gov/" },
};

describe("address dossier route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockGetUserPlan.mockResolvedValue({ plan: "INDIVIDUAL", hasPremium: true, isActive: true });
    mockAddressFindUnique.mockResolvedValue({ ...BASE_ADDRESS });
    mockPlanFindFirst.mockResolvedValue(null);
    mockLookupFloodZone.mockResolvedValue(FLOOD_OK);
    mockLookupSchoolDistrict.mockResolvedValue(SCHOOL_OK);
    mockLookupMoveDayForecast.mockResolvedValue(WEATHER_OK);
    mockLookupHazardRisks.mockResolvedValue(HAZARDS_OK);
    mockLookupRadonZone.mockResolvedValue(RADON_OK);
    mockLookupWaterSystem.mockResolvedValue(WATER_OK);
    mockLookupAirQuality.mockResolvedValue(AIR_OK);
  });

  it("returns a structured 401 when the DB-backed session is invalid", async () => {
    mockRequireDbUserId.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ code: "UNAUTHORIZED", error: "Please sign in again." });
    expect(mockLookupFloodZone).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown address id", async () => {
    mockAddressFindUnique.mockResolvedValueOnce(null);

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Address not found");
    expect(mockLookupFloodZone).not.toHaveBeenCalled();
  });

  it("returns 404 for a soft-deleted address", async () => {
    mockAddressFindUnique.mockResolvedValueOnce({ ...BASE_ADDRESS, deletedAt: new Date() });

    const response = await GET(dossierRequest(), addressParams() as any);
    expect(response.status).toBe(404);
  });

  it("returns 404 (not 403) for another user's address id", async () => {
    mockAddressFindUnique.mockResolvedValueOnce({ ...BASE_ADDRESS, userId: "user-2" });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Address not found");
    expect(mockLookupFloodZone).not.toHaveBeenCalled();
    expect(mockLookupSchoolDistrict).not.toHaveBeenCalled();
    expect(mockLookupMoveDayForecast).not.toHaveBeenCalled();
  });

  it("free plan gets the 200 upgrade teaser — address block omitted, no lookups spent", async () => {
    mockGetUserPlan.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    // 200 (never 403) so old clients — which require the address/section
    // blocks — fail soft to a hidden card. toEqual pins that NO address,
    // flood, school, or weather data leaks to an unentitled caller.
    expect(response.status).toBe(200);
    expect(body).toEqual({
      configured: true,
      entitled: false,
      upgradeRequired: "HOME_DOSSIER_UPGRADE_REQUIRED",
    });
    expect(mockLookupFloodZone).not.toHaveBeenCalled();
    expect(mockLookupSchoolDistrict).not.toHaveBeenCalled();
    expect(mockLookupMoveDayForecast).not.toHaveBeenCalled();
    expect(mockLookupHazardRisks).not.toHaveBeenCalled();
    expect(mockLookupRadonZone).not.toHaveBeenCalled();
    expect(mockLookupWaterSystem).not.toHaveBeenCalled();
    expect(mockLookupAirQuality).not.toHaveBeenCalled();
    expect(mockPlanFindFirst).not.toHaveBeenCalled();
  });

  it("404 still wins over the teaser for a free user's foreign address id", async () => {
    mockGetUserPlan.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });
    mockAddressFindUnique.mockResolvedValueOnce({ ...BASE_ADDRESS, userId: "user-2" });

    const response = await GET(dossierRequest(), addressParams() as any);

    expect(response.status).toBe(404);
  });

  it("every paid tier passes the gate (FAMILY and PRO included)", async () => {
    for (const plan of ["FAMILY", "PRO"]) {
      mockGetUserPlan.mockResolvedValueOnce({ plan, hasPremium: true, isActive: true });

      const response = await GET(dossierRequest(), addressParams() as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.upgradeRequired).toBeUndefined();
      expect(body.address).toEqual({ id: "address-1", city: "Austin", state: "TX" });
      expect(body.flood.status).toBe("ok");
    }
  });

  it("responds with the exact dossier contract shape when the move is within the weather window", async () => {
    const moveDate = new Date(Date.now() + 3 * MS_PER_DAY);
    mockPlanFindFirst.mockResolvedValueOnce({ moveDate });
    const expectedTargetDate = moveDate.toISOString().slice(0, 10);

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    // toEqual pins the FULL contract: extra lib fields (reason/source/...)
    // must NOT leak into the response.
    expect(body).toEqual({
      configured: true,
      address: { id: "address-1", city: "Austin", state: "TX" },
      flood: { status: "ok", zone: "AE", isHighRisk: true },
      school: { status: "ok", districtName: "Austin Independent School District", ncesId: "4808940" },
      weather: {
        status: "ok",
        forecastDate: "2026-06-12",
        summary: "Partly Sunny",
        tempHighF: 91,
        tempLowF: 76,
        precipChancePct: 40,
      },
      hazards: {
        status: "ok",
        topRisks: [
          { hazard: "Hurricane", rating: "Very High" },
          { hazard: "Heat Wave", rating: "Relatively Moderate" },
        ],
        overallRating: "Relatively High",
      },
      radon: { status: "ok", zone: 3 },
      water: { status: "ok", systemName: "AUSTIN WATER", violations5y: 2 },
      air: { status: "ok", aqi: 52, category: "Moderate" },
    });

    expect(mockLookupFloodZone).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    expect(mockLookupSchoolDistrict).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    expect(mockLookupMoveDayForecast).toHaveBeenCalledWith({
      latitude: 30.2672,
      longitude: -97.7431,
      targetDate: expectedTargetDate,
    });
    expect(mockLookupHazardRisks).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    expect(mockLookupRadonZone).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    // Water matches by the SDWIS-registered service area, not coordinates.
    expect(mockLookupWaterSystem).toHaveBeenCalledWith({ city: "Austin", state: "TX" });
    expect(mockLookupAirQuality).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    // The weather window is decided by the earliest upcoming active plan that
    // moves TO this address (destination only, owned scope).
    expect(mockPlanFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: "user-1",
        toAddressId: "address-1",
        deletedAt: null,
        status: { in: ["PLANNING", "IN_PROGRESS"] },
        moveDate: { gte: expect.any(Date) },
      }),
      orderBy: { moveDate: "asc" },
      select: { moveDate: true },
    });
  });

  it("reports weather too_far without calling the NWS lib when no active plan targets this address", async () => {
    mockPlanFindFirst.mockResolvedValueOnce(null);

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.weather).toEqual({
      status: "too_far",
      forecastDate: null,
      summary: null,
      tempHighF: null,
      tempLowF: null,
      precipChancePct: null,
    });
    expect(mockLookupMoveDayForecast).not.toHaveBeenCalled();
    // The other sections still resolve normally.
    expect(body.flood.status).toBe("ok");
    expect(body.school.status).toBe("ok");
  });

  it("reports weather too_far when the move date is beyond the 7-day forecast window", async () => {
    mockPlanFindFirst.mockResolvedValueOnce({ moveDate: new Date(Date.now() + 10 * MS_PER_DAY) });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(body.weather.status).toBe("too_far");
    expect(mockLookupMoveDayForecast).not.toHaveBeenCalled();
  });

  it("short-circuits every section to no_location when the address has no coordinates", async () => {
    mockAddressFindUnique.mockResolvedValueOnce({ ...BASE_ADDRESS, latitude: null, longitude: null });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      configured: true,
      address: { id: "address-1", city: "Austin", state: "TX" },
      flood: { status: "no_location", zone: null, isHighRisk: null },
      school: { status: "no_location", districtName: null, ncesId: null },
      weather: {
        status: "no_location",
        forecastDate: null,
        summary: null,
        tempHighF: null,
        tempLowF: null,
        precipChancePct: null,
      },
      hazards: { status: "no_location", topRisks: [], overallRating: null },
      radon: { status: "no_location", zone: null },
      water: { status: "no_location", systemName: null, violations5y: null },
      air: { status: "no_location", aqi: null, category: null },
    });
    // No external lookups and no plan query are made without a location
    // (water included — an ungeocoded address is treated as incomplete).
    expect(mockLookupFloodZone).not.toHaveBeenCalled();
    expect(mockLookupSchoolDistrict).not.toHaveBeenCalled();
    expect(mockLookupMoveDayForecast).not.toHaveBeenCalled();
    expect(mockLookupHazardRisks).not.toHaveBeenCalled();
    expect(mockLookupRadonZone).not.toHaveBeenCalled();
    expect(mockLookupWaterSystem).not.toHaveBeenCalled();
    expect(mockLookupAirQuality).not.toHaveBeenCalled();
    expect(mockPlanFindFirst).not.toHaveBeenCalled();
  });

  it("degrades a single section to error when its lookup rejects (others unaffected)", async () => {
    // The libs never throw by contract, but the route must survive one doing so.
    mockLookupFloodZone.mockRejectedValueOnce(new Error("boom"));

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.flood).toEqual({ status: "error", zone: null, isHighRisk: null });
    expect(body.school.status).toBe("ok");
    expect(body.weather.status).toBe("too_far"); // no plan in this fixture
    expect(body.hazards.status).toBe("ok");
    expect(body.radon.status).toBe("ok");
    expect(body.water.status).toBe("ok");
    expect(body.air.status).toBe("ok");
  });

  it("degrades each NEW section independently when its lookup rejects (others unaffected)", async () => {
    mockLookupHazardRisks.mockRejectedValueOnce(new Error("boom"));
    mockLookupWaterSystem.mockRejectedValueOnce(new Error("boom"));

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hazards).toEqual({ status: "error", topRisks: [], overallRating: null });
    expect(body.water).toEqual({ status: "error", systemName: null, violations5y: null });
    expect(body.radon).toEqual({ status: "ok", zone: 3 });
    expect(body.air).toEqual({ status: "ok", aqi: 52, category: "Moderate" });
    expect(body.flood.status).toBe("ok");
  });

  it("passes through air not_configured (no AirNow key) per the contract", async () => {
    mockLookupAirQuality.mockResolvedValueOnce({
      status: "not_configured",
      aqi: null,
      category: null,
      parameter: null,
      reportingArea: null,
      reason: "airnow_api_key_missing",
      source: { name: "AirNow", url: "https://www.airnow.gov/" },
    });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.air).toEqual({ status: "not_configured", aqi: null, category: null });
    // The rest of the dossier is unaffected by the missing key.
    expect(body.hazards.status).toBe("ok");
    expect(body.water.status).toBe("ok");
  });

  it("passes through water's honest 'no confident match' nulls (ok status, null fields)", async () => {
    mockLookupWaterSystem.mockResolvedValueOnce({
      status: "ok",
      systemName: null,
      pwsid: null,
      populationServed: null,
      violations5y: null,
      reason: "no_community_system_matched",
      source: { name: "EPA Safe Drinking Water Information System", url: "https://www.epa.gov/enviro" },
    });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(body.water).toEqual({ status: "ok", systemName: null, violations5y: null });
  });

  it("passes through non-ok lib statuses (e.g. weather error) per the contract", async () => {
    mockPlanFindFirst.mockResolvedValueOnce({ moveDate: new Date(Date.now() + 2 * MS_PER_DAY) });
    mockLookupMoveDayForecast.mockResolvedValueOnce({
      status: "error",
      forecastDate: null,
      summary: null,
      tempHighF: null,
      tempLowF: null,
      precipChancePct: null,
      reason: "nws_request_failed",
      source: { name: "National Weather Service", url: "https://www.weather.gov/" },
    });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.weather).toEqual({
      status: "error",
      forecastDate: null,
      summary: null,
      tempHighF: null,
      tempLowF: null,
      precipChancePct: null,
    });
  });
});

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

// The nine dossier lookups are unit-tested in their own colocated suites —
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
vi.mock("@/lib/census-acs", () => ({
  lookupNeighborhoodAcs: vi.fn(),
}));
vi.mock("@/lib/epa-walkability", () => ({
  lookupWalkability: vi.fn(),
}));
vi.mock("@/lib/nces-schools", () => ({
  lookupNearbySchools: vi.fn(),
}));
vi.mock("@/lib/hud-housing", () => ({
  lookupHudHousing: vi.fn(),
}));
vi.mock("@/lib/nlr-alt-fuel-stations", () => ({
  lookupEvCharging: vi.fn(),
}));

// Plan entitlement: getPlanForLimitScope is mocked (no DB); planFeatures stays REAL so
// the gate exercises the actual @locateflow/shared feature matrix.
vi.mock("@/lib/plan-limits", () => ({
  getPlanForLimitScope: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true, resetAt: Date.now() + 60_000 })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { getPlanForLimitScope } from "@/lib/plan-limits";
import { lookupFloodZone } from "@/lib/fema-flood";
import { lookupSchoolDistrict } from "@/lib/nces-district";
import { lookupMoveDayForecast } from "@/lib/nws-weather";
import { lookupHazardRisks } from "@/lib/fema-nri";
import { lookupRadonZone } from "@/lib/epa-radon";
import { lookupWaterSystem } from "@/lib/epa-water";
import { lookupAirQuality } from "@/lib/airnow";
import { lookupNeighborhoodAcs } from "@/lib/census-acs";
import { lookupWalkability } from "@/lib/epa-walkability";
import { lookupNearbySchools } from "@/lib/nces-schools";
import { lookupHudHousing } from "@/lib/hud-housing";
import { lookupEvCharging } from "@/lib/nlr-alt-fuel-stations";
import { GET, clearDossierCacheForTests } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockGetPlanForLimitScope = getPlanForLimitScope as unknown as Mock;
const mockAddressFindUnique = prisma.address.findUnique as unknown as Mock;
const mockPlanFindFirst = prisma.movingPlan.findFirst as unknown as Mock;
const mockLookupFloodZone = lookupFloodZone as unknown as Mock;
const mockLookupSchoolDistrict = lookupSchoolDistrict as unknown as Mock;
const mockLookupMoveDayForecast = lookupMoveDayForecast as unknown as Mock;
const mockLookupHazardRisks = lookupHazardRisks as unknown as Mock;
const mockLookupRadonZone = lookupRadonZone as unknown as Mock;
const mockLookupWaterSystem = lookupWaterSystem as unknown as Mock;
const mockLookupAirQuality = lookupAirQuality as unknown as Mock;
const mockLookupNeighborhoodAcs = lookupNeighborhoodAcs as unknown as Mock;
const mockLookupWalkability = lookupWalkability as unknown as Mock;
const mockLookupNearbySchools = lookupNearbySchools as unknown as Mock;
const mockLookupHudHousing = lookupHudHousing as unknown as Mock;
const mockLookupEvCharging = lookupEvCharging as unknown as Mock;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addressParams(id = "address-1") {
  return { params: Promise.resolve({ id }) };
}

function dossierRequest(id = "address-1") {
  return new Request(`http://localhost/api/addresses/${id}/dossier`) as any;
}

function dossierSummaryRequest(id = "address-1") {
  return new Request(`http://localhost/api/addresses/${id}/dossier?summary=1`) as any;
}

const BASE_ADDRESS = {
  id: "address-1",
  userId: "user-1",
  workspaceId: null,
  deletedAt: null,
  city: "Austin",
  state: "TX",
  zip: "78701",
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
const HUD_DISABLED = {
  status: "disabled" as const,
  zip: null,
  entityId: null,
  countyFips: null,
  cbsaCode: null,
  countyName: null,
  metroName: null,
  areaName: null,
  fairMarketRent: null,
  incomeLimits: null,
  reason: "disabled",
  caveat:
    "This product uses the HUD User Data API but is not endorsed or certified by HUD User. HUD rent and income-limit figures describe HUD geographies and program thresholds, not a quote, appraisal, or eligibility decision for a specific home.",
  source: { name: "HUD User Data API", url: "https://www.huduser.gov/portal/dataset/fmr-api.html" },
};
const EV_DISABLED = {
  status: "disabled" as const,
  radiusMiles: 10,
  totalResults: null,
  stationCount: 0,
  nearestDistanceMiles: null,
  dcFastPortCount: 0,
  level2PortCount: 0,
  teslaCompatibleCount: 0,
  ccsCompatibleCount: 0,
  stations: [],
  reason: "disabled",
  caveat:
    "EV charging results are nearby public active station listings from NLR/AFDC. Verify access, pricing, connector compatibility, and real-time availability with the station or charging network before relying on it.",
  source: {
    name: "NLR Alternative Fuel Stations",
    url: "https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/nearest/",
  },
};
// Carries EXTRA fields (tractName/tractFips/reason/source) to prove the route
// strips the section down to its contract shape.
const NEIGHBORHOOD_OK = {
  status: "ok" as const,
  geography: "tract" as const,
  tractName: "Census Tract 11.03",
  tractFips: "48453001103",
  medianHomeValue: 420000,
  medianGrossRent: 1500,
  medianHouseholdIncome: 105000,
  ownerOccupiedShare: 0.6,
  incomeBand: "above_us" as const,
  homeValueBand: "above_us" as const,
  reason: null,
  caveat: "These are American Community Survey 5-year medians for the surrounding census tract, not a valuation of this specific home. Treat them as neighborhood context.",
  source: { name: "US Census Bureau ACS 5-Year Estimates", url: "https://www.census.gov/programs-surveys/acs/" },
};
// Carries EXTRA fields (reason/source) to prove the route strips the section
// to its contract shape.
const WALKABILITY_OK = {
  status: "ok" as const,
  score: 18.8,
  band: "most" as const,
  reason: null,
  source: { name: "EPA National Walkability Index", url: "https://www.epa.gov/smartgrowth/smart-location-mapping" },
};
const SCHOOLS_OK = {
  status: "ok" as const,
  schools: [
    { name: "Austin High School", level: "High" as const },
    { name: "Zilker Elementary", level: "Elementary" as const },
  ],
  reason: null,
  source: { name: "NCES / HIFLD Public Schools", url: "https://nces.ed.gov/programs/edge/" },
};

describe("address dossier route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDossierCacheForTests();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "INDIVIDUAL", hasPremium: true, isActive: true });
    mockAddressFindUnique.mockResolvedValue({ ...BASE_ADDRESS });
    mockPlanFindFirst.mockResolvedValue(null);
    mockLookupFloodZone.mockResolvedValue(FLOOD_OK);
    mockLookupSchoolDistrict.mockResolvedValue(SCHOOL_OK);
    mockLookupMoveDayForecast.mockResolvedValue(WEATHER_OK);
    mockLookupHazardRisks.mockResolvedValue(HAZARDS_OK);
    mockLookupRadonZone.mockResolvedValue(RADON_OK);
    mockLookupWaterSystem.mockResolvedValue(WATER_OK);
    mockLookupAirQuality.mockResolvedValue(AIR_OK);
    mockLookupHudHousing.mockResolvedValue(HUD_DISABLED);
    mockLookupEvCharging.mockResolvedValue(EV_DISABLED);
    mockLookupNeighborhoodAcs.mockResolvedValue(NEIGHBORHOOD_OK);
    mockLookupWalkability.mockResolvedValue(WALKABILITY_OK);
    mockLookupNearbySchools.mockResolvedValue(SCHOOLS_OK);
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

  it("free plan gets only the preview subset: flood, school, and moving-day weather", async () => {
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });
    const moveDate = new Date(Date.now() + 3 * MS_PER_DAY);
    const targetDate = moveDate.toISOString().slice(0, 10);
    mockPlanFindFirst.mockResolvedValueOnce({ moveDate });
    mockLookupMoveDayForecast.mockImplementationOnce(async () => ({ ...WEATHER_OK, forecastDate: targetDate }));

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    // 200 (never 403) and server returns ONLY the free preview subset. Full
    // dossier sections are not sent to the client and hidden there.
    expect(response.status).toBe(200);
    expect(body).toEqual({
      configured: true,
      preview: true,
      homeDossierPreview: true,
      fullDossier: false,
      dossierPdf: false,
      address: { id: "address-1", city: "Austin", state: "TX", zip: "78701" },
      lockedSections: [
        "hazards",
        "radon",
        "water",
        "air",
        "housing",
        "evCharging",
        "neighborhood",
        "pdf",
      ],
      flood: { status: "ok", zone: "AE", isHighRisk: true },
      school: { status: "ok", districtName: "Austin Independent School District", ncesId: "4808940" },
      weather: {
        status: "ok",
        forecastDate: targetDate,
        summary: "Partly Sunny",
        tempHighF: 91,
        tempLowF: 76,
        precipChancePct: 40,
      },
    });
    expect(mockLookupFloodZone).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    expect(mockLookupSchoolDistrict).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    expect(mockLookupMoveDayForecast).toHaveBeenCalledWith({
      latitude: 30.2672,
      longitude: -97.7431,
      targetDate,
    });
    expect(mockLookupHazardRisks).not.toHaveBeenCalled();
    expect(mockLookupRadonZone).not.toHaveBeenCalled();
    expect(mockLookupWaterSystem).not.toHaveBeenCalled();
    expect(mockLookupAirQuality).not.toHaveBeenCalled();
    expect(mockLookupHudHousing).not.toHaveBeenCalled();
    expect(mockLookupEvCharging).not.toHaveBeenCalled();
    expect(mockLookupNeighborhoodAcs).not.toHaveBeenCalled();
    expect(mockLookupWalkability).not.toHaveBeenCalled();
    expect(mockLookupNearbySchools).not.toHaveBeenCalled();
    expect(body).not.toHaveProperty("internet");
    expect(body).not.toHaveProperty("hazards");
    expect(body).not.toHaveProperty("radon");
    expect(body).not.toHaveProperty("water");
    expect(body).not.toHaveProperty("air");
    expect(body).not.toHaveProperty("housing");
    expect(body).not.toHaveProperty("evCharging");
    expect(body).not.toHaveProperty("neighborhood");
  });

  it("summary mode returns only current-home air and HUD context even for a free plan", async () => {
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });

    const response = await GET(dossierSummaryRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=900");
    expect(body).toEqual({
      configured: true,
      address: { id: "address-1", city: "Austin", state: "TX", zip: "78701" },
      air: { status: "ok", aqi: 52, category: "Moderate" },
      housing: {
        status: "disabled",
        zip: null,
        entityId: null,
        countyFips: null,
        cbsaCode: null,
        countyName: null,
        metroName: null,
        areaName: null,
        fairMarketRent: null,
        incomeLimits: null,
        caveat: HUD_DISABLED.caveat,
      },
    });
    expect(mockLookupAirQuality).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    expect(mockLookupHudHousing).toHaveBeenCalledWith({ zip: "78701", state: "TX" });
    expect(mockLookupFloodZone).not.toHaveBeenCalled();
    expect(mockLookupSchoolDistrict).not.toHaveBeenCalled();
    expect(mockLookupMoveDayForecast).not.toHaveBeenCalled();
    expect(mockLookupHazardRisks).not.toHaveBeenCalled();
    expect(mockLookupRadonZone).not.toHaveBeenCalled();
    expect(mockLookupWaterSystem).not.toHaveBeenCalled();
    expect(mockLookupEvCharging).not.toHaveBeenCalled();
    expect(mockLookupNeighborhoodAcs).not.toHaveBeenCalled();
    expect(mockPlanFindFirst).not.toHaveBeenCalled();
  });

  it("summary mode serves repeated requests from the dossier cache", async () => {
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });

    const first = await GET(dossierSummaryRequest(), addressParams() as any);
    expect(first.headers.get("X-Dossier-Cache")).toBe("MISS");
    await first.json();

    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });
    mockAddressFindUnique.mockResolvedValue({ ...BASE_ADDRESS });

    const second = await GET(dossierSummaryRequest(), addressParams() as any);
    const body = await second.json();

    expect(second.status).toBe(200);
    expect(second.headers.get("X-Dossier-Cache")).toBe("HIT");
    expect(body.air).toEqual({ status: "ok", aqi: 52, category: "Moderate" });
    expect(mockLookupAirQuality).not.toHaveBeenCalled();
    expect(mockLookupHudHousing).not.toHaveBeenCalled();
  });

  it("404 still wins over the teaser for a free user's foreign address id", async () => {
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });
    mockAddressFindUnique.mockResolvedValueOnce({ ...BASE_ADDRESS, userId: "user-2" });

    const response = await GET(dossierRequest(), addressParams() as any);

    expect(response.status).toBe(404);
  });

  it("every paid tier passes the gate", async () => {
    for (const plan of ["INDIVIDUAL", "FAMILY", "PRO"]) {
      mockGetPlanForLimitScope.mockResolvedValueOnce({ plan, hasPremium: true, isActive: true });

      const response = await GET(dossierRequest(), addressParams() as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.upgradeRequired).toBeUndefined();
      expect(body.address).toEqual({ id: "address-1", city: "Austin", state: "TX", zip: "78701" });
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
      dossierPdf: false,
      address: { id: "address-1", city: "Austin", state: "TX", zip: "78701" },
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
      housing: {
        status: "disabled",
        zip: null,
        entityId: null,
        countyFips: null,
        cbsaCode: null,
        countyName: null,
        metroName: null,
        areaName: null,
        fairMarketRent: null,
        incomeLimits: null,
        caveat: HUD_DISABLED.caveat,
      },
      evCharging: {
        status: "disabled",
        radiusMiles: 10,
        totalResults: null,
        stationCount: 0,
        nearestDistanceMiles: null,
        dcFastPortCount: 0,
        level2PortCount: 0,
        teslaCompatibleCount: 0,
        ccsCompatibleCount: 0,
        stations: [],
        caveat: EV_DISABLED.caveat,
      },
      // INDIVIDUAL is dossier-entitled but NOT Pro, so Neighborhood
      // Intelligence is the per-section upgrade teaser (no Census lookup).
      neighborhood: {
        status: "upgrade_required",
        upgradeRequired: "NEIGHBORHOOD_UPGRADE_REQUIRED",
        medianHomeValue: null,
        medianGrossRent: null,
        medianHouseholdIncome: null,
        ownerOccupiedPct: null,
        incomeBand: "unknown",
        homeValueBand: "unknown",
        walkScore: null,
        walkBand: "unknown",
        schools: [],
        caveat: null,
      },
    });
    expect(mockLookupNeighborhoodAcs).not.toHaveBeenCalled();
    expect(mockLookupWalkability).not.toHaveBeenCalled();
    expect(mockLookupNearbySchools).not.toHaveBeenCalled();

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
    expect(mockLookupHudHousing).toHaveBeenCalledWith({ zip: "78701", state: "TX" });
    expect(mockLookupEvCharging).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
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
      dossierPdf: false,
      address: { id: "address-1", city: "Austin", state: "TX", zip: "78701" },
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
      housing: {
        status: "no_location",
        zip: "78701",
        entityId: null,
        countyFips: null,
        cbsaCode: null,
        countyName: null,
        metroName: null,
        areaName: null,
        fairMarketRent: null,
        incomeLimits: null,
        caveat: null,
      },
      evCharging: {
        status: "no_location",
        radiusMiles: 10,
        totalResults: null,
        stationCount: 0,
        nearestDistanceMiles: null,
        dcFastPortCount: 0,
        level2PortCount: 0,
        teslaCompatibleCount: 0,
        ccsCompatibleCount: 0,
        stations: [],
        caveat: null,
      },
      // INDIVIDUAL is not Pro → the neighborhood teaser (not no_location).
      neighborhood: {
        status: "upgrade_required",
        upgradeRequired: "NEIGHBORHOOD_UPGRADE_REQUIRED",
        medianHomeValue: null,
        medianGrossRent: null,
        medianHouseholdIncome: null,
        ownerOccupiedPct: null,
        incomeBand: "unknown",
        homeValueBand: "unknown",
        walkScore: null,
        walkBand: "unknown",
        schools: [],
        caveat: null,
      },
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
    expect(mockLookupHudHousing).not.toHaveBeenCalled();
    expect(mockLookupEvCharging).not.toHaveBeenCalled();
    expect(mockLookupNeighborhoodAcs).not.toHaveBeenCalled();
    expect(mockLookupWalkability).not.toHaveBeenCalled();
    expect(mockLookupNearbySchools).not.toHaveBeenCalled();
    expect(mockPlanFindFirst).not.toHaveBeenCalled();
  });

  it("Pro populates the Neighborhood Intelligence section from Census ACS (stripped to contract)", async () => {
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "PRO", hasPremium: true, isActive: true });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dossierPdf).toBe(true);
    expect(mockLookupNeighborhoodAcs).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    expect(mockLookupWalkability).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    expect(mockLookupNearbySchools).toHaveBeenCalledWith({ latitude: 30.2672, longitude: -97.7431 });
    // Extra lib fields (geography/tractName/tractFips/reason/source) are stripped;
    // walkability + nearby schools merge into the same Pro bundle section.
    expect(body.neighborhood).toEqual({
      status: "ok",
      upgradeRequired: null,
      medianHomeValue: 420000,
      medianGrossRent: 1500,
      medianHouseholdIncome: 105000,
      // Lib reports a 0–1 share (0.6); the route converts to a whole percent.
      ownerOccupiedPct: 60,
      incomeBand: "above_us",
      homeValueBand: "above_us",
      walkScore: 18.8,
      walkBand: "most",
      schools: [
        { name: "Austin High School", level: "High" },
        { name: "Zilker Elementary", level: "Elementary" },
      ],
      caveat: NEIGHBORHOOD_OK.caveat,
    });
  });

  it("Pro neighborhood: a Census failure nulls only its fields; walkability + schools still render", async () => {
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "PRO", hasPremium: true, isActive: true });
    mockLookupNeighborhoodAcs.mockRejectedValueOnce(new Error("boom"));

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    // The bundle ran (Pro + located) → status "ok"; only the Census fields are
    // nulled, while the keyless walkability + schools still populate.
    expect(body.neighborhood).toEqual({
      status: "ok",
      upgradeRequired: null,
      medianHomeValue: null,
      medianGrossRent: null,
      medianHouseholdIncome: null,
      ownerOccupiedPct: null,
      incomeBand: "unknown",
      homeValueBand: "unknown",
      walkScore: 18.8,
      walkBand: "most",
      schools: [
        { name: "Austin High School", level: "High" },
        { name: "Zilker Elementary", level: "Elementary" },
      ],
      caveat: null,
    });
    // The other sections are unaffected by the Census failure.
    expect(body.flood.status).toBe("ok");
    expect(body.air.status).toBe("ok");
  });

  it("Pro neighborhood: an unset CENSUS_API_KEY nulls the medians but keeps walkability + schools", async () => {
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "PRO", hasPremium: true, isActive: true });
    mockLookupNeighborhoodAcs.mockResolvedValueOnce({
      status: "not_configured",
      geography: null,
      tractName: null,
      tractFips: null,
      medianHomeValue: null,
      medianGrossRent: null,
      medianHouseholdIncome: null,
      ownerOccupiedShare: null,
      incomeBand: "unknown",
      homeValueBand: "unknown",
      reason: "census_api_key_missing",
      caveat: NEIGHBORHOOD_OK.caveat,
      source: NEIGHBORHOOD_OK.source,
    });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    // The section still ran (Pro + located): walkability/schools render; the
    // Census medians are null and the Census caveat is withheld.
    expect(body.neighborhood.status).toBe("ok");
    expect(body.neighborhood.medianHomeValue).toBeNull();
    expect(body.neighborhood.caveat).toBeNull();
    expect(body.neighborhood.walkScore).toBe(18.8);
    expect(body.neighborhood.schools).toHaveLength(2);
    expect(body.air.status).toBe("ok");
  });

  it("Pro neighborhood: when every bundle source degrades, the section is ok but empty (card hides it)", async () => {
    mockGetPlanForLimitScope.mockResolvedValue({ plan: "PRO", hasPremium: true, isActive: true });
    mockLookupNeighborhoodAcs.mockRejectedValueOnce(new Error("boom"));
    mockLookupWalkability.mockResolvedValueOnce({ status: "error", score: null, band: "unknown", reason: "boom", source: WALKABILITY_OK.source });
    mockLookupNearbySchools.mockResolvedValueOnce({ status: "error", schools: [], reason: "boom", source: SCHOOLS_OK.source });

    const response = await GET(dossierRequest(), addressParams() as any);
    const body = await response.json();

    expect(body.neighborhood).toEqual({
      status: "ok",
      upgradeRequired: null,
      medianHomeValue: null,
      medianGrossRent: null,
      medianHouseholdIncome: null,
      ownerOccupiedPct: null,
      incomeBand: "unknown",
      homeValueBand: "unknown",
      walkScore: null,
      walkBand: "unknown",
      schools: [],
      caveat: null,
    });
    expect(body.flood.status).toBe("ok");
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

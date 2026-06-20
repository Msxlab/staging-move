import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { lookupFloodZone, type FloodLookupResult } from "@/lib/fema-flood";
import { lookupSchoolDistrict, type SchoolDistrictLookupResult } from "@/lib/nces-district";
import { lookupMoveDayForecast, type WeatherLookupResult } from "@/lib/nws-weather";
import { lookupHazardRisks, type HazardRiskLookupResult } from "@/lib/fema-nri";
import { lookupRadonZone, type RadonLookupResult, type RadonZone } from "@/lib/epa-radon";
import { lookupWaterSystem, type WaterSystemLookupResult } from "@/lib/epa-water";
import { lookupAirQuality, type AirQualityLookupResult } from "@/lib/airnow";
import {
  lookupNeighborhoodAcs,
  type NeighborhoodAcsResult,
  type AcsContextBand,
} from "@/lib/census-acs";
import { lookupWalkability, type WalkabilityLookupResult, type WalkabilityBand } from "@/lib/epa-walkability";
import { lookupNearbySchools, type NearbySchoolsLookupResult, type SchoolLevel } from "@/lib/nces-schools";
import { lookupHudHousing, type HudHousingLookupResult } from "@/lib/hud-housing";
import { lookupEvCharging, type EvChargingLookupResult, type EvChargingStationSummary } from "@/lib/nlr-alt-fuel-stations";
import {
  assertScopedRecordAction,
  planLimitScopeForDataScope,
  resolveWorkspaceDataScope,
  scopedRecordWhere,
} from "@/lib/workspace-data-scope";
import { recordIntegrationOutcome, recordIntegrationOutcomes } from "@/lib/integration-telemetry";
import { getPlanForLimitScope } from "@/lib/plan-limits";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { getOrFetchSection, type DossierSection, type SectionDataStatus } from "@/lib/address-data-cache";
import { checkGlobalBudget } from "@/lib/global-spend-guard";
import { planFeatures } from "@locateflow/shared";

// GET /api/addresses/:id/dossier — the New Home Dossier data endpoint.
//
// Aggregates seven public lookups for a saved address (all keyless except air):
//   • flood   — FEMA NFHL flood zone at the point        (lib/fema-flood.ts)
//   • school  — NCES EDGE school district at the point   (lib/nces-district.ts)
//   • weather — NWS move-day forecast at the destination (lib/nws-weather.ts)
//   • hazards — FEMA National Risk Index tract ratings   (lib/fema-nri.ts)
//   • radon   — EPA county radon zone at the point       (lib/epa-radon.ts)
//   • water   — EPA SDWIS community water system by city (lib/epa-water.ts)
//   • air     — AirNow current AQI (needs AIRNOW_API_KEY) (lib/airnow.ts)
//   • housing — HUD User FMR / Income Limits by ZIP area (lib/hud-housing.ts)
//   • ev      — NLR public EV charging near the point (lib/nlr-alt-fuel-stations.ts)
//
// Every lookup degrades gracefully (status unions, never throws), so this
// route always answers 200 for an authorized address — sections individually
// report "no_location" / "too_far" / "not_configured" / "error" instead of
// failing the request.
//
// Weather window: a forecast is only meaningful when this address is the
// DESTINATION of the user's earliest upcoming active moving plan AND the move
// date is within the NWS ~7-day forecast horizon. Otherwise the section is
// "too_far" with null fields.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEATHER_WINDOW_DAYS = 7;
const DOSSIER_SUMMARY_CACHE_TTL_MS = 15 * 60 * 1000;
const DOSSIER_PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;
const DOSSIER_FULL_CACHE_TTL_MS = 10 * 60 * 1000;
// Mirrors the "active plan" definition used by daily-digest move reminders.
const ACTIVE_PLAN_STATUSES = ["PLANNING", "IN_PROGRESS"];

type DossierCacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const dossierCache = new Map<string, DossierCacheEntry>();

export function clearDossierCacheForTests() {
  dossierCache.clear();
}

function getDossierCache(key: string): unknown | null {
  const cached = dossierCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    dossierCache.delete(key);
    return null;
  }
  return cached.payload;
}

function setDossierCache(key: string, payload: unknown, ttlMs: number) {
  // Tiny in-process LRU guard. Dossier keys are per-user/per-address, so keep
  // the cap conservative and evict oldest insertion when the worker gets busy.
  if (dossierCache.size > 250) {
    const oldest = dossierCache.keys().next().value;
    if (oldest) dossierCache.delete(oldest);
  }
  dossierCache.set(key, { expiresAt: Date.now() + ttlMs, payload });
}

function dossierJson(payload: unknown, cacheState: "HIT" | "MISS" | "BYPASS", ttlMs?: number) {
  const headers: Record<string, string> = { "X-Dossier-Cache": cacheState };
  if (ttlMs) headers["Cache-Control"] = `private, max-age=${Math.floor(ttlMs / 1000)}`;
  return NextResponse.json(payload, { headers });
}

function addressVersion(address: { updatedAt?: Date | string | null }): string {
  const value = address.updatedAt;
  if (!value) return "unknown";
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Classify an upstream lookup result for the durable area cache. Every lookup
 * result carries a `status` ("ok" | "no_location" | "error" | …), so "ok" is
 * the only REAL outcome; anything else is DEGRADED (retry next time) and a
 * null/absent result is EMPTY. getOrFetchSection serves REAL from cache and
 * re-fetches the rest ("fetch once; serve cache; retry only if not real").
 */
function libCacheStatus(r: { status?: string } | null | undefined): SectionDataStatus {
  if (r == null) return "EMPTY";
  return r.status === "ok" ? "REAL" : "DEGRADED";
}

/**
 * Global daily dossier spend circuit-breaker. When the app-wide budget for the
 * day is exhausted, a cost-bearing upstream lookup is skipped: it rejects so the
 * caller's `allSettled` records the section as degraded (and durable-cached
 * sections fall back to any prior stale row). Fresh durable-cache HITs are
 * served before the fetcher runs, so cached areas are unaffected. `allowed` is
 * resolved once per request via checkGlobalBudget("dossier"); off by default
 * (no cap configured) → always allowed. (docs/ai/free-pivot/15 + global-spend-guard)
 */
function dossierBudgetGated<T>(allowed: boolean, run: () => Promise<T>): Promise<T> {
  return allowed ? run() : Promise.reject(new Error("DOSSIER_GLOBAL_BUDGET_EXHAUSTED"));
}

interface FloodSection {
  status: "ok" | "no_location" | "error";
  zone: string | null;
  isHighRisk: boolean | null;
}

interface SchoolSection {
  status: "ok" | "no_location" | "error";
  districtName: string | null;
  ncesId: string | null;
}

interface WeatherSection {
  status: "ok" | "no_location" | "too_far" | "error";
  forecastDate: string | null;
  summary: string | null;
  tempHighF: number | null;
  tempLowF: number | null;
  precipChancePct: number | null;
}

interface HazardsSection {
  status: "ok" | "no_location" | "error";
  topRisks: Array<{ hazard: string; rating: string }>;
  overallRating: string | null;
}

interface RadonSection {
  status: "ok" | "no_location" | "error";
  zone: RadonZone | null;
}

interface WaterSection {
  status: "ok" | "no_location" | "error";
  systemName: string | null;
  violations5y: number | null;
}

interface AirSection {
  status: "ok" | "not_configured" | "no_location" | "error";
  aqi: number | null;
  category: string | null;
}

interface HousingSection {
  status: "ok" | "disabled" | "not_configured" | "no_location" | "no_zip" | "not_found" | "error";
  zip: string | null;
  entityId: string | null;
  countyFips: string | null;
  cbsaCode: string | null;
  countyName: string | null;
  metroName: string | null;
  areaName: string | null;
  fairMarketRent: {
    year: number | null;
    efficiency: number | null;
    oneBedroom: number | null;
    twoBedroom: number | null;
    threeBedroom: number | null;
    fourBedroom: number | null;
    zipSpecific: boolean;
  } | null;
  incomeLimits: {
    year: number | null;
    medianIncome: number | null;
    extremelyLowIncome4Person: number | null;
    veryLowIncome4Person: number | null;
    lowIncome4Person: number | null;
  } | null;
  caveat: string | null;
}

interface EvChargingSection {
  status: "ok" | "disabled" | "not_configured" | "no_location" | "error";
  radiusMiles: number;
  totalResults: number | null;
  stationCount: number;
  nearestDistanceMiles: number | null;
  dcFastPortCount: number;
  level2PortCount: number;
  teslaCompatibleCount: number;
  ccsCompatibleCount: number;
  stations: EvChargingStationSummary[];
  caveat: string | null;
}

// Pro-only Neighborhood Intelligence — a small bundle of area context (Census
// ACS economics + EPA walkability + nearby public schools). Unlike the other
// sections this one is ALSO plan-gated: non-Pro entitled-dossier plans
// (Individual/Family) see a teaser (`status: "upgrade_required"`) instead of
// the data — mirroring the whole-dossier upgrade teaser pattern above.
//
// STATUS MODEL: the section status reflects AVAILABILITY of the Pro section,
// not any single source — "upgrade_required" (non-Pro), "no_location" (no
// coordinates), else "ok" (Pro + located: the bundle ran). Each datum below is
// independently nullable, so one source degrading (e.g. an unset Census key)
// just nulls its own fields while the others still render. Per-source health is
// recorded to integration telemetry (census / walkability / schools buckets).
interface NeighborhoodSection {
  status: "ok" | "upgrade_required" | "no_location";
  /** Set only when status === "upgrade_required" (the per-section teaser). */
  upgradeRequired: "NEIGHBORHOOD_UPGRADE_REQUIRED" | null;
  medianHomeValue: number | null;
  medianGrossRent: number | null;
  medianHouseholdIncome: number | null;
  /** Owner-occupied share as a 0–100 percent (the dashboard card renders a %). */
  ownerOccupiedPct: number | null;
  incomeBand: AcsContextBand;
  homeValueBand: AcsContextBand;
  /** EPA National Walkability Index (1–20) or null when unavailable. */
  walkScore: number | null;
  /** Coarse plain-English band for the walkability score. */
  walkBand: WalkabilityBand;
  /** Nearest open public schools (name + level), directory data only. */
  schools: Array<{ name: string; level: SchoolLevel }>;
  caveat: string | null;
}

function emptyWeather(status: WeatherSection["status"]): WeatherSection {
  return { status, forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null };
}

function floodSection(settled: PromiseSettledResult<FloodLookupResult>): FloodSection {
  if (settled.status !== "fulfilled") return { status: "error", zone: null, isHighRisk: null };
  const { status, zone, isHighRisk } = settled.value;
  return { status, zone, isHighRisk };
}

function schoolSection(settled: PromiseSettledResult<SchoolDistrictLookupResult>): SchoolSection {
  if (settled.status !== "fulfilled") return { status: "error", districtName: null, ncesId: null };
  const { status, districtName, ncesId } = settled.value;
  return { status, districtName, ncesId };
}

function weatherSection(settled: PromiseSettledResult<WeatherLookupResult | null>): WeatherSection {
  if (settled.status !== "fulfilled") return emptyWeather("error");
  // null = the route decided no forecast applies (handled by the caller).
  if (settled.value === null) return emptyWeather("too_far");
  const { status, forecastDate, summary, tempHighF, tempLowF, precipChancePct } = settled.value;
  return { status, forecastDate, summary, tempHighF, tempLowF, precipChancePct };
}

function hazardsSection(settled: PromiseSettledResult<HazardRiskLookupResult>): HazardsSection {
  if (settled.status !== "fulfilled") return { status: "error", topRisks: [], overallRating: null };
  const { status, topRisks, overallRating } = settled.value;
  return { status, topRisks: topRisks.map(({ hazard, rating }) => ({ hazard, rating })), overallRating };
}

function radonSection(settled: PromiseSettledResult<RadonLookupResult>): RadonSection {
  if (settled.status !== "fulfilled") return { status: "error", zone: null };
  const { status, zone } = settled.value;
  return { status, zone };
}

function waterSection(settled: PromiseSettledResult<WaterSystemLookupResult>): WaterSection {
  if (settled.status !== "fulfilled") return { status: "error", systemName: null, violations5y: null };
  const { status, systemName, violations5y } = settled.value;
  return { status, systemName, violations5y };
}

function airSection(settled: PromiseSettledResult<AirQualityLookupResult>): AirSection {
  if (settled.status !== "fulfilled") return { status: "error", aqi: null, category: null };
  const { status, aqi, category } = settled.value;
  return { status, aqi, category };
}

function emptyHousing(status: HousingSection["status"], zip: string | null = null): HousingSection {
  return {
    status,
    zip,
    entityId: null,
    countyFips: null,
    cbsaCode: null,
    countyName: null,
    metroName: null,
    areaName: null,
    fairMarketRent: null,
    incomeLimits: null,
    caveat: null,
  };
}

function housingSection(settled: PromiseSettledResult<HudHousingLookupResult>): HousingSection {
  if (settled.status !== "fulfilled") return emptyHousing("error");
  const {
    status,
    zip,
    entityId,
    countyFips,
    cbsaCode,
    countyName,
    metroName,
    areaName,
    fairMarketRent,
    incomeLimits,
    caveat,
  } = settled.value;
  return {
    status,
    zip,
    entityId,
    countyFips,
    cbsaCode,
    countyName,
    metroName,
    areaName,
    fairMarketRent,
    incomeLimits,
    caveat,
  };
}

function emptyEvCharging(status: EvChargingSection["status"]): EvChargingSection {
  return {
    status,
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
  };
}

function evChargingSection(settled: PromiseSettledResult<EvChargingLookupResult>): EvChargingSection {
  if (settled.status !== "fulfilled") return emptyEvCharging("error");
  const {
    status,
    radiusMiles,
    totalResults,
    stationCount,
    nearestDistanceMiles,
    dcFastPortCount,
    level2PortCount,
    teslaCompatibleCount,
    ccsCompatibleCount,
    stations,
    caveat,
  } = settled.value;
  return {
    status,
    radiusMiles,
    totalResults,
    stationCount,
    nearestDistanceMiles,
    dcFastPortCount,
    level2PortCount,
    teslaCompatibleCount,
    ccsCompatibleCount,
    stations,
    caveat,
  };
}

function emptyNeighborhood(status: "ok" | "no_location"): NeighborhoodSection {
  return {
    status,
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
  };
}

/** The per-section teaser shown when the dossier is entitled but the plan is
 *  not Pro — mirrors the whole-dossier upgrade teaser. Carries no data. */
function neighborhoodTeaser(): NeighborhoodSection {
  return {
    ...emptyNeighborhood("no_location"),
    status: "upgrade_required",
    upgradeRequired: "NEIGHBORHOOD_UPGRADE_REQUIRED",
  };
}

/**
 * Merge the three Pro-bundle lookups (Census ACS economics, EPA walkability,
 * nearby public schools) into one section. Always "ok" — this is only called
 * for a Pro plan WITH coordinates, so the bundle ran; each datum is
 * independently nullable when its own source degraded (e.g. an unset Census
 * key nulls the medians but leaves walkability/schools intact). Extra lib
 * fields (geography/reason/source/etc.) are stripped to the contract shape.
 */
function neighborhoodSection(
  censusSettled: PromiseSettledResult<NeighborhoodAcsResult>,
  walkSettled: PromiseSettledResult<WalkabilityLookupResult>,
  schoolsSettled: PromiseSettledResult<NearbySchoolsLookupResult>,
): NeighborhoodSection {
  const section = emptyNeighborhood("ok");

  if (censusSettled.status === "fulfilled" && censusSettled.value.status === "ok") {
    const c = censusSettled.value;
    section.medianHomeValue = c.medianHomeValue;
    section.medianGrossRent = c.medianGrossRent;
    section.medianHouseholdIncome = c.medianHouseholdIncome;
    // Census reports a 0–1 share; the card renders a whole percent.
    section.ownerOccupiedPct = c.ownerOccupiedShare === null ? null : Math.round(c.ownerOccupiedShare * 100);
    section.incomeBand = c.incomeBand;
    section.homeValueBand = c.homeValueBand;
    section.caveat = c.caveat;
  }

  if (walkSettled.status === "fulfilled" && walkSettled.value.status === "ok") {
    section.walkScore = walkSettled.value.score;
    section.walkBand = walkSettled.value.band;
  }

  if (schoolsSettled.status === "fulfilled" && schoolsSettled.value.status === "ok") {
    section.schools = schoolsSettled.value.schools.map(({ name, level }) => ({ name, level }));
  }

  return section;
}

/** Telemetry status for one Pro-bundle source: its own status, or "error" if
 *  the (contractually non-throwing) lookup rejected anyway. */
function sourceTelemetryStatus(settled: PromiseSettledResult<{ status: string }>): string {
  return settled.status === "fulfilled" ? settled.value.status : "error";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const rl = await rateLimit(getRateLimitKey(request, "address:dossier", { userId }), {
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } },
      );
    }

    const scope = await resolveWorkspaceDataScope(request, userId);
    const { id } = await params;

    const address = await prisma.address.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        workspaceId: true,
        deletedAt: true,
        city: true,
        state: true,
        zip: true,
        latitude: true,
        longitude: true,
        updatedAt: true,
      },
    });
    if (!address || address.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    // Foreign-scope ids 404 (never 403) — same pattern as GET /api/addresses/:id.
    assertScopedRecordAction(address, scope, "address.view", { notFoundMessage: "Address not found" });

    // Resolve the plan once: the whole-dossier gate (homeDossier, Individual+)
    // and the per-section Neighborhood Intelligence gate (Pro only) both read
    // from it, so this is a single plan lookup for the request.
    const planInfo = await getPlanForLimitScope(userId, planLimitScopeForDataScope(scope));
    const features = planFeatures(planInfo.plan);

    const addressPayload = { id: address.id, city: address.city, state: address.state, zip: address.zip };
    const scopeKey = `${scope.workspaceId || "personal"}:${scope.memberRole || "owner"}`;
    const addressCacheVersion = addressVersion(address);

    const hasLocation =
      typeof address.latitude === "number" &&
      Number.isFinite(address.latitude) &&
      typeof address.longitude === "number" &&
      Number.isFinite(address.longitude);

    // Lightweight current-home dashboard summary. It returns only AirNow AQI
    // and HUD rent/income area context, so the paid full-dossier gate below
    // remains intact and the route avoids FEMA/NCES/NWS/NRI/water/EV/Census.
    if (new URL(request.url).searchParams.get("summary") === "1") {
      const summaryCacheKey = [
        "summary",
        userId,
        scopeKey,
        address.id,
        addressCacheVersion,
        address.zip || "",
        address.latitude ?? "no-lat",
        address.longitude ?? "no-lng",
      ].join(":");
      const cachedSummary = getDossierCache(summaryCacheKey);
      if (cachedSummary) {
        return dossierJson(cachedSummary, "HIT", DOSSIER_SUMMARY_CACHE_TTL_MS);
      }
      if (!hasLocation) {
        const summary = {
          configured: true,
          address: addressPayload,
          air: { status: "no_location", aqi: null, category: null } satisfies AirSection,
          housing: emptyHousing("no_location", address.zip),
        };
        recordIntegrationOutcomes({
          air: summary.air.status,
          hud_housing: summary.housing.status,
          dossier: "summary",
        });
        setDossierCache(summaryCacheKey, summary, DOSSIER_SUMMARY_CACHE_TTL_MS);
        return dossierJson(summary, "MISS", DOSSIER_SUMMARY_CACHE_TTL_MS);
      }

      const summaryBudget = await checkGlobalBudget("dossier");
      const [airSettled, housingSettled] = await Promise.allSettled([
        dossierBudgetGated(summaryBudget.allowed, () =>
          lookupAirQuality({ latitude: address.latitude, longitude: address.longitude })),
        dossierBudgetGated(summaryBudget.allowed, () =>
          lookupHudHousing({ zip: address.zip, state: address.state })),
      ]);
      const summary = {
        configured: true,
        address: addressPayload,
        air: airSection(airSettled),
        housing: housingSection(housingSettled),
      };
      recordIntegrationOutcomes({
        air: summary.air.status,
        hud_housing: summary.housing.status,
        dossier: "summary",
      });
      setDossierCache(summaryCacheKey, summary, DOSSIER_SUMMARY_CACHE_TTL_MS);
      return dossierJson(summary, "MISS", DOSSIER_SUMMARY_CACHE_TTL_MS);
    }

    // Paid-plan gate (owner decision): the dossier is INDIVIDUAL and up.
    // FREE/FREE_TRIAL get only the preview subset (flood / school /
    // moving-day weather) and never receive the full dossier payload. HTTP
    // 200 — never 403. 401/404 above still win.
    if (!features.homeDossier) {
      if (features.homeDossierPreview) {
        const previewBase = {
          configured: true,
          preview: true,
          homeDossierPreview: true,
          fullDossier: false,
          dossierPdf: false,
          address: addressPayload,
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
        };

        if (!hasLocation) {
          const previewNoLocation = {
            ...previewBase,
            flood: { status: "no_location", zone: null, isHighRisk: null } satisfies FloodSection,
            school: { status: "no_location", districtName: null, ncesId: null } satisfies SchoolSection,
            weather: emptyWeather("no_location"),
          };
          recordIntegrationOutcomes({
            nws: previewNoLocation.weather.status,
            dossier: "preview",
          });
          return dossierJson(previewNoLocation, "BYPASS");
        }

        const now = new Date();
        const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const plan = await prisma.movingPlan.findFirst({
          where: scopedRecordWhere(scope, {
            toAddressId: id,
            deletedAt: null,
            status: { in: ACTIVE_PLAN_STATUSES },
            moveDate: { gte: todayStartUtc },
          }),
          orderBy: { moveDate: "asc" },
          select: { moveDate: true },
        });
        const withinWindow =
          plan !== null && plan.moveDate.getTime() - now.getTime() <= WEATHER_WINDOW_DAYS * MS_PER_DAY;
        const weatherTargetDate = withinWindow ? plan.moveDate.toISOString().slice(0, 10) : null;
        const previewCacheKey = [
          "preview",
          userId,
          scopeKey,
          address.id,
          addressCacheVersion,
          address.latitude ?? "no-lat",
          address.longitude ?? "no-lng",
          weatherTargetDate || "no-weather",
        ].join(":");
        const cachedPreview = getDossierCache(previewCacheKey);
        if (cachedPreview) {
          return dossierJson(cachedPreview, "HIT", DOSSIER_PREVIEW_CACHE_TTL_MS);
        }

        const previewBudget = await checkGlobalBudget("dossier");
        const [floodSettled, schoolSettled, weatherSettled] = await Promise.allSettled([
          dossierBudgetGated(previewBudget.allowed, () =>
            lookupFloodZone({ latitude: address.latitude, longitude: address.longitude })),
          dossierBudgetGated(previewBudget.allowed, () =>
            lookupSchoolDistrict({ latitude: address.latitude, longitude: address.longitude })),
          weatherTargetDate
            ? dossierBudgetGated(previewBudget.allowed, () =>
                lookupMoveDayForecast({
                  latitude: address.latitude,
                  longitude: address.longitude,
                  targetDate: weatherTargetDate,
                }))
            : Promise.resolve(null),
        ]);
        const preview = {
          ...previewBase,
          flood: floodSection(floodSettled),
          school: schoolSection(schoolSettled),
          weather: weatherSection(weatherSettled),
        };
        recordIntegrationOutcomes({
          nws: preview.weather.status,
          dossier: "preview",
        });
        setDossierCache(previewCacheKey, preview, DOSSIER_PREVIEW_CACHE_TTL_MS);
        return dossierJson(preview, "MISS", DOSSIER_PREVIEW_CACHE_TTL_MS);
      }

      // Fire-and-forget telemetry (never throws, never adds latency): a gated
      // dossier request spent no external lookups, so only the composite
      // 'dossier' counter records it.
      recordIntegrationOutcome("dossier", "gated");
      return dossierJson({
        configured: true,
        entitled: false,
        upgradeRequired: "HOME_DOSSIER_UPGRADE_REQUIRED",
      }, "BYPASS");
    }

    // No coordinates → nothing to look up; every section is "no_location" and
    // no external call is made. (water keys off city/state, but an ungeocoded
    // address is an incomplete address — the uniform short-circuit keeps the
    // "no coordinates = zero external calls" guarantee simple and true.)
    if (!hasLocation) {
      const noLocationCacheKey = [
        "full",
        userId,
        scopeKey,
        address.id,
        addressCacheVersion,
        planInfo.plan,
        features.dossierPdf ? "pdf" : "no-pdf",
        features.neighborhoodIntel ? "pro" : "standard",
        "no-location",
      ].join(":");
      const cachedNoLocation = getDossierCache(noLocationCacheKey);
      if (cachedNoLocation) {
        return dossierJson(cachedNoLocation, "HIT", DOSSIER_FULL_CACHE_TTL_MS);
      }
      // Neighborhood Intelligence is Pro-gated: a non-Pro plan gets the teaser
      // (no lookup, no_location is moot); a Pro plan reports no_location like
      // the rest. census telemetry: 'gated' for the teaser, 'no_location' else.
      const neighborhood = features.neighborhoodIntel ? emptyNeighborhood("no_location") : neighborhoodTeaser();
      // Fire-and-forget telemetry (never throws, never adds latency): every
      // tracked section reports no_location; the dossier itself answered ok.
      recordIntegrationOutcomes({
        nws: "no_location",
        nri: "no_location",
        radon: "no_location",
        water: "no_location",
        air: "no_location",
        hud_housing: "no_location",
        ev_charging: "no_location",
        census: features.neighborhoodIntel ? "no_location" : "gated",
        walkability: features.neighborhoodIntel ? "no_location" : "gated",
        schools: features.neighborhoodIntel ? "no_location" : "gated",
        dossier: "ok",
      });
      const noLocationDossier = {
        configured: true,
        dossierPdf: features.dossierPdf,
        address: addressPayload,
        flood: { status: "no_location", zone: null, isHighRisk: null } satisfies FloodSection,
        school: { status: "no_location", districtName: null, ncesId: null } satisfies SchoolSection,
        weather: emptyWeather("no_location"),
        hazards: { status: "no_location", topRisks: [], overallRating: null } satisfies HazardsSection,
        radon: { status: "no_location", zone: null } satisfies RadonSection,
        water: { status: "no_location", systemName: null, violations5y: null } satisfies WaterSection,
        air: { status: "no_location", aqi: null, category: null } satisfies AirSection,
        housing: emptyHousing("no_location", address.zip),
        evCharging: emptyEvCharging("no_location"),
        neighborhood,
      };
      setDossierCache(noLocationCacheKey, noLocationDossier, DOSSIER_FULL_CACHE_TTL_MS);
      return dossierJson(noLocationDossier, "MISS", DOSSIER_FULL_CACHE_TTL_MS);
    }

    // Decide the weather window: earliest UPCOMING active plan that moves TO
    // this address. (Filtering to >= start of today skips stale active plans
    // whose move date already passed — move day itself still qualifies.)
    const now = new Date();
    const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const plan = await prisma.movingPlan.findFirst({
      where: scopedRecordWhere(scope, {
        toAddressId: id,
        deletedAt: null,
        status: { in: ACTIVE_PLAN_STATUSES },
        moveDate: { gte: todayStartUtc },
      }),
      orderBy: { moveDate: "asc" },
      select: { moveDate: true },
    });
    const withinWindow =
      plan !== null && plan.moveDate.getTime() - now.getTime() <= WEATHER_WINDOW_DAYS * MS_PER_DAY;
    const weatherTargetDate = withinWindow ? plan.moveDate.toISOString().slice(0, 10) : null;
    const fullCacheKey = [
      "full",
      userId,
      scopeKey,
      address.id,
      addressCacheVersion,
      planInfo.plan,
      features.dossierPdf ? "pdf" : "no-pdf",
      features.neighborhoodIntel ? "pro" : "standard",
      weatherTargetDate || "no-weather",
    ].join(":");
    const cachedFull = getDossierCache(fullCacheKey);
    if (cachedFull) {
      return dossierJson(cachedFull, "HIT", DOSSIER_FULL_CACHE_TTL_MS);
    }

    // The libs never throw by contract, but allSettled keeps one misbehaving
    // lookup from ever taking down the other sections (belt and braces).
    // Coordinate-keyed sections go through the durable, area-scoped cache
    // (getOrFetchSection): fetched once per geo cell, shared across users and
    // nearby addresses, re-fetched only when expired or not REAL. WATER (city/
    // state) and HOUSING (zip/state) are not coordinate-keyed and stay on the
    // request-level cache for now (low volume). The mappers are unchanged —
    // each cached promise resolves to the raw lib result via `.then(r => r.data)`.
    const dlat = address.latitude as number;
    const dlng = address.longitude as number;
    // Global daily dossier budget (the "fuse"): resolved once per full build. When
    // exhausted, cachedLookup fetchers and the direct WATER/HOUSING calls skip the
    // upstream call — fresh durable-cache HITs still serve; stale rows are served
    // as fallback; uncached sections degrade. Off by default → always allowed.
    const dossierBudget = await checkGlobalBudget("dossier");
    const cachedLookup = <T,>(section: DossierSection, run: () => Promise<T>, date?: string | null) =>
      getOrFetchSection<T>({
        section,
        lat: dlat,
        lng: dlng,
        date,
        fetcher: async () => {
          if (!dossierBudget.allowed) {
            // Over the app-wide daily budget — do not spend on a new upstream call.
            // Throw so getOrFetchSection serves a prior (stale) row if one exists,
            // otherwise the section degrades. No cost incurred.
            throw new Error("DOSSIER_GLOBAL_BUDGET_EXHAUSTED");
          }
          const r = await run();
          return { data: r, status: libCacheStatus(r as { status?: string } | null) };
        },
      }).then((res) => res.data);

    const [
      floodSettled,
      schoolSettled,
      weatherSettled,
      hazardsSettled,
      radonSettled,
      waterSettled,
      airSettled,
      housingSettled,
      evChargingSettled,
    ] = await Promise.allSettled([
      cachedLookup("FLOOD", () => lookupFloodZone({ latitude: dlat, longitude: dlng })),
      cachedLookup("SCHOOL", () => lookupSchoolDistrict({ latitude: dlat, longitude: dlng })),
      weatherTargetDate
        ? cachedLookup(
            "WEATHER",
            () => lookupMoveDayForecast({ latitude: dlat, longitude: dlng, targetDate: weatherTargetDate }),
            weatherTargetDate,
          )
        : Promise.resolve(null),
      cachedLookup("HAZARDS", () => lookupHazardRisks({ latitude: dlat, longitude: dlng })),
      cachedLookup("RADON", () => lookupRadonZone({ latitude: dlat, longitude: dlng })),
      // WATER/HOUSING aren't coordinate-keyed (no durable cache) — gate them on the
      // budget directly so an exhausted day skips their upstream spend too.
      dossierBudgetGated(dossierBudget.allowed, () =>
        lookupWaterSystem({ city: address.city, state: address.state })),
      cachedLookup("AIR", () => lookupAirQuality({ latitude: dlat, longitude: dlng })),
      dossierBudgetGated(dossierBudget.allowed, () =>
        lookupHudHousing({ zip: address.zip, state: address.state })),
      cachedLookup("EV", () => lookupEvCharging({ latitude: dlat, longitude: dlng })),
    ]);

    // Neighborhood Intelligence is Pro-only: only Pro spends these three
    // lookups (Census ACS + EPA walkability + nearby schools); every other
    // entitled plan gets the per-section upgrade teaser and no calls. The
    // three run together so one slow/failing source never blocks the others.
    let neighborhood: NeighborhoodSection;
    let censusStatus = "gated";
    let walkabilityStatus = "gated";
    let schoolsStatus = "gated";
    if (features.neighborhoodIntel) {
      const [censusSettled, walkSettled, schoolsSettled] = await Promise.allSettled([
        cachedLookup("NB_CENSUS", () => lookupNeighborhoodAcs({ latitude: dlat, longitude: dlng })),
        cachedLookup("NB_WALK", () => lookupWalkability({ latitude: dlat, longitude: dlng })),
        cachedLookup("NB_SCHOOLS", () => lookupNearbySchools({ latitude: dlat, longitude: dlng })),
      ]);
      neighborhood = neighborhoodSection(censusSettled, walkSettled, schoolsSettled);
      censusStatus = sourceTelemetryStatus(censusSettled);
      walkabilityStatus = sourceTelemetryStatus(walkSettled);
      schoolsStatus = sourceTelemetryStatus(schoolsSettled);
    } else {
      neighborhood = neighborhoodTeaser();
    }

    const dossier = {
      configured: true,
      dossierPdf: features.dossierPdf,
      address: addressPayload,
      flood: floodSection(floodSettled),
      school: schoolSection(schoolSettled),
      weather: weatherSection(weatherSettled),
      hazards: hazardsSection(hazardsSettled),
      radon: radonSection(radonSettled),
      water: waterSection(waterSettled),
      air: airSection(airSettled),
      housing: housingSection(housingSettled),
      evCharging: evChargingSection(evChargingSettled),
      neighborhood,
    };

    // Fire-and-forget telemetry (synchronous in-process buffer — never throws,
    // never adds latency). Per-section statuses for the sources that have an
    // IntegrationDailyStat bucket (weather→nws, hazards→nri, radon, water,
    // air; neighborhood→census; flood/school have no bucket), plus the
    // composite 'dossier' ok. A non-Pro plan records census 'upgrade_required'.
    recordIntegrationOutcomes({
      nws: dossier.weather.status,
      nri: dossier.hazards.status,
      radon: dossier.radon.status,
      water: dossier.water.status,
      air: dossier.air.status,
      hud_housing: dossier.housing.status,
      ev_charging: dossier.evCharging.status,
      // Per-source health for the Pro bundle (NOT the merged section status).
      census: censusStatus,
      walkability: walkabilityStatus,
      schools: schoolsStatus,
      dossier: "ok",
    });

    setDossierCache(fullCacheKey, dossier, DOSSIER_FULL_CACHE_TTL_MS);
    return dossierJson(dossier, "MISS", DOSSIER_FULL_CACHE_TTL_MS);
  } catch (error) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to build address dossier:", error);
    return NextResponse.json({ error: "Failed to build address dossier" }, { status: 500 });
  }
}

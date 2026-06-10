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
import { assertScopedRecordAction, resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";
import { recordIntegrationOutcome, recordIntegrationOutcomes } from "@/lib/integration-telemetry";
import { getUserPlan } from "@/lib/plan-limits";
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
// Mirrors the "active plan" definition used by daily-digest move reminders.
const ACTIVE_PLAN_STATUSES = ["PLANNING", "IN_PROGRESS"];

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
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
        latitude: true,
        longitude: true,
      },
    });
    if (!address || address.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    // Foreign-scope ids 404 (never 403) — same pattern as GET /api/addresses/:id.
    assertScopedRecordAction(address, scope, "address.view", { notFoundMessage: "Address not found" });

    // Paid-plan gate (owner decision): the dossier is INDIVIDUAL and up.
    // FREE/FREE_TRIAL get a value-first upgrade teaser instead. HTTP 200 —
    // never 403 — and the address/section blocks are omitted, so old clients
    // (which require them) fail soft to a hidden card and no external lookups
    // or plan queries are spent on a gated request. 401/404 above still win.
    if (!planFeatures((await getUserPlan(userId)).plan).homeDossier) {
      // Fire-and-forget telemetry (never throws, never adds latency): a gated
      // dossier request spent no external lookups, so only the composite
      // 'dossier' counter records it.
      recordIntegrationOutcome("dossier", "gated");
      return NextResponse.json({
        configured: true,
        entitled: false,
        upgradeRequired: "HOME_DOSSIER_UPGRADE_REQUIRED",
      });
    }

    const addressPayload = { id: address.id, city: address.city, state: address.state };

    const hasLocation =
      typeof address.latitude === "number" &&
      Number.isFinite(address.latitude) &&
      typeof address.longitude === "number" &&
      Number.isFinite(address.longitude);

    // No coordinates → nothing to look up; every section is "no_location" and
    // no external call is made. (water keys off city/state, but an ungeocoded
    // address is an incomplete address — the uniform short-circuit keeps the
    // "no coordinates = zero external calls" guarantee simple and true.)
    if (!hasLocation) {
      // Fire-and-forget telemetry (never throws, never adds latency): every
      // tracked section reports no_location; the dossier itself answered ok.
      recordIntegrationOutcomes({
        nws: "no_location",
        nri: "no_location",
        radon: "no_location",
        water: "no_location",
        air: "no_location",
        dossier: "ok",
      });
      return NextResponse.json({
        configured: true,
        address: addressPayload,
        flood: { status: "no_location", zone: null, isHighRisk: null } satisfies FloodSection,
        school: { status: "no_location", districtName: null, ncesId: null } satisfies SchoolSection,
        weather: emptyWeather("no_location"),
        hazards: { status: "no_location", topRisks: [], overallRating: null } satisfies HazardsSection,
        radon: { status: "no_location", zone: null } satisfies RadonSection,
        water: { status: "no_location", systemName: null, violations5y: null } satisfies WaterSection,
        air: { status: "no_location", aqi: null, category: null } satisfies AirSection,
      });
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

    // The libs never throw by contract, but allSettled keeps one misbehaving
    // lookup from ever taking down the other sections (belt and braces).
    const [floodSettled, schoolSettled, weatherSettled, hazardsSettled, radonSettled, waterSettled, airSettled] =
      await Promise.allSettled([
        lookupFloodZone({ latitude: address.latitude, longitude: address.longitude }),
        lookupSchoolDistrict({ latitude: address.latitude, longitude: address.longitude }),
        weatherTargetDate
          ? lookupMoveDayForecast({
              latitude: address.latitude,
              longitude: address.longitude,
              targetDate: weatherTargetDate,
            })
          : Promise.resolve(null),
        lookupHazardRisks({ latitude: address.latitude, longitude: address.longitude }),
        lookupRadonZone({ latitude: address.latitude, longitude: address.longitude }),
        lookupWaterSystem({ city: address.city, state: address.state }),
        lookupAirQuality({ latitude: address.latitude, longitude: address.longitude }),
      ]);

    const dossier = {
      configured: true,
      address: addressPayload,
      flood: floodSection(floodSettled),
      school: schoolSection(schoolSettled),
      weather: weatherSection(weatherSettled),
      hazards: hazardsSection(hazardsSettled),
      radon: radonSection(radonSettled),
      water: waterSection(waterSettled),
      air: airSection(airSettled),
    };

    // Fire-and-forget telemetry (synchronous in-process buffer — never throws,
    // never adds latency). Per-section statuses for the sources that have an
    // IntegrationDailyStat bucket (weather→nws, hazards→nri, radon, water,
    // air; flood/school have no bucket), plus the composite 'dossier' ok.
    recordIntegrationOutcomes({
      nws: dossier.weather.status,
      nri: dossier.hazards.status,
      radon: dossier.radon.status,
      water: dossier.water.status,
      air: dossier.air.status,
      dossier: "ok",
    });

    return NextResponse.json(dossier);
  } catch (error) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to build address dossier:", error);
    return NextResponse.json({ error: "Failed to build address dossier" }, { status: 500 });
  }
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CloudSun,
  Compass,
  Check,
  Download,
  Droplets,
  FlaskConical,
  GraduationCap,
  Home,
  MapPin,
  Mountain,
  Sparkles,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import {
  DossierAmbient,
  ambientForSection,
  sourceDossierSceneFor,
  sourceSceneVars,
  sourceSceneTag,
  useDossierCountUp,
} from "./dossier-ambient";

/**
 * NEW HOME DOSSIER — Aurora dashboard widget.
 *
 * Honest, sourced facts about the user's next home (the active move's
 * destination address, else the primary address):
 *   1. FEMA flood zone (+ mandatory "not an insurance determination" fine print
 *      and a link to the official FEMA map service center),
 *   2. School district (NCES boundaries — assignment may differ),
 *   3. Moving-day weather (NWS forecast; only when the move is ≤7 days out),
 *   4. Natural hazard profile (FEMA National Risk Index — relative, tract-level),
 *   5. EPA radon zone by county (+ mandatory "test regardless of zone" fine print),
 *   6. Drinking-water system record (EPA SDWIS health-based violations, 5 yrs),
 *   7. Current air quality (AirNow AQI snapshot; absent when not configured),
 *   8. HUD housing context (FMR + income limits),
 *   9. public active EV charging near the destination (NLR/AFDC), and
 *   10. Pro-only neighborhood intelligence.
 *
 * GRACEFUL DEGRADATION (same contract style as the dossier lookup libs):
 * the card consumes GET /api/addresses/{id}/dossier, whose sections each carry
 * a status union. Anything non-"ok" simply hides that row; when EVERY section
 * is degraded (no_location/error) the whole card disappears — never an empty
 * shell. A location-less address with something still renderable (e.g. the
 * primary-address case where weather is merely "too_far") gets one honest
 * "add a precise address" hint row instead of fabricated rows. Fetch failures
 * never throw into the dashboard — they collapse to the hidden state.
 */

const DOSSIER_SHELL_CLASS = "lf-dossier-shell rounded-2xl border border-border backdrop-blur-xl overflow-hidden";
const DOSSIER_ROW_CLASS = "lf-dossier-row relative isolate p-3 rounded-xl border border-border";
const DOSSIER_SCENE_ROW_CLASS = "lf-dossier-row lf-dossier-scene-card relative isolate p-3 rounded-xl border border-border";
const DOSSIER_STAT_CLASS = "lf-dossier-stat rounded-lg border border-border px-2.5 py-2";
const DOSSIER_SOURCE_BAR_COUNT = 5;

type DossierSceneDeckCard = {
  key: string;
  label: string;
  value: string;
  sub: string;
  ambient: ReturnType<typeof ambientForSection>;
};

function dossierDeckPriority(intensity: number): number {
  return intensity >= 2 ? 3 : intensity >= 1 ? 2 : 1;
}

function activeDossierDeckBars(intensity: number): number {
  return intensity >= 2 ? 5 : intensity >= 1 ? 3 : 2;
}

function dossierDeckBandKey(intensity: number): "dossier_deck_bandGood" | "dossier_deck_bandCheck" | "dossier_deck_bandAlert" {
  return intensity >= 2
    ? "dossier_deck_bandAlert"
    : intensity >= 1
      ? "dossier_deck_bandCheck"
      : "dossier_deck_bandGood";
}

// ── Contract types (GET /api/addresses/{id}/dossier) ─────────────────────────

export type DossierSectionStatus = "ok" | "no_location" | "error";
export type DossierWeatherStatus = "ok" | "no_location" | "too_far" | "error";
export type DossierAirStatus = "ok" | "not_configured" | "no_location" | "error";
export type DossierHousingStatus = "ok" | "disabled" | "not_configured" | "no_location" | "no_zip" | "not_found" | "error";
export type DossierEvChargingStatus = "ok" | "disabled" | "not_configured" | "no_location" | "error";
/**
 * Neighborhood is a Pro-only section that lives ABOVE the rest of the dossier
 * gate (Individual+ unlocks the other seven; Pro adds this one). Its status
 * therefore adds "upgrade_required" — an entitled-to-the-dossier but non-Pro
 * user gets a locked teaser for this one row while the others render real data.
 * "not_configured" covers a deployment without the Census/ACS key.
 */
export type DossierNeighborhoodStatus =
  | "ok"
  | "upgrade_required"
  | "not_configured"
  | "no_location"
  | "error";

/** Coarse EPA walkability band (1–20 index binned per the EPA methodology). */
export type WalkBand = "least" | "below_average" | "above_average" | "most";

export interface DossierHazardRisk {
  hazard: string;
  rating: string;
}

export interface DossierSchool {
  name: string;
  /**
   * Grade level (e.g. "Elementary"/"Middle"/"High"/"Other"), or null when the
   * federal directory didn't report one. This is DIRECTORY data only — there is
   * deliberately no quality rating here, and one is never fabricated.
   */
  level: string | null;
}

export interface HomeDossierResponse {
  configured: boolean;
  /**
   * Plan gate (GATE-API contract, HTTP 200): `false` means the user's plan
   * (FREE/FREE_TRIAL) doesn't include the dossier — render the upgrade teaser.
   * Absent on older/entitled payloads, which keeps today's behavior.
   */
  entitled?: boolean;
  /** Companion gate signal — any truthy value is treated the same as entitled:false. */
  upgradeRequired?: boolean;
  /** Gate code (e.g. an *_UPGRADE_REQUIRED constant) — informational only here. */
  code?: string;
  /**
   * Pro PDF export entitlement (FEATURES.dossierPdf). When true the card
   * shows the "Export PDF" affordance wired to the dossier PDF route. Absent
   * on older payloads and on Free → the button stays hidden, so a
   * non-entitled user never sees a button that would only return the teaser.
   */
  dossierPdf?: boolean;
  /** Free-tier payload marker: only preview sections are present. */
  preview?: boolean;
  homeDossierPreview?: boolean;
  fullDossier?: boolean;
  lockedSections?: string[];
  /** Sections are absent on gated payloads; the teaser never reads them. */
  address?: { id: string; city: string; state: string };
  flood?: { status: DossierSectionStatus; zone: string | null; isHighRisk: boolean | null };
  school?: { status: DossierSectionStatus; districtName: string | null; ncesId: string | null };
  weather?: {
    status: DossierWeatherStatus;
    forecastDate: string | null;
    summary: string | null;
    tempHighF: number | null;
    tempLowF: number | null;
    precipChancePct: number | null;
  };
  /**
   * Extended sections (each independent, each optional so older payloads keep
   * working). topRisks carries max 3 entries, only ratings >= "Relatively
   * Moderate" per the API contract.
   */
  hazards?: { status: DossierSectionStatus; topRisks: DossierHazardRisk[]; overallRating: string | null };
  /** EPA radon zone by county (1 = highest predicted indoor radon potential). */
  radon?: { status: DossierSectionStatus; zone: 1 | 2 | 3 | null };
  water?: { status: DossierSectionStatus; systemName: string | null; violations5y: number | null };
  air?: { status: DossierAirStatus; aqi: number | null; category: string | null };
  housing?: {
    status: DossierHousingStatus;
    zip: string | null;
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
  };
  evCharging?: {
    status: DossierEvChargingStatus;
    radiusMiles: number;
    totalResults: number | null;
    stationCount: number;
    nearestDistanceMiles: number | null;
    dcFastPortCount: number;
    level2PortCount: number;
    teslaCompatibleCount: number;
    ccsCompatibleCount: number;
    stations: Array<{ name: string; distanceMiles: number | null; city: string | null; state: string | null }>;
    caveat: string | null;
  };
  /**
   * Neighborhood (Pro-only) — area medians from the Census/ACS for the
   * surrounding tract, NOT a valuation of this specific home. `status:
   * "upgrade_required"` is the per-section gate for an entitled-but-non-Pro
   * user (locked teaser). Figures are whole-dollar (value/rent/income) or a
   * 0–100 percent (owner-occupied share); schools is an optional nearby list.
   */
  neighborhood?: {
    status: DossierNeighborhoodStatus;
    medianHomeValue: number | null;
    medianGrossRent: number | null;
    medianHouseholdIncome: number | null;
    ownerOccupiedPct: number | null;
    /** EPA National Walkability Index (1–20); area context, not a per-home score. */
    walkScore?: number | null;
    /** Coarse walkability band: least | below_average | above_average | most. */
    walkBand?: string | null;
    schools?: DossierSchool[] | null;
  };
}

/**
 * True when the API answered 200 with a plan gate instead of data: the feature
 * is configured (key present) but the user's plan doesn't include it. The card
 * then renders the value-first upgrade teaser instead of hiding. configured:false
 * still hides everything — never tease a feature the deployment can't serve.
 */
export function isDossierGated(data: HomeDossierResponse | null | undefined): boolean {
  return !!data && data.configured === true && (data.entitled === false || data.upgradeRequired === true);
}

// ── Pure view derivation (exported for tests) ────────────────────────────────

export interface HomeDossierView {
  /** False → render nothing at all (never show an empty shell). */
  visible: boolean;
  /** True when the server returned the Free preview subset, not the full dossier. */
  preview: boolean;
  flood: { zone: string; isHighRisk: boolean | null } | null;
  school: { districtName: string } | null;
  weather: {
    forecastDate: string | null;
    summary: string | null;
    tempHighF: number | null;
    tempLowF: number | null;
    precipChancePct: number | null;
  } | null;
  hazards: { topRisks: DossierHazardRisk[]; overallRating: string | null } | null;
  radon: { zone: 1 | 2 | 3 } | null;
  water: { systemName: string; violations5y: number } | null;
  air: { aqi: number | null; category: string | null } | null;
  housing: {
    areaName: string | null;
    countyName: string | null;
    zip: string | null;
    twoBedroomFmr: number | null;
    fmrYear: number | null;
    medianIncome: number | null;
    lowIncome4Person: number | null;
    incomeYear: number | null;
  } | null;
  evCharging: {
    radiusMiles: number;
    stationCount: number;
    nearestDistanceMiles: number | null;
    dcFastPortCount: number;
    level2PortCount: number;
  } | null;
  /**
   * Neighborhood (Pro). `locked` → render the in-card Pro teaser row;
   * `data` → render the area-median stat rows; null → hide the row entirely.
   */
  neighborhood:
    | { locked: true }
    | {
        locked: false;
        medianHomeValue: number | null;
        medianGrossRent: number | null;
        medianHouseholdIncome: number | null;
        ownerOccupiedPct: number | null;
        walkScore: number | null;
        walkBand: WalkBand | null;
        schools: DossierSchool[];
      }
    | null;
  /** One honest "add a precise address to unlock local insights" row. */
  showLocationHint: boolean;
}

const HIDDEN_VIEW: HomeDossierView = {
  visible: false,
  preview: false,
  flood: null,
  school: null,
  weather: null,
  hazards: null,
  radon: null,
  water: null,
  air: null,
  housing: null,
  evCharging: null,
  neighborhood: null,
  showLocationHint: false,
};

/**
 * Statuses that mean "nothing honest to render and nothing for the user to do
 * here". `not_configured` (air) joins no_location/error: an unconfigured
 * deployment section should never keep an otherwise-empty card alive. Weather
 * "too_far" deliberately stays OUT — the forecast becomes available as the
 * move approaches, so the card may still show the location hint.
 */
const DEGRADED_STATUSES = new Set(["no_location", "error", "not_configured", "disabled", "no_zip", "not_found"]);

/**
 * Decide what (if anything) the card shows. Defensive against partial/missing
 * payloads: a malformed response degrades to the hidden state, an "ok" section
 * missing its headline datum (zone / districtName / any weather figure) is
 * skipped rather than rendered empty.
 */
export function deriveDossierView(data: HomeDossierResponse | null | undefined): HomeDossierView {
  if (!data || data.configured !== true || !data.address || !data.flood || !data.school) {
    return HIDDEN_VIEW;
  }
  const preview = data.preview === true || data.homeDossierPreview === true || data.fullDossier === false;
  if (!preview && !data.weather) {
    return HIDDEN_VIEW;
  }

  const statuses: string[] = [data.flood.status, data.school.status];
  if (typeof data.weather?.status === "string") statuses.push(data.weather.status);
  // Extended sections are optional — older payloads simply don't vote.
  for (const status of [data.hazards?.status, data.radon?.status, data.water?.status, data.air?.status]) {
    if (typeof status === "string") statuses.push(status);
  }
  for (const status of [data.housing?.status, data.evCharging?.status]) {
    if (typeof status === "string") statuses.push(status);
  }
  // Neighborhood (Pro) is derived BEFORE the whole-card-hide check: it is
  // gated above the rest of the dossier, so a locked Pro teaser (or real Pro
  // data) is actionable content that must keep the card alive even when every
  // federal lookup degraded for this address.
  const neighborhood = deriveNeighborhood(data.neighborhood);

  // Whole card hidden when EVERY section is degraded AND the neighborhood row
  // has nothing to show — there is nothing honest to say and no actionable hint
  // beyond what the address form already communicates.
  if (!neighborhood && statuses.every((s) => DEGRADED_STATUSES.has(s))) return HIDDEN_VIEW;

  const flood =
    data.flood.status === "ok" && typeof data.flood.zone === "string" && data.flood.zone.trim()
      ? { zone: data.flood.zone.trim(), isHighRisk: data.flood.isHighRisk ?? null }
      : null;

  const school =
    data.school.status === "ok" && typeof data.school.districtName === "string" && data.school.districtName.trim()
      ? { districtName: data.school.districtName.trim() }
      : null;

  const weatherData = data.weather;
  const hasWeatherFigure =
    weatherData?.status === "ok" &&
    (typeof weatherData.summary === "string" ||
      typeof weatherData.tempHighF === "number" ||
      typeof weatherData.tempLowF === "number" ||
      typeof weatherData.precipChancePct === "number");
  const weather = hasWeatherFigure && weatherData
    ? {
        forecastDate: weatherData.forecastDate ?? null,
        summary: weatherData.summary ?? null,
        tempHighF: weatherData.tempHighF ?? null,
        tempLowF: weatherData.tempLowF ?? null,
        precipChancePct: weatherData.precipChancePct ?? null,
      }
    : null;

  // (4) Natural hazard profile — FEMA National Risk Index. Meaningful only
  // when at least one well-formed top risk survives the defensive filter
  // (max 3 per contract; malformed entries are dropped, not rendered blank).
  const hazardsSection = data.hazards;
  let hazards: HomeDossierView["hazards"] = null;
  if (hazardsSection?.status === "ok" && Array.isArray(hazardsSection.topRisks)) {
    const topRisks = hazardsSection.topRisks
      .filter(
        (r): r is DossierHazardRisk =>
          !!r &&
          typeof r.hazard === "string" &&
          !!r.hazard.trim() &&
          typeof r.rating === "string" &&
          !!r.rating.trim(),
      )
      .slice(0, 3)
      .map((r) => ({ hazard: r.hazard.trim(), rating: r.rating.trim() }));
    if (topRisks.length > 0) {
      hazards = {
        topRisks,
        overallRating:
          typeof hazardsSection.overallRating === "string" && hazardsSection.overallRating.trim()
            ? hazardsSection.overallRating.trim()
            : null,
      };
    }
  }

  // (5) EPA radon zone by county — only the three defined zones render.
  const radonZone = data.radon?.status === "ok" ? data.radon.zone : null;
  const radon = radonZone === 1 || radonZone === 2 || radonZone === 3 ? { zone: radonZone } : null;

  // (6) Drinking water — needs BOTH the system name and a violation count
  // (zero is meaningful: it renders the reassuring copy).
  const waterSection = data.water;
  const water =
    waterSection?.status === "ok" &&
    typeof waterSection.systemName === "string" &&
    waterSection.systemName.trim() &&
    typeof waterSection.violations5y === "number" &&
    Number.isFinite(waterSection.violations5y) &&
    waterSection.violations5y >= 0
      ? { systemName: waterSection.systemName.trim(), violations5y: Math.round(waterSection.violations5y) }
      : null;

  // (7) Air quality now — AQI is the headline datum; category is optional.
  const airSection = data.air;
  const airAqi =
    typeof airSection?.aqi === "number" && Number.isFinite(airSection.aqi)
      ? Math.round(airSection.aqi)
      : null;
  const airCategory =
    typeof airSection?.category === "string" && airSection.category.trim()
      ? airSection.category.trim()
      : null;
  const air =
    airSection?.status === "ok" && (airAqi !== null || airCategory)
      ? {
          aqi: airAqi,
          category: airCategory,
        }
      : null;

  // (8) HUD housing context - area-level FMR / income limits.
  const housing = deriveHousing(data.housing);

  // (9) NLR/AFDC public EV charging around the destination.
  const evCharging = deriveEvCharging(data.evCharging);

  // (10) Neighborhood (Pro) is already derived above the whole-card-hide check.

  // Honest hint when a section couldn't run for lack of a precise location
  // (e.g. primary address without lat/lng while weather is merely "too_far").
  const showLocationHint = statuses.some((s) => s === "no_location");

  const visible = Boolean(
    flood || school || weather || hazards || radon || water || air || housing || evCharging || neighborhood || showLocationHint,
  );
  if (!visible) return HIDDEN_VIEW;

  return { visible, preview, flood, school, weather, hazards, radon, water, air, housing, evCharging, neighborhood, showLocationHint };
}

/** Positive whole-dollar/whole-number figure; null for absent/invalid/≤0. */
function posInt(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** Integer 0–100 percent; null for absent/invalid (0 is meaningful, kept). */
function clampPctValue(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** EPA walkability index (1–20) rounded to one decimal; null when absent/≤0. */
function clampWalkScore(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(20, Math.round(value * 10) / 10);
}

/** Narrow an API band string to a known WalkBand; null otherwise (no label). */
export function normalizeWalkBand(raw: string | null | undefined): WalkBand | null {
  return raw === "least" || raw === "below_average" || raw === "above_average" || raw === "most" ? raw : null;
}

/** Plain-English label key for a walkability band. */
export function walkBandLabelKey(
  band: WalkBand,
): "dossier_neighborhood_walk_least" | "dossier_neighborhood_walk_below" | "dossier_neighborhood_walk_above" | "dossier_neighborhood_walk_most" {
  if (band === "least") return "dossier_neighborhood_walk_least";
  if (band === "below_average") return "dossier_neighborhood_walk_below";
  if (band === "above_average") return "dossier_neighborhood_walk_above";
  return "dossier_neighborhood_walk_most";
}

/**
 * Neighborhood derivation (exported for tests). `upgrade_required` is the
 * per-section Pro gate → locked teaser. "ok" renders stats only when at least
 * one ACS figure or a named school survives; otherwise the row hides (never an
 * empty shell). Schools are sanitized to a named list, capped at 3.
 */
export function deriveNeighborhood(
  section: HomeDossierResponse["neighborhood"],
): HomeDossierView["neighborhood"] {
  if (!section) return null;
  if (section.status === "upgrade_required") return { locked: true };
  if (section.status !== "ok") return null;

  const medianHomeValue = posInt(section.medianHomeValue);
  const medianGrossRent = posInt(section.medianGrossRent);
  const medianHouseholdIncome = posInt(section.medianHouseholdIncome);
  const ownerOccupiedPct = clampPctValue(section.ownerOccupiedPct);
  const walkScore = clampWalkScore(section.walkScore);
  const walkBand = normalizeWalkBand(section.walkBand);
  const schools = (Array.isArray(section.schools) ? section.schools : [])
    .filter((s): s is DossierSchool => !!s && typeof s.name === "string" && !!s.name.trim())
    .slice(0, 3)
    .map((s) => ({
      name: s.name.trim(),
      level: typeof s.level === "string" && s.level.trim() ? s.level.trim() : null,
    }));

  const hasFigure =
    medianHomeValue !== null ||
    medianGrossRent !== null ||
    medianHouseholdIncome !== null ||
    ownerOccupiedPct !== null ||
    walkScore !== null ||
    schools.length > 0;
  if (!hasFigure) return null;

  return {
    locked: false,
    medianHomeValue,
    medianGrossRent,
    medianHouseholdIncome,
    ownerOccupiedPct,
    walkScore,
    walkBand,
    schools,
  };
}

export function deriveHousing(
  section: HomeDossierResponse["housing"],
): HomeDossierView["housing"] {
  if (!section || section.status !== "ok") return null;
  const twoBedroomFmr = posInt(section.fairMarketRent?.twoBedroom);
  const medianIncome = posInt(section.incomeLimits?.medianIncome);
  const lowIncome4Person = posInt(section.incomeLimits?.lowIncome4Person);
  const areaName =
    typeof section.areaName === "string" && section.areaName.trim()
      ? section.areaName.trim()
      : typeof section.metroName === "string" && section.metroName.trim()
        ? section.metroName.trim()
        : null;
  const countyName =
    typeof section.countyName === "string" && section.countyName.trim()
      ? section.countyName.trim()
      : null;
  const zip =
    typeof section.zip === "string" && section.zip.trim()
      ? section.zip.trim()
      : null;

  if (!twoBedroomFmr && !medianIncome && !lowIncome4Person && !areaName && !countyName) return null;

  return {
    areaName,
    countyName,
    zip,
    twoBedroomFmr,
    fmrYear: posInt(section.fairMarketRent?.year),
    medianIncome,
    lowIncome4Person,
    incomeYear: posInt(section.incomeLimits?.year),
  };
}

export function deriveEvCharging(
  section: HomeDossierResponse["evCharging"],
): HomeDossierView["evCharging"] {
  if (!section || section.status !== "ok") return null;
  const radiusMiles =
    typeof section.radiusMiles === "number" && Number.isFinite(section.radiusMiles) && section.radiusMiles > 0
      ? Math.round(section.radiusMiles)
      : 10;
  const stationCount =
    typeof section.stationCount === "number" && Number.isFinite(section.stationCount) && section.stationCount >= 0
      ? Math.round(section.stationCount)
      : 0;
  const nearestDistanceMiles =
    typeof section.nearestDistanceMiles === "number" && Number.isFinite(section.nearestDistanceMiles) && section.nearestDistanceMiles >= 0
      ? Math.round(section.nearestDistanceMiles * 10) / 10
      : null;
  const dcFastPortCount =
    typeof section.dcFastPortCount === "number" && Number.isFinite(section.dcFastPortCount) && section.dcFastPortCount >= 0
      ? Math.round(section.dcFastPortCount)
      : 0;
  const level2PortCount =
    typeof section.level2PortCount === "number" && Number.isFinite(section.level2PortCount) && section.level2PortCount >= 0
      ? Math.round(section.level2PortCount)
      : 0;

  return { radiusMiles, stationCount, nearestDistanceMiles, dcFastPortCount, level2PortCount };
}

/** Plain-English flood label key for a zone, driven by the API's isHighRisk. */
export function floodLabelKey(
  isHighRisk: boolean | null,
): "dossier_flood_high" | "dossier_flood_low" | "dossier_flood_unknown" {
  if (isHighRisk === true) return "dossier_flood_high";
  if (isHighRisk === false) return "dossier_flood_low";
  return "dossier_flood_unknown";
}

/**
 * Honey warn tone is reserved for the two highest NRI ratings — everything
 * below stays a neutral, informational pill (honest, never alarming).
 */
const HAZARD_WARN_RATINGS = new Set(["relatively high", "very high"]);
export function isHazardWarnRating(rating: string): boolean {
  return HAZARD_WARN_RATINGS.has(rating.trim().toLowerCase());
}

/** Plain-English EPA radon-zone label key (1 = highest potential … 3 = low). */
export function radonZoneLabelKey(
  zone: 1 | 2 | 3,
): "dossier_radon_zone1" | "dossier_radon_zone2" | "dossier_radon_zone3" {
  if (zone === 1) return "dossier_radon_zone1";
  if (zone === 2) return "dossier_radon_zone2";
  return "dossier_radon_zone3";
}

/** Water headline key — zero violations gets the reassuring copy. */
export function waterLabelKey(
  violations5y: number,
): "dossier_water_clean" | "dossier_water_violationsOne" | "dossier_water_violationsMany" {
  if (violations5y <= 0) return "dossier_water_clean";
  return violations5y === 1 ? "dossier_water_violationsOne" : "dossier_water_violationsMany";
}

/**
 * Format the forecast date for display. Date-only ISO strings ("YYYY-MM-DD")
 * are parsed as LOCAL dates (naive `new Date("YYYY-MM-DD")` is UTC midnight
 * and renders the previous day in US timezones). Invalid input → "".
 */
export function formatForecastDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(date);
  } catch {
    return "";
  }
}

/**
 * Whole-dollar USD label for a neighborhood median (no cents). US-only product,
 * so the currency is always USD; the locale only drives grouping/symbol
 * placement. Falls back to a "$" + grouped integer if Intl currency is
 * unavailable. null input → "" so the caller omits the figure.
 */
export function formatUsd(value: number | null, locale: string): string {
  if (value === null || !Number.isFinite(value)) return "";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
}

// ── Presentational card (exported for tests — render-pure, no fetching) ──────

export function HomeDossierCard({ data }: { data: HomeDossierResponse | null }) {
  const td = useTranslations("dashboard");
  const locale = useLocale();
  const view = deriveDossierView(data);
  const [dossierFull, setDossierFull] = useState(false);
  const [dossierDeckIndex, setDossierDeckIndex] = useState(0);

  // Neighborhood medians count up (~800ms ease-out) when the row first enters
  // the viewport. The hook's first render returns the FINAL figures, so SSR
  // markup, no-JS, and reduced-motion all read the honest values immediately.
  // Called unconditionally (rules of hooks) — null targets are a no-op.
  const nhoodStats = view.neighborhood?.locked === false ? view.neighborhood : null;
  const nhoodCount = useDossierCountUp([
    nhoodStats?.medianHomeValue ?? null,
    nhoodStats?.medianGrossRent ?? null,
    nhoodStats?.medianHouseholdIncome ?? null,
    nhoodStats?.ownerOccupiedPct ?? null,
  ]);

  // Plan-gated (entitled:false on a configured deployment) → value-first teaser
  // with the three insight rows shown as locked line-items. Checked BEFORE the
  // data-driven view so a gated payload never renders real-looking rows.
  if (isDossierGated(data)) {
    return <HomeDossierTeaser place={[data?.address?.city, data?.address?.state].filter(Boolean).join(", ")} />;
  }

  if (!view.visible || !data) return null;

  const place = [data.address?.city, data.address?.state].filter(Boolean).join(", ");

  const weatherStats: string[] = [];
  if (view.weather) {
    if (typeof view.weather.tempHighF === "number") {
      weatherStats.push(td("dossier_weather_highF", { temp: Math.round(view.weather.tempHighF) }));
    }
    if (typeof view.weather.tempLowF === "number") {
      weatherStats.push(td("dossier_weather_lowF", { temp: Math.round(view.weather.tempLowF) }));
    }
    if (typeof view.weather.precipChancePct === "number") {
      weatherStats.push(td("dossier_weather_precip", { percent: Math.round(view.weather.precipChancePct) }));
    }
  }
  const forecastDateLabel = view.weather ? formatForecastDate(view.weather.forecastDate, locale) : "";
  const sceneCards: DossierSceneDeckCard[] = [];

  if (view.flood) {
    sceneCards.push({
      key: "flood",
      label: td("dossier_flood_title"),
      value: td(floodLabelKey(view.flood.isHighRisk), { zone: view.flood.zone }),
      sub: view.flood.isHighRisk === true ? td("dossier_flood_highPill") : td("dossier_flood_disclaimer"),
      ambient: ambientForSection({ kind: "flood", isHighRisk: view.flood.isHighRisk }),
    });
  }
  if (view.school) {
    sceneCards.push({
      key: "school",
      label: td("dossier_school_title"),
      value: td("dossier_school_served", { district: view.school.districtName }),
      sub: td("dossier_school_disclaimer"),
      ambient: ambientForSection({ kind: "school" }),
    });
  }
  if (view.weather) {
    sceneCards.push({
      key: "weather",
      label: forecastDateLabel
        ? td("dossier_weather_movingDay", { date: forecastDateLabel })
        : td("dossier_weather_title"),
      value: [view.weather.summary, weatherStats.join(" · ")].filter(Boolean).join(" — "),
      sub: td("dossier_weather_disclaimer"),
      ambient: ambientForSection({
        kind: "weather",
        summary: view.weather.summary,
        precipChancePct: view.weather.precipChancePct,
        tempHighF: view.weather.tempHighF,
        tempLowF: view.weather.tempLowF,
      }),
    });
  }
  if (view.hazards) {
    sceneCards.push({
      key: "hazards",
      label: td("dossier_hazards_title"),
      value: view.hazards.overallRating
        ? td("dossier_hazards_overall", { rating: view.hazards.overallRating })
        : `${view.hazards.topRisks[0]?.hazard ?? ""} · ${view.hazards.topRisks[0]?.rating ?? ""}`.trim(),
      sub: view.hazards.topRisks.map((risk) => `${risk.hazard} · ${risk.rating}`).join(" / "),
      ambient: ambientForSection({ kind: "hazard", topRisks: view.hazards.topRisks }),
    });
  }
  if (view.radon) {
    sceneCards.push({
      key: "radon",
      label: td("dossier_radon_title"),
      value: td(radonZoneLabelKey(view.radon.zone)),
      sub: td("dossier_radon_disclaimer"),
      ambient: ambientForSection({ kind: "radon", zone: view.radon.zone }),
    });
  }
  if (view.water) {
    sceneCards.push({
      key: "water",
      label: td("dossier_water_title"),
      value: td(waterLabelKey(view.water.violations5y), {
        system: view.water.systemName,
        count: view.water.violations5y,
      }),
      sub: td("dossier_water_disclaimer"),
      ambient: ambientForSection({ kind: "water", violations5y: view.water.violations5y }),
    });
  }
  if (view.air) {
    sceneCards.push({
      key: "air",
      label: td("dossier_air_title"),
      value:
        view.air.aqi !== null && view.air.category
          ? td("dossier_air_now", { aqi: view.air.aqi, category: view.air.category })
          : view.air.aqi !== null
            ? td("dossier_air_nowNoCategory", { aqi: view.air.aqi })
            : td("dossier_air_categoryOnly", { category: view.air.category ?? "" }),
      sub: td("dossier_air_disclaimer"),
      ambient: ambientForSection({ kind: "air", aqi: view.air.aqi, category: view.air.category }),
    });
  }
  if (view.housing) {
    sceneCards.push({
      key: "housing",
      label: td("dossier_housing_title"),
      value:
        view.housing.twoBedroomFmr !== null
          ? td("dossier_housing_fmr", { amount: formatUsd(view.housing.twoBedroomFmr, locale) })
          : view.housing.medianIncome !== null
            ? td("dossier_housing_income", { amount: formatUsd(view.housing.medianIncome, locale) })
            : view.housing.areaName || view.housing.countyName || td("dossier_housing_area_fallback"),
      sub: view.housing.areaName ? td("dossier_housing_area", { area: view.housing.areaName }) : td("dossier_housing_disclaimer"),
      ambient: ambientForSection({
        kind: "housing",
        twoBedroomFmr: view.housing.twoBedroomFmr,
        medianIncome: view.housing.medianIncome,
        lowIncome4Person: view.housing.lowIncome4Person,
      }),
    });
  }
  if (view.evCharging) {
    sceneCards.push({
      key: "ev-charging",
      label: td("dossier_ev_title"),
      value: td("dossier_ev_summary", {
        count: view.evCharging.stationCount,
        radius: view.evCharging.radiusMiles,
      }),
      sub: td("dossier_ev_ports", {
        level2: view.evCharging.level2PortCount,
        dcFast: view.evCharging.dcFastPortCount,
      }),
      ambient: ambientForSection({
        kind: "evCharging",
        stationCount: view.evCharging.stationCount,
        dcFastPortCount: view.evCharging.dcFastPortCount,
        level2PortCount: view.evCharging.level2PortCount,
      }),
    });
  }
  if (view.neighborhood?.locked === false) {
    sceneCards.push({
      key: "neighborhood",
      label: td("dossier_neighborhood_title"),
      value:
        view.neighborhood.walkScore !== null
          ? view.neighborhood.walkBand
            ? td("dossier_neighborhood_walkValue", {
                score: view.neighborhood.walkScore,
                label: td(walkBandLabelKey(view.neighborhood.walkBand)),
              })
            : td("dossier_neighborhood_walkScoreOnly", { score: view.neighborhood.walkScore })
          : td("dossier_neighborhood_subtitle"),
      sub:
        view.neighborhood.schools.length > 0
          ? view.neighborhood.schools.map((school) => school.name).join(" / ")
          : td("dossier_neighborhood_disclaimer"),
      ambient: ambientForSection({ kind: "neighborhood", walkBand: view.neighborhood.walkBand }),
    });
  }
  sceneCards.sort(
    (a, b) =>
      dossierDeckPriority(b.ambient.intensity) - dossierDeckPriority(a.ambient.intensity) ||
      a.label.localeCompare(b.label, locale),
  );
  const showDetailsGrid = dossierFull || sceneCards.length === 0;

  return (
    <div className={DOSSIER_SHELL_CLASS}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="h-4 w-4 shrink-0 text-tone-sky-fg" />
          {/* Aurora serif heading — display face with ONE italic <em> accent,
              consistent with the sibling editorial headings (.h2 helper). */}
          <h3 className="h2 text-xl text-foreground truncate">
            {td.rich("dossier_title", { em: (chunks) => <em>{chunks}</em> })}
          </h3>
          {view.preview && (
            <span className="inline-flex shrink-0 rounded-full border border-tone-orange-br bg-tone-orange-bg px-2 py-0.5 text-[10px] font-semibold text-tone-orange-fg">
              {td("dossier_preview_pill")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {place && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {place}
            </span>
          )}
          {/* Pro PDF export — only rendered when the payload says the user
              is entitled to dossierPdf, so the link never lands on the teaser.
              A plain GET link to the route triggers the attachment download. */}
          {data.dossierPdf === true && data.address?.id && (
            <a
              href={`/api/addresses/${encodeURIComponent(data.address.id)}/dossier/pdf`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-foreground/[0.04] text-[11px] font-semibold text-foreground hover:bg-foreground/[0.08] transition"
              aria-label={td("dossier_pdf_ariaLabel")}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {td("dossier_pdf_button")}
            </a>
          )}
        </div>
      </div>

      {sceneCards.length > 0 && (
        <>
          <div className="lf-dossier-source-toolbar px-5 pb-2">
            <button
              type="button"
              className="lf-dossier-source-toggle"
              onClick={() => setDossierFull((value) => !value)}
              aria-pressed={dossierFull}
            >
              {td(dossierFull ? "dossier_deck_swipeView" : "dossier_deck_viewFull")}
            </button>
          </div>
          <div
            className="lf-dossier-source-deck px-5 pb-4"
            data-expanded={dossierFull ? "true" : "false"}
            onScroll={(event) => {
              if (dossierFull) return;
              const el = event.currentTarget;
              const card = el.querySelector<HTMLElement>(".lf-dossier-source-card");
              if (!card) return;
              const step = card.offsetWidth + 12;
              const next = Math.max(0, Math.min(sceneCards.length - 1, Math.round(el.scrollLeft / step)));
              if (next !== dossierDeckIndex) setDossierDeckIndex(next);
            }}
          >
            {sceneCards.map((card) => {
              const activeBars = activeDossierDeckBars(card.ambient.intensity);
              const bandKey = dossierDeckBandKey(card.ambient.intensity);
              const sourceScene = sourceDossierSceneFor(card.ambient);
              const sceneVars = sourceSceneVars(sourceScene);
              return (
                <article
                  key={card.key}
                  className="lf-dossier-source-card"
                  data-dossier-scene={card.key}
                  style={sceneVars}
                >
                  <div className="lf-dossier-source-stage">
                    <DossierAmbient {...card.ambient} />
                    <span className="lf-dossier-source-tag">{sourceSceneTag(sourceScene)}</span>
                  </div>
                  <div className="lf-dossier-source-body">
                    <p className="lf-dossier-source-label">{card.label}</p>
                    <p className="lf-dossier-source-value">{card.value}</p>
                    <p className="lf-dossier-source-sub">{card.sub}</p>
                    <div className="lf-dossier-source-meter">
                      <div className="lf-dossier-source-bars">
                        {Array.from({ length: DOSSIER_SOURCE_BAR_COUNT }).map((_, index) => (
                          <span key={index} className={index < activeBars ? "is-active" : undefined} />
                        ))}
                      </div>
                      <span className="lf-dossier-source-band">{td(bandKey)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!dossierFull && sceneCards.length > 1 && (
            <div className="lf-dossier-source-dots" aria-hidden="true">
              {sceneCards.map((card, index) => (
                <span
                  key={card.key}
                  data-active={index === dossierDeckIndex ? "true" : "false"}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="lf-dossier-grid px-5 pb-5" hidden={!showDetailsGrid}>
        {/* (1) Flood zone — FEMA. Each rendered row carries a DossierAmbient
            scene layer (aria-hidden, masked, under the content) whose
            parameters derive from the row's REAL data. */}
        {view.flood && (
          <div className={DOSSIER_SCENE_ROW_CLASS}>
            <DossierAmbient {...ambientForSection({ kind: "flood", isHighRisk: view.flood.isHighRisk })} />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-sky-bg border border-tone-sky-br flex items-center justify-center shrink-0">
                <Waves className="h-4 w-4 text-tone-sky-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_flood_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {td(floodLabelKey(view.flood.isHighRisk), { zone: view.flood.zone })}
                </p>
              </div>
              {view.flood.isHighRisk === true && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tone-honey-bg border border-tone-honey-br text-tone-honey-fg shrink-0">
                  {td("dossier_flood_highPill")}
                </span>
              )}
            </div>
            {/* MANDATORY fine print — informational, not an insurance determination */}
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              {td("dossier_flood_disclaimer")}{" "}
              <a
                href="https://msc.fema.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition"
              >
                {td("dossier_flood_link")}
              </a>
            </p>
          </div>
        )}

        {/* (2) School district — NCES boundaries */}
        {view.school && (
          <div className={DOSSIER_SCENE_ROW_CLASS}>
            <DossierAmbient {...ambientForSection({ kind: "school" })} />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-sage-bg border border-tone-sage-br flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 text-tone-sage-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_school_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {td("dossier_school_served", { district: view.school.districtName })}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{td("dossier_school_disclaimer")}</p>
          </div>
        )}

        {/* (3) Moving-day weather — only when the API says "ok" (≤7 days out,
            destination address). "too_far" renders nothing by design. */}
        {view.weather && (
          <div className={DOSSIER_SCENE_ROW_CLASS}>
            <DossierAmbient
              {...ambientForSection({
                kind: "weather",
                summary: view.weather.summary,
                precipChancePct: view.weather.precipChancePct,
                tempHighF: view.weather.tempHighF,
                tempLowF: view.weather.tempLowF,
              })}
            />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-cyan-bg border border-tone-cyan-br flex items-center justify-center shrink-0">
                <CloudSun className="h-4 w-4 text-tone-cyan-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {forecastDateLabel
                    ? td("dossier_weather_movingDay", { date: forecastDateLabel })
                    : td("dossier_weather_title")}
                </p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {[view.weather.summary, weatherStats.join(" · ")].filter(Boolean).join(" — ")}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{td("dossier_weather_disclaimer")}</p>
          </div>
        )}

        {/* (4) Natural hazard profile — FEMA National Risk Index. Per-risk
            pills; honey warn tone ONLY for "Relatively High"/"Very High". */}
        {view.hazards && (
          <div className={DOSSIER_SCENE_ROW_CLASS}>
            <DossierAmbient {...ambientForSection({ kind: "hazard", topRisks: view.hazards.topRisks })} />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-umber-bg border border-tone-umber-br flex items-center justify-center shrink-0">
                <Mountain className="h-4 w-4 text-tone-umber-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_hazards_title")}</p>
                {view.hazards.overallRating && (
                  <p className="text-sm font-semibold text-foreground truncate">
                    {td("dossier_hazards_overall", { rating: view.hazards.overallRating })}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {view.hazards.topRisks.map((risk) => (
                    <span
                      key={`${risk.hazard}-${risk.rating}`}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isHazardWarnRating(risk.rating)
                          ? "bg-tone-honey-bg border-tone-honey-br text-tone-honey-fg"
                          : "bg-foreground/[0.04] border-border text-muted-foreground"
                      }`}
                    >
                      {risk.hazard} · {risk.rating}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {/* MANDATORY fine print — relative context, not a property score */}
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{td("dossier_hazards_disclaimer")}</p>
          </div>
        )}

        {/* (5) EPA radon zone — MANDATORY "test regardless of zone" fine print */}
        {view.radon && (
          <div className={DOSSIER_SCENE_ROW_CLASS}>
            <DossierAmbient {...ambientForSection({ kind: "radon", zone: view.radon.zone })} />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-slate-bg border border-tone-slate-br flex items-center justify-center shrink-0">
                <FlaskConical className="h-4 w-4 text-tone-slate-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_radon_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {td(radonZoneLabelKey(view.radon.zone))}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{td("dossier_radon_disclaimer")}</p>
          </div>
        )}

        {/* (6) Drinking water — EPA SDWIS; zero violations reads reassuring */}
        {view.water && (
          <div className={DOSSIER_SCENE_ROW_CLASS}>
            <DossierAmbient {...ambientForSection({ kind: "water", violations5y: view.water.violations5y })} />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-sky-bg border border-tone-sky-br flex items-center justify-center shrink-0">
                <Droplets className="h-4 w-4 text-tone-sky-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_water_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {td(waterLabelKey(view.water.violations5y), {
                    system: view.water.systemName,
                    count: view.water.violations5y,
                  })}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              {td("dossier_water_disclaimer")}{" "}
              <a
                href="https://enviro.epa.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition"
              >
                {td("dossier_water_link")}
              </a>
            </p>
          </div>
        )}

        {/* (7) Air quality now — AirNow snapshot; hidden when not_configured */}
        {view.air && (
          <div className={DOSSIER_SCENE_ROW_CLASS}>
            <DossierAmbient {...ambientForSection({ kind: "air", aqi: view.air.aqi, category: view.air.category })} />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-sage-bg border border-tone-sage-br flex items-center justify-center shrink-0">
                <Wind className="h-4 w-4 text-tone-sage-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_air_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {view.air.aqi !== null && view.air.category
                    ? td("dossier_air_now", { aqi: view.air.aqi, category: view.air.category })
                    : view.air.aqi !== null
                      ? td("dossier_air_nowNoCategory", { aqi: view.air.aqi })
                      : td("dossier_air_categoryOnly", { category: view.air.category ?? "" })}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{td("dossier_air_disclaimer")}</p>
          </div>
        )}

        {/* (8) Housing affordability context - HUD User FMR / Income Limits. */}
        {view.housing && (
          <div className={DOSSIER_SCENE_ROW_CLASS}>
            <DossierAmbient
              {...ambientForSection({
                kind: "housing",
                twoBedroomFmr: view.housing.twoBedroomFmr,
                medianIncome: view.housing.medianIncome,
                lowIncome4Person: view.housing.lowIncome4Person,
              })}
            />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-honey-bg border border-tone-honey-br flex items-center justify-center shrink-0">
                <Home className="h-4 w-4 text-tone-honey-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_housing_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {view.housing.twoBedroomFmr !== null
                    ? td("dossier_housing_fmr", { amount: formatUsd(view.housing.twoBedroomFmr, locale) })
                    : view.housing.medianIncome !== null
                      ? td("dossier_housing_income", { amount: formatUsd(view.housing.medianIncome, locale) })
                      : view.housing.areaName || view.housing.countyName || td("dossier_housing_area_fallback")}
                </p>
              </div>
              {view.housing.zip && (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0">
                  {view.housing.zip}
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {view.housing.medianIncome !== null && (
                <div className={DOSSIER_STAT_CLASS}>
                  <p className="text-[10px] text-muted-foreground">{td("dossier_housing_ami")}</p>
                  <p className="text-xs font-semibold text-foreground">
                    {formatUsd(view.housing.medianIncome, locale)}
                  </p>
                </div>
              )}
              {view.housing.lowIncome4Person !== null && (
                <div className={DOSSIER_STAT_CLASS}>
                  <p className="text-[10px] text-muted-foreground">{td("dossier_housing_lowIncome")}</p>
                  <p className="text-xs font-semibold text-foreground">
                    {formatUsd(view.housing.lowIncome4Person, locale)}
                  </p>
                </div>
              )}
            </div>

            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              {td("dossier_housing_disclaimer")}
              {view.housing.areaName ? ` ${td("dossier_housing_area", { area: view.housing.areaName })}` : ""}
            </p>
          </div>
        )}

        {/* (9) EV charging - NLR/AFDC public active stations near destination. */}
        {view.evCharging && (
          <div className={DOSSIER_SCENE_ROW_CLASS}>
            <DossierAmbient
              {...ambientForSection({
                kind: "evCharging",
                stationCount: view.evCharging.stationCount,
                dcFastPortCount: view.evCharging.dcFastPortCount,
                level2PortCount: view.evCharging.level2PortCount,
              })}
            />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-sky-bg border border-tone-sky-br flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-tone-sky-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_ev_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {td("dossier_ev_summary", {
                    count: view.evCharging.stationCount,
                    radius: view.evCharging.radiusMiles,
                  })}
                </p>
              </div>
              {view.evCharging.nearestDistanceMiles !== null && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tone-sky-bg border border-tone-sky-br text-tone-sky-fg shrink-0">
                  {td("dossier_ev_nearest", { distance: view.evCharging.nearestDistanceMiles })}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {td("dossier_ev_ports", {
                level2: view.evCharging.level2PortCount,
                dcFast: view.evCharging.dcFastPortCount,
              })}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{td("dossier_ev_disclaimer")}</p>
          </div>
        )}

        {/* (10) Neighborhood — Pro-only area medians (Census/ACS). Either the
            locked Pro teaser (entitled to the dossier but not to Pro) or the
            real area-median stat rows. The fine print is the honest core: these
            are tract medians, NOT a valuation of this specific home. */}
        {view.neighborhood?.locked === true && (
          <div className={DOSSIER_ROW_CLASS}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-honey-bg border border-tone-honey-br flex items-center justify-center shrink-0">
                <Home className="h-4 w-4 text-tone-honey-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_neighborhood_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {td("dossier_neighborhood_teaser_sub")}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tone-honey-bg border border-tone-honey-br text-tone-honey-fg shrink-0">
                <Check className="h-3 w-3" aria-hidden="true" />
                {td("dossier_neighborhood_proPill")}
              </span>
            </div>
            <Link
              href="/addresses"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-tone-orange-fg hover:opacity-90 transition"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {td("dossier_neighborhood_proCta")}
            </Link>
          </div>
        )}

        {view.neighborhood?.locked === false && (
          <div
            ref={nhoodCount.ref}
            className={DOSSIER_SCENE_ROW_CLASS}
          >
            <DossierAmbient
              {...ambientForSection({ kind: "neighborhood", walkBand: view.neighborhood.walkBand })}
            />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-honey-bg border border-tone-honey-br flex items-center justify-center shrink-0">
                <Home className="h-4 w-4 text-tone-honey-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_neighborhood_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {td("dossier_neighborhood_subtitle")}
                </p>
              </div>
            </div>

            {/* Stat rows — each renders only when its figure survived derivation.
                Displayed figures come from the count-up hook (final values on
                first render; brief 0 → target count once the row is visible). */}
            <div className="mt-2 space-y-1.5">
              {view.neighborhood.medianHomeValue !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{td("dossier_neighborhood_homeValue")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatUsd(nhoodCount.values[0] ?? view.neighborhood.medianHomeValue, locale)}
                  </span>
                </div>
              )}
              {view.neighborhood.medianGrossRent !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{td("dossier_neighborhood_grossRent")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {td("dossier_neighborhood_rentPerMonth", {
                      amount: formatUsd(nhoodCount.values[1] ?? view.neighborhood.medianGrossRent, locale),
                    })}
                  </span>
                </div>
              )}
              {view.neighborhood.medianHouseholdIncome !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{td("dossier_neighborhood_income")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatUsd(nhoodCount.values[2] ?? view.neighborhood.medianHouseholdIncome, locale)}
                  </span>
                </div>
              )}
              {view.neighborhood.ownerOccupiedPct !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{td("dossier_neighborhood_ownerOccupied")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {td("dossier_neighborhood_percent", {
                      percent: nhoodCount.values[3] ?? view.neighborhood.ownerOccupiedPct,
                    })}
                  </span>
                </div>
              )}
              {view.neighborhood.walkScore !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{td("dossier_neighborhood_walkability")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {view.neighborhood.walkBand
                      ? td("dossier_neighborhood_walkValue", {
                          score: view.neighborhood.walkScore,
                          label: td(walkBandLabelKey(view.neighborhood.walkBand)),
                        })
                      : td("dossier_neighborhood_walkScoreOnly", { score: view.neighborhood.walkScore })}
                  </span>
                </div>
              )}
            </div>

            {/* Optional nearby-schools list (NCES) — names + optional rating. */}
            {view.neighborhood.schools.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">{td("dossier_neighborhood_schools")}</p>
                <ul className="mt-1 space-y-0.5">
                  {view.neighborhood.schools.map((school) => (
                    <li
                      key={school.name}
                      className="flex items-baseline justify-between gap-3 text-sm text-foreground"
                    >
                      <span className="truncate">{school.name}</span>
                      {school.level && (
                        <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                          {school.level}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* MANDATORY caveat — area medians, never a valuation of this home. */}
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              {td("dossier_neighborhood_disclaimer")}
            </p>
          </div>
        )}

        {/* Honest hint when a precise location is missing — no fabricated rows */}
        {view.preview && (
          <div className="p-3 rounded-xl border border-tone-orange-br bg-tone-orange-bg/35">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-background/40 border border-tone-orange-br flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-tone-orange-fg" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{td("dossier_preview_unlock_title")}</p>
                <p className="mt-1 text-xs leading-5 text-tone-orange-fg/90">
                  {td("dossier_preview_unlock_body")}
                </p>
                <Link
                  href="/addresses"
                  className="mt-1 -mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold text-tone-orange-fg hover:opacity-90 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {td("dossier_preview_unlock_cta")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {view.showLocationHint && (
          <div className="lf-dossier-row flex items-center gap-3 p-3 rounded-xl border border-dashed border-border">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">{td("dossier_hint_noLocation")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan-gate teaser (exported for tests — render-pure, no fetching) ─────────

/**
 * Value-first included-feature teaser for stale GATE-API entitled:false
 * payloads. Same card chrome as the real dossier, with curated rows shown as
 * available insight line-items (check glyphs, no fabricated data) and a CTA
 * back into the address/dossier flow.
 */
const TEASER_ROWS = [
  {
    Icon: Waves,
    boxClass: "bg-tone-sky-bg border-tone-sky-br",
    iconClass: "text-tone-sky-fg",
    titleKey: "dossier_flood_title",
    subKey: "dossier_teaser_flood_sub",
  },
  {
    Icon: GraduationCap,
    boxClass: "bg-tone-sage-bg border-tone-sage-br",
    iconClass: "text-tone-sage-fg",
    titleKey: "dossier_school_title",
    subKey: "dossier_teaser_school_sub",
  },
  {
    Icon: CloudSun,
    boxClass: "bg-tone-cyan-bg border-tone-cyan-br",
    iconClass: "text-tone-cyan-fg",
    titleKey: "dossier_weather_title",
    subKey: "dossier_teaser_weather_sub",
  },
  {
    Icon: Mountain,
    boxClass: "bg-tone-umber-bg border-tone-umber-br",
    iconClass: "text-tone-umber-fg",
    titleKey: "dossier_hazards_title",
    subKey: "dossier_teaser_hazards_sub",
  },
  {
    Icon: FlaskConical,
    boxClass: "bg-tone-slate-bg border-tone-slate-br",
    iconClass: "text-tone-slate-fg",
    titleKey: "dossier_radon_title",
    subKey: "dossier_teaser_radon_sub",
  },
  {
    Icon: Droplets,
    boxClass: "bg-tone-sky-bg border-tone-sky-br",
    iconClass: "text-tone-sky-fg",
    titleKey: "dossier_water_title",
    subKey: "dossier_teaser_water_sub",
  },
  {
    Icon: Wind,
    boxClass: "bg-tone-sage-bg border-tone-sage-br",
    iconClass: "text-tone-sage-fg",
    titleKey: "dossier_air_title",
    subKey: "dossier_teaser_air_sub",
  },
  {
    Icon: Home,
    boxClass: "bg-tone-honey-bg border-tone-honey-br",
    iconClass: "text-tone-honey-fg",
    titleKey: "dossier_housing_title",
    subKey: "dossier_teaser_housing_sub",
  },
  {
    Icon: Zap,
    boxClass: "bg-tone-sky-bg border-tone-sky-br",
    iconClass: "text-tone-sky-fg",
    titleKey: "dossier_ev_title",
    subKey: "dossier_teaser_ev_sub",
  },
] as const;

export function HomeDossierTeaser({ place }: { place?: string }) {
  const td = useTranslations("dashboard");
  return (
    <div className={DOSSIER_SHELL_CLASS}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="h-4 w-4 shrink-0 text-tone-sky-fg" />
          <h3 className="h2 text-xl text-foreground truncate">
            {td.rich("dossier_title", { em: (chunks) => <em>{chunks}</em> })}
          </h3>
        </div>
        {place && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0">
            {place}
          </span>
        )}
      </div>

      <div className="px-5 pb-5 space-y-2">
        <p className="text-[13.5px] leading-5 text-muted-foreground">{td("dossier_teaser_pitch")}</p>

        {/* Show the 4 highest-signal rows as a curated tease rather than a wall
            of 9 near-identical locks; the CTA conveys that the full report has more. */}
        {TEASER_ROWS.slice(0, 4).map(({ Icon, boxClass, iconClass, titleKey, subKey }) => (
          <div
            key={titleKey}
            className="lf-dossier-row flex items-center gap-3 p-3 rounded-xl border border-border"
          >
            <div
              className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${boxClass}`}
            >
              <Icon className={`h-4 w-4 ${iconClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{td(titleKey)}</p>
              <p className="text-xs text-muted-foreground truncate">{td(subKey)}</p>
            </div>
            <Check className="h-4 w-4 text-tone-orange-fg shrink-0" aria-hidden="true" />
          </div>
        ))}

        <div className="pt-1">
          <Link
            href="/addresses"
            className="inline-flex items-center gap-2 px-4 py-3 min-h-11 rounded-xl bg-tone-orange-fg text-white text-sm font-semibold hover:opacity-90 transition whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4" /> {td("dossier_teaser_cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton (reduced-motion safe: pulse only when motion is allowed) ────────

function HomeDossierSkeleton() {
  return (
    <div className="lf-dossier-shell rounded-2xl border border-border backdrop-blur-xl p-5 space-y-3" aria-hidden="true">
      <div className="h-6 w-48 rounded-lg bg-foreground/5 motion-safe:animate-pulse" />
      <div className="h-16 w-full rounded-xl bg-foreground/5 motion-safe:animate-pulse" />
      <div className="h-16 w-full rounded-xl bg-foreground/5 motion-safe:animate-pulse" />
    </div>
  );
}

// ── Fetching wrapper (default dashboard entry) ───────────────────────────────

const DOSSIER_SESSION_CACHE_PREFIX = "lf:home-dossier:v1:";
const DOSSIER_SESSION_CACHE_FALLBACK_TTL_MS = 10 * 60 * 1000;

type DossierSessionCacheEntry = {
  expiresAt: number;
  data: HomeDossierResponse;
};

function dossierSessionCacheKey(addressId: string): string {
  return `${DOSSIER_SESSION_CACHE_PREFIX}${addressId}`;
}

function readDossierSessionCache(addressId: string): HomeDossierResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(dossierSessionCacheKey(addressId));
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<DossierSessionCacheEntry>;
    if (!entry || typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now() || !entry.data) {
      window.sessionStorage.removeItem(dossierSessionCacheKey(addressId));
      return null;
    }
    return entry.data as HomeDossierResponse;
  } catch {
    return null;
  }
}

function maxAgeFromCacheControl(cacheControl: string | null): number {
  const match = /(?:^|,\s*)max-age=(\d+)/i.exec(cacheControl ?? "");
  if (!match) return DOSSIER_SESSION_CACHE_FALLBACK_TTL_MS;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DOSSIER_SESSION_CACHE_FALLBACK_TTL_MS;
}

function writeDossierSessionCache(addressId: string, data: HomeDossierResponse, ttlMs: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      dossierSessionCacheKey(addressId),
      JSON.stringify({ expiresAt: Date.now() + ttlMs, data } satisfies DossierSessionCacheEntry),
    );
  } catch {
    // Browser privacy modes or storage pressure should never break the dashboard.
  }
}

export function HomeDossier({ addressId }: { addressId: string | null }) {
  const [state, setState] = useState<{ status: "loading" | "done"; data: HomeDossierResponse | null }>({
    status: "loading",
    data: null,
  });

  useEffect(() => {
    if (!addressId) {
      setState({ status: "done", data: null });
      return;
    }
    let cancelled = false;
    const cached = readDossierSessionCache(addressId);
    if (cached) {
      setState({ status: "done", data: cached });
      return () => {
        cancelled = true;
      };
    }
    setState({ status: "loading", data: null });
    (async () => {
      try {
        const res = await fetch(`/api/addresses/${encodeURIComponent(addressId)}/dossier`);
        if (!res.ok) {
          // 401/404/5xx → hide the card; external lookups never break the dashboard.
          if (!cancelled) setState({ status: "done", data: null });
          return;
        }
        const json = (await res.json()) as HomeDossierResponse;
        writeDossierSessionCache(addressId, json, maxAgeFromCacheControl(res.headers.get("Cache-Control")));
        if (!cancelled) setState({ status: "done", data: json });
      } catch {
        if (!cancelled) setState({ status: "done", data: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addressId]);

  if (!addressId) return null;
  if (state.status === "loading") return <HomeDossierSkeleton />;
  return <HomeDossierCard data={state.data} />;
}

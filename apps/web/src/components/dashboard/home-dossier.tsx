"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CloudSun,
  Compass,
  Download,
  Droplets,
  FlaskConical,
  GraduationCap,
  Home,
  Lock,
  MapPin,
  Mountain,
  Sparkles,
  Waves,
  Wind,
} from "lucide-react";

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
 *   6. Drinking-water system record (EPA SDWIS health-based violations, 5 yrs), and
 *   7. Current air quality (AirNow AQI snapshot; absent when not configured).
 *
 * GRACEFUL DEGRADATION (same contract style as apps/web/src/lib/fcc-isp.ts):
 * the card consumes GET /api/addresses/{id}/dossier, whose sections each carry
 * a status union. Anything non-"ok" simply hides that row; when EVERY section
 * is degraded (no_location/error) the whole card disappears — never an empty
 * shell. A location-less address with something still renderable (e.g. the
 * primary-address case where weather is merely "too_far") gets one honest
 * "add a precise address" hint row instead of fabricated rows. Fetch failures
 * never throw into the dashboard — they collapse to the hidden state.
 */

// ── Contract types (GET /api/addresses/{id}/dossier) ─────────────────────────

export type DossierSectionStatus = "ok" | "no_location" | "error";
export type DossierWeatherStatus = "ok" | "no_location" | "too_far" | "error";
export type DossierAirStatus = "ok" | "not_configured" | "no_location" | "error";
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
   * Pro-only PDF export entitlement (FEATURES.dossierPdf). When true the card
   * shows the "Export PDF" affordance wired to the dossier PDF route. Absent
   * on older payloads and on non-Pro tiers → the button stays hidden, so a
   * non-entitled user never sees a button that would only return the teaser.
   */
  dossierPdf?: boolean;
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
  air: { aqi: number; category: string | null } | null;
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
  flood: null,
  school: null,
  weather: null,
  hazards: null,
  radon: null,
  water: null,
  air: null,
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
const DEGRADED_STATUSES = new Set(["no_location", "error", "not_configured"]);

/**
 * Decide what (if anything) the card shows. Defensive against partial/missing
 * payloads: a malformed response degrades to the hidden state, an "ok" section
 * missing its headline datum (zone / districtName / any weather figure) is
 * skipped rather than rendered empty.
 */
export function deriveDossierView(data: HomeDossierResponse | null | undefined): HomeDossierView {
  if (!data || data.configured !== true || !data.address || !data.flood || !data.school || !data.weather) {
    return HIDDEN_VIEW;
  }

  const statuses: string[] = [data.flood.status, data.school.status, data.weather.status];
  // Extended sections are optional — older payloads simply don't vote.
  for (const status of [data.hazards?.status, data.radon?.status, data.water?.status, data.air?.status]) {
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

  const hasWeatherFigure =
    data.weather.status === "ok" &&
    (typeof data.weather.summary === "string" ||
      typeof data.weather.tempHighF === "number" ||
      typeof data.weather.tempLowF === "number" ||
      typeof data.weather.precipChancePct === "number");
  const weather = hasWeatherFigure
    ? {
        forecastDate: data.weather.forecastDate ?? null,
        summary: data.weather.summary ?? null,
        tempHighF: data.weather.tempHighF ?? null,
        tempLowF: data.weather.tempLowF ?? null,
        precipChancePct: data.weather.precipChancePct ?? null,
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
  const air =
    airSection?.status === "ok" && typeof airSection.aqi === "number" && Number.isFinite(airSection.aqi)
      ? {
          aqi: Math.round(airSection.aqi),
          category:
            typeof airSection.category === "string" && airSection.category.trim()
              ? airSection.category.trim()
              : null,
        }
      : null;

  // (8) Neighborhood (Pro) is already derived above the whole-card-hide check.

  // Honest hint when a section couldn't run for lack of a precise location
  // (e.g. primary address without lat/lng while weather is merely "too_far").
  const showLocationHint = statuses.some((s) => s === "no_location");

  const visible = Boolean(
    flood || school || weather || hazards || radon || water || air || neighborhood || showLocationHint,
  );
  if (!visible) return HIDDEN_VIEW;

  return { visible, flood, school, weather, hazards, radon, water, air, neighborhood, showLocationHint };
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

  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="h-4 w-4 shrink-0 text-tone-sky-fg" />
          {/* Aurora serif heading — display face with ONE italic <em> accent,
              consistent with the sibling editorial headings (.h2 helper). */}
          <h3 className="h2 text-xl text-foreground truncate">
            {td.rich("dossier_title", { em: (chunks) => <em>{chunks}</em> })}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {place && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {place}
            </span>
          )}
          {/* Pro-only PDF export — only rendered when the payload says the user
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

      <div className="px-5 pb-5 space-y-2">
        {/* (1) Flood zone — FEMA */}
        {view.flood && (
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
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
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
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
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
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
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
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
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
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
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
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
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-sage-bg border border-tone-sage-br flex items-center justify-center shrink-0">
                <Wind className="h-4 w-4 text-tone-sage-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_air_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {view.air.category
                    ? td("dossier_air_now", { aqi: view.air.aqi, category: view.air.category })
                    : td("dossier_air_nowNoCategory", { aqi: view.air.aqi })}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{td("dossier_air_disclaimer")}</p>
          </div>
        )}

        {/* (8) Neighborhood — Pro-only area medians (Census/ACS). Either the
            locked Pro teaser (entitled to the dossier but not to Pro) or the
            real area-median stat rows. The fine print is the honest core: these
            are tract medians, NOT a valuation of this specific home. */}
        {view.neighborhood?.locked === true && (
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
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
                <Lock className="h-3 w-3" aria-hidden="true" />
                {td("dossier_neighborhood_proPill")}
              </span>
            </div>
            <Link
              href="/pricing"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-tone-orange-fg hover:opacity-90 transition"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {td("dossier_neighborhood_proCta")}
            </Link>
          </div>
        )}

        {view.neighborhood?.locked === false && (
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
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

            {/* Stat rows — each renders only when its figure survived derivation. */}
            <div className="mt-2 space-y-1.5">
              {view.neighborhood.medianHomeValue !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{td("dossier_neighborhood_homeValue")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatUsd(view.neighborhood.medianHomeValue, locale)}
                  </span>
                </div>
              )}
              {view.neighborhood.medianGrossRent !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{td("dossier_neighborhood_grossRent")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {td("dossier_neighborhood_rentPerMonth", {
                      amount: formatUsd(view.neighborhood.medianGrossRent, locale),
                    })}
                  </span>
                </div>
              )}
              {view.neighborhood.medianHouseholdIncome !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{td("dossier_neighborhood_income")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatUsd(view.neighborhood.medianHouseholdIncome, locale)}
                  </span>
                </div>
              )}
              {view.neighborhood.ownerOccupiedPct !== null && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{td("dossier_neighborhood_ownerOccupied")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {td("dossier_neighborhood_percent", { percent: view.neighborhood.ownerOccupiedPct })}
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
        {view.showLocationHint && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-foreground/[0.02]">
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
 * Value-first upgrade teaser for FREE/FREE_TRIAL (GATE-API entitled:false).
 * Same card chrome as the real dossier, with the seven insight rows shown as
 * honest locked line-items (lock glyphs, no fabricated data) and an "Unlock
 * with Individual" CTA to /pricing. Visual language mirrors the existing
 * MOVING_PLAN upgrade teaser (move-command-center free hero).
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
] as const;

export function HomeDossierTeaser({ place }: { place?: string }) {
  const td = useTranslations("dashboard");
  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
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

        {TEASER_ROWS.map(({ Icon, boxClass, iconClass, titleKey, subKey }) => (
          <div
            key={titleKey}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-foreground/[0.02]"
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
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </div>
        ))}

        <div className="pt-1">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-semibold hover:opacity-90 transition whitespace-nowrap"
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
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5 space-y-3" aria-hidden="true">
      <div className="h-6 w-48 rounded-lg bg-foreground/5 motion-safe:animate-pulse" />
      <div className="h-16 w-full rounded-xl bg-foreground/5 motion-safe:animate-pulse" />
      <div className="h-16 w-full rounded-xl bg-foreground/5 motion-safe:animate-pulse" />
    </div>
  );
}

// ── Fetching wrapper (default dashboard entry) ───────────────────────────────

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

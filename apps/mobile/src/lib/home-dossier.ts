// Pure presentation logic for the mobile "New Home Dossier" card
// (src/components/ui/HomeDossierCard.tsx). Kept free of react-native imports
// so it can be unit-tested under the node vitest environment, mirroring the
// graceful-degradation style of apps/web/src/lib/fcc-isp.ts: status unions in,
// render-or-hide decisions out, never a throw in the user path.
//
// HERMES NOTE: no Intl.RelativeTimeFormat / ListFormat / PluralRules here.
// Date labels use Date#toLocaleDateString, which the app already relies on.

/** Section statuses from GET /api/addresses/{id}/dossier (shared contract). */
export type DossierSectionStatus = "ok" | "no_location" | "error";
export type DossierWeatherStatus = "ok" | "no_location" | "too_far" | "error";
/** Air adds "not_configured" (AirNow needs an API key) — hidden like configured:false. */
export type DossierAirStatus = "ok" | "not_configured" | "no_location" | "error";
export type DossierHousingStatus =
  | "ok"
  | "disabled"
  | "not_configured"
  | "no_location"
  | "no_zip"
  | "not_found"
  | "error";
export type DossierEvChargingStatus = "ok" | "disabled" | "not_configured" | "no_location" | "error";
/**
 * Neighborhood is a Pro-only section gated ABOVE the dossier itself (the other
 * sections unlock at Individual+; this one needs Pro). "upgrade_required" is
 * the per-section gate: an entitled-to-the-dossier but non-Pro user gets a
 * locked teaser for THIS row while the others render real data.
 */
export type DossierNeighborhoodStatus =
  | "ok"
  | "upgrade_required"
  | "not_configured"
  | "no_location"
  | "error";
export type WalkBand = "least" | "below_average" | "above_average" | "most";

export interface HomeDossierResponse {
  configured: boolean;
  /**
   * Plan entitlement (Pro-only PDF packaging). `false` ⇒ render the
   * value-first upgrade teaser instead of data rows. Absent (older servers
   * that predate the flag) ⇒ treated as entitled, so a half-rolled-out
   * backend never hides real data from a paying user.
   */
  entitled?: boolean;
  /** Companion gate signal from the API; any truthy value means teaser. */
  upgradeRequired?: boolean | string;
  /** Gate code (for diagnostics only; rendering is driven by entitlement/gate). */
  code?: string;
  /** Pro PDF entitlement. Present for parity with the web dossier payload. */
  dossierPdf?: boolean;
  address?: { id: string; city: string; state: string };
  /** Data sections may be omitted entirely on unentitled payloads. */
  flood?: {
    status: DossierSectionStatus;
    zone: string | null;
    isHighRisk: boolean | null;
  };
  school?: {
    status: DossierSectionStatus;
    districtName: string | null;
    ncesId: string | null;
  };
  weather?: {
    status: DossierWeatherStatus;
    forecastDate: string | null;
    summary: string | null;
    tempHighF: number | null;
    tempLowF: number | null;
    precipChancePct: number | null;
  };
  /**
   * Extended sections (second dossier phase). All four are OPTIONAL on the
   * wire — older servers simply omit them, and the card renders exactly what
   * it renders today. Each is independent: one degrading never hides another.
   */
  hazards?: {
    status: DossierSectionStatus;
    /** Server-side: max 3, only ratings >= "Relatively Moderate" (FEMA NRI). */
    topRisks: Array<{ hazard: string; rating: string }>;
    overallRating: string | null;
  };
  /** EPA radon zone by county (1 = highest potential … 3 = low). */
  radon?: { status: DossierSectionStatus; zone: 1 | 2 | 3 | null };
  water?: {
    status: DossierSectionStatus;
    systemName: string | null;
    violations5y: number | null;
  };
  air?: { status: DossierAirStatus; aqi: number | null; category: string | null };
  housing?: {
    status: DossierHousingStatus;
    zip: string | null;
    countyName: string | null;
    metroName: string | null;
    areaName: string | null;
    fairMarketRent: {
      year: number | null;
      oneBedroom: number | null;
      twoBedroom: number | null;
      threeBedroom: number | null;
      fourBedroom: number | null;
      zipSpecific: boolean;
    } | null;
    incomeLimits: {
      year: number | null;
      medianIncome: number | null;
      lowIncome4Person: number | null;
    } | null;
  };
  evCharging?: {
    status: DossierEvChargingStatus;
    radiusMiles: number;
    stationCount: number;
    nearestDistanceMiles: number | null;
    dcFastPortCount: number;
    level2PortCount: number;
  };
  /**
   * Neighborhood (Pro-only) — Census/ACS area medians for the surrounding
   * tract, NOT a valuation of this home. "upgrade_required" → locked teaser.
   */
  neighborhood?: {
    status: DossierNeighborhoodStatus;
    medianHomeValue: number | null;
    medianGrossRent: number | null;
    medianHouseholdIncome: number | null;
    ownerOccupiedPct: number | null;
    /** EPA National Walkability Index (1-20); area context, not a per-home score. */
    walkScore?: number | null;
    /** Coarse walkability band: least | below_average | above_average | most. */
    walkBand?: string | null;
    schools?: Array<{ name: string; level?: string | null; rating?: string | null }> | null;
  };
}

export interface FloodRow {
  zone: string;
  isHighRisk: boolean;
}

export interface SchoolRow {
  districtName: string;
  ncesId: string | null;
}

export interface WeatherRow {
  forecastDate: string | null;
  summary: string | null;
  /** Rounded integer temps; null when the API had no reading. */
  tempHighF: number | null;
  tempLowF: number | null;
  /** Clamped 0–100 integer; null when the API had no reading. */
  precipChancePct: number | null;
}

export interface HazardRiskPill {
  hazard: string;
  rating: string;
}

export interface HazardsRow {
  /** Sanitized, hard-capped at 3 pills even if the server over-delivers. */
  topRisks: HazardRiskPill[];
  overallRating: string | null;
}

export interface RadonRow {
  zone: 1 | 2 | 3;
}

export interface WaterRow {
  systemName: string;
  /** Non-negative integer count; null when the record had no figure. */
  violations5y: number | null;
}

export interface AirRow {
  /** Rounded non-negative AQI; null when absent. At least one of aqi/category is set. */
  aqi: number | null;
  category: string | null;
}

export interface HousingRow {
  areaName: string | null;
  zip: string | null;
  fmrYear: number | null;
  twoBedroomFmr: number | null;
  medianIncome: number | null;
  lowIncome4Person: number | null;
  zipSpecific: boolean;
}

export interface EvChargingRow {
  radiusMiles: number;
  stationCount: number;
  nearestDistanceMiles: number | null;
  dcFastPortCount: number;
  level2PortCount: number;
}

export interface NeighborhoodSchool {
  name: string;
  level: string | null;
  rating: string | null;
}

/**
 * Neighborhood render model (Pro). `locked` ⇒ render the in-card Pro teaser
 * row; otherwise the area-median figures — each null when absent so the card
 * renders only what the ACS actually published.
 */
export type NeighborhoodRow =
  | { locked: true }
  | {
      locked: false;
      medianHomeValue: number | null;
      medianGrossRent: number | null;
      medianHouseholdIncome: number | null;
      ownerOccupiedPct: number | null;
      walkScore: number | null;
      walkBand: WalkBand | null;
      schools: NeighborhoodSchool[];
    };

export interface HomeDossierRows {
  flood: FloodRow | null;
  school: SchoolRow | null;
  weather: WeatherRow | null;
  hazards: HazardsRow | null;
  radon: RadonRow | null;
  water: WaterRow | null;
  air: AirRow | null;
  housing: HousingRow | null;
  evCharging: EvChargingRow | null;
  neighborhood: NeighborhoodRow | null;
  /** False ⇒ the card renders nothing at all. */
  hasContent: boolean;
}

const EMPTY_ROWS: HomeDossierRows = {
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
  hasContent: false,
};

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Round a Fahrenheit reading to a whole degree; null for absent/invalid. */
export function roundTemp(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/** Clamp a precipitation chance to an integer 0–100; null for absent/invalid. */
export function clampPct(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Flood row renders only when FEMA answered with a concrete zone. A missing
 * location, an upstream error, or a null zone all hide the row — never an
 * error state in the card (fail-open, the move plan is the primary content).
 */
export function getFloodRow(d: HomeDossierResponse): FloodRow | null {
  const flood = d.flood;
  if (!flood || flood.status !== "ok" || !nonEmpty(flood.zone)) return null;
  return { zone: flood.zone.trim(), isHighRisk: flood.isHighRisk === true };
}

/** School row renders only with a concrete district name from NCES data. */
export function getSchoolRow(d: HomeDossierResponse): SchoolRow | null {
  const school = d.school;
  if (!school || school.status !== "ok" || !nonEmpty(school.districtName)) return null;
  return {
    districtName: school.districtName.trim(),
    ncesId: nonEmpty(school.ncesId) ? school.ncesId.trim() : null,
  };
}

/**
 * Weather row renders only when the forecast window applies (status "ok" —
 * the server already enforces "moveDate within 7 days AND this address is the
 * destination"; "too_far" stays hidden) AND there is something honest to show:
 * a summary or a complete high/low pair. A lone temperature renders nothing.
 */
export function getWeatherRow(d: HomeDossierResponse): WeatherRow | null {
  const weather = d.weather;
  if (!weather || weather.status !== "ok") return null;
  const high = roundTemp(weather.tempHighF);
  const low = roundTemp(weather.tempLowF);
  const hasTempPair = high !== null && low !== null;
  if (!nonEmpty(weather.summary) && !hasTempPair) return null;
  return {
    forecastDate: nonEmpty(weather.forecastDate) ? weather.forecastDate : null,
    summary: nonEmpty(weather.summary) ? weather.summary.trim() : null,
    tempHighF: hasTempPair ? high : null,
    tempLowF: hasTempPair ? low : null,
    precipChancePct: clampPct(weather.precipChancePct),
  };
}

const MAX_HAZARD_PILLS = 3;

/**
 * Hazards row renders only when FEMA NRI answered AND there is something
 * honest to show: at least one notable risk (the server pre-filters to
 * ratings >= "Relatively Moderate") or an overall county rating. Pills are
 * re-sanitized and re-capped at 3 client-side — a misbehaving payload must
 * never overflow the compact card.
 */
export function getHazardsRow(d: HomeDossierResponse): HazardsRow | null {
  const hazards = d.hazards;
  if (!hazards || hazards.status !== "ok") return null;
  const topRisks: HazardRiskPill[] = (Array.isArray(hazards.topRisks) ? hazards.topRisks : [])
    .filter((r): r is HazardRiskPill => !!r && nonEmpty(r.hazard) && nonEmpty(r.rating))
    .slice(0, MAX_HAZARD_PILLS)
    .map((r) => ({ hazard: r.hazard.trim(), rating: r.rating.trim() }));
  const overallRating = nonEmpty(hazards.overallRating) ? hazards.overallRating.trim() : null;
  if (topRisks.length === 0 && !overallRating) return null;
  return { topRisks, overallRating };
}

/**
 * Radon row renders only for a concrete EPA zone (1, 2, or 3). Anything else
 * — including a junk number from a malformed payload — hides the row rather
 * than rendering a zone the EPA never published.
 */
export function getRadonRow(d: HomeDossierResponse): RadonRow | null {
  const radon = d.radon;
  if (!radon || radon.status !== "ok") return null;
  const zone = radon.zone;
  if (zone !== 1 && zone !== 2 && zone !== 3) return null;
  return { zone };
}

/**
 * Water row renders only with a named drinking-water system. The 5-year
 * violation count is optional meta — kept only as a non-negative integer
 * (0 is meaningful and renders as honest good news), nulled otherwise.
 */
export function getWaterRow(d: HomeDossierResponse): WaterRow | null {
  const water = d.water;
  if (!water || water.status !== "ok" || !nonEmpty(water.systemName)) return null;
  const v = water.violations5y;
  const violations5y =
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  return { systemName: water.systemName.trim(), violations5y };
}

/**
 * Air row renders only when AirNow answered with something real: a usable
 * AQI number and/or a category label. "not_configured" (no AirNow key on the
 * deployment) hides the row exactly like configured:false hides the card —
 * never an empty or teased section for capability the server lacks.
 */
export function getAirRow(d: HomeDossierResponse): AirRow | null {
  const air = d.air;
  if (!air || air.status !== "ok") return null;
  const aqi =
    typeof air.aqi === "number" && Number.isFinite(air.aqi) && air.aqi >= 0
      ? Math.round(air.aqi)
      : null;
  const category = nonEmpty(air.category) ? air.category.trim() : null;
  if (aqi === null && !category) return null;
  return { aqi, category };
}

/** HUD housing row renders only from real HUD data; any degraded status hides it. */
export function getHousingRow(d: HomeDossierResponse): HousingRow | null {
  const housing = d.housing;
  if (!housing || housing.status !== "ok") return null;
  const fmr = housing.fairMarketRent ?? null;
  const income = housing.incomeLimits ?? null;
  const twoBedroomFmr = posInt(fmr?.twoBedroom);
  const medianIncome = posInt(income?.medianIncome);
  const lowIncome4Person = posInt(income?.lowIncome4Person);
  if (twoBedroomFmr === null && medianIncome === null && lowIncome4Person === null) return null;
  return {
    areaName: nonEmpty(housing.areaName)
      ? housing.areaName.trim()
      : nonEmpty(housing.metroName)
        ? housing.metroName.trim()
        : nonEmpty(housing.countyName)
          ? housing.countyName.trim()
          : null,
    zip: nonEmpty(housing.zip) ? housing.zip.trim() : null,
    fmrYear: posInt(fmr?.year),
    twoBedroomFmr,
    medianIncome,
    lowIncome4Person,
    zipSpecific: fmr?.zipSpecific === true,
  };
}

/** NLR EV row renders for an authoritative ok response, including zero nearby stations. */
export function getEvChargingRow(d: HomeDossierResponse): EvChargingRow | null {
  const ev = d.evCharging;
  if (!ev || ev.status !== "ok") return null;
  const radiusMiles = posInt(ev.radiusMiles) ?? 10;
  const stationCount =
    typeof ev.stationCount === "number" && Number.isFinite(ev.stationCount) && ev.stationCount >= 0
      ? Math.round(ev.stationCount)
      : 0;
  const nearestDistanceMiles =
    typeof ev.nearestDistanceMiles === "number" &&
    Number.isFinite(ev.nearestDistanceMiles) &&
    ev.nearestDistanceMiles >= 0
      ? Math.round(ev.nearestDistanceMiles * 10) / 10
      : null;
  return {
    radiusMiles,
    stationCount,
    nearestDistanceMiles,
    dcFastPortCount: posInt(ev.dcFastPortCount) ?? 0,
    level2PortCount: posInt(ev.level2PortCount) ?? 0,
  };
}

/** Positive whole figure (dollars/count); null for absent/invalid/<=0. */
function posInt(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** Integer 0–100 percent; null for absent/invalid (0 is meaningful, kept). */
export function clampNeighborhoodPct(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** EPA walkability index (1-20) rounded to one decimal; null when absent/invalid. */
export function clampWalkScore(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(20, Math.round(value * 10) / 10);
}

/** Narrow an API band string to the known EPA buckets; null means no label. */
export function normalizeWalkBand(raw: string | null | undefined): WalkBand | null {
  return raw === "least" || raw === "below_average" || raw === "above_average" || raw === "most"
    ? raw
    : null;
}

export function walkBandLabelKey(
  band: WalkBand,
):
  | "dossier.neighborhoodWalkLeast"
  | "dossier.neighborhoodWalkBelow"
  | "dossier.neighborhoodWalkAbove"
  | "dossier.neighborhoodWalkMost" {
  if (band === "least") return "dossier.neighborhoodWalkLeast";
  if (band === "below_average") return "dossier.neighborhoodWalkBelow";
  if (band === "above_average") return "dossier.neighborhoodWalkAbove";
  return "dossier.neighborhoodWalkMost";
}

/**
 * Neighborhood row (Pro). "upgrade_required" ⇒ the locked teaser variant.
 * "ok" ⇒ the area-median figures, but only when at least one figure or a named
 * school survives (never an empty shell). Every other status hides the row.
 * Schools are sanitized to a named list, hard-capped at 3.
 */
export function getNeighborhoodRow(d: HomeDossierResponse): NeighborhoodRow | null {
  const n = d.neighborhood;
  if (!n) return null;
  if (n.status === "upgrade_required") return { locked: true };
  if (n.status !== "ok") return null;

  const medianHomeValue = posInt(n.medianHomeValue);
  const medianGrossRent = posInt(n.medianGrossRent);
  const medianHouseholdIncome = posInt(n.medianHouseholdIncome);
  const ownerOccupiedPct = clampNeighborhoodPct(n.ownerOccupiedPct);
  const walkScore = clampWalkScore(n.walkScore);
  const walkBand = normalizeWalkBand(n.walkBand);
  const schools: NeighborhoodSchool[] = (Array.isArray(n.schools) ? n.schools : [])
    .filter(
      (s): s is { name: string; level?: string | null; rating?: string | null } =>
        !!s && nonEmpty(s.name),
    )
    .slice(0, 3)
    .map((s) => ({
      name: s.name.trim(),
      level: nonEmpty(s.level) ? s.level.trim() : null,
      rating: nonEmpty(s.rating) ? s.rating.trim() : null,
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

/**
 * Build the card's render model from a dossier response. Tolerates null /
 * undefined / unconfigured payloads by returning "render nothing" — the card
 * disappears rather than erroring (offline, 404, half-rolled-out server).
 * Unentitled payloads also yield empty rows: data rows must never render for
 * a free user, even if a section leaked into the payload.
 */
export function deriveHomeDossier(
  dossier: HomeDossierResponse | null | undefined,
): HomeDossierRows {
  if (!dossier || dossier.configured !== true) return EMPTY_ROWS;
  if (dossier.entitled === false) return EMPTY_ROWS;
  const flood = getFloodRow(dossier);
  const school = getSchoolRow(dossier);
  const weather = getWeatherRow(dossier);
  // Extended sections are optional on the wire (older servers omit them) and
  // independent: each getter degrades to null on its own, never the card.
  const hazards = getHazardsRow(dossier);
  const radon = getRadonRow(dossier);
  const water = getWaterRow(dossier);
  const air = getAirRow(dossier);
  const housing = getHousingRow(dossier);
  const evCharging = getEvChargingRow(dossier);
  const neighborhood = getNeighborhoodRow(dossier);
  return {
    flood,
    school,
    weather,
    hazards,
    radon,
    water,
    air,
    housing,
    evCharging,
    neighborhood,
    hasContent: Boolean(
      flood || school || weather || hazards || radon || water || air || housing || evCharging || neighborhood,
    ),
  };
}

/**
 * Card-level view state (freemium packaging — the dossier is a paid unlock):
 *  - "hidden"  → render nothing. Unconfigured server, fetch failure, malformed
 *                payload, or an entitled user whose every section degraded.
 *                configured:false stays invisible for EVERYONE — a teaser for
 *                a feature the deployment can't serve would be dishonest.
 *  - "teaser"  → entitled:false from the server: render the value-first
 *                upgrade teaser (locked rows + "Unlock with Individual").
 *  - "content" → entitled (or a pre-flag server) with at least one real row.
 */
export type HomeDossierView =
  | { kind: "hidden" }
  | { kind: "teaser" }
  | { kind: "content"; rows: HomeDossierRows };

export function deriveHomeDossierView(
  dossier: HomeDossierResponse | null | undefined,
): HomeDossierView {
  if (!dossier || dossier.configured !== true) return { kind: "hidden" };
  if (dossier.entitled === false || !!dossier.upgradeRequired) return { kind: "teaser" };
  const rows = deriveHomeDossier(dossier);
  return rows.hasContent ? { kind: "content", rows } : { kind: "hidden" };
}

// ── Dossier ambient mapping ─────────────────────────────────────────────
// Pure scene-parameter derivation for the decorative DossierAmbient layer
// (src/components/ui/DossierAmbient.tsx). Mirrors the web contract in
// apps/web/src/components/dashboard/dossier-ambient.tsx EXACTLY so both
// platforms read the same data the same way: intensity 0 calm / 1 moderate /
// 2 elevated, always derived from REAL section data — honest ambience,
// never fabricated information. Kept here (no react-native imports) so the
// mapping unit-tests under the node vitest environment.

export type AmbientKind =
  | "flood"
  | "school"
  | "hazard"
  | "radon"
  | "water"
  | "air"
  | "housing"
  | "evCharging"
  | "neighborhood"
  | "weather";

export type AmbientIntensity = 0 | 1 | 2;

export type AmbientVariant =
  | "lightning"
  | "wind"
  | "winter"
  | "sun"
  | "cloud"
  | "rain"
  | "storm"
  | "snow"
  | "fog"
  | "heat"
  | "cold";

export interface AmbientSpec {
  kind: AmbientKind;
  intensity: AmbientIntensity;
  variant?: AmbientVariant;
}

/**
 * Per-section inputs for the pure mapper. Shapes mirror the web mapper's
 * (walkBand included for contract parity — the mobile payload carries no walk
 * band yet, so the card passes null and gets the calm cadence).
 */
export type AmbientSectionInput =
  | { kind: "flood"; isHighRisk: boolean | null }
  | { kind: "school" }
  | { kind: "hazard"; topRisks: ReadonlyArray<{ hazard: string; rating: string }> }
  | { kind: "radon"; zone: 1 | 2 | 3 }
  | { kind: "water"; violations5y: number | null }
  | { kind: "air"; aqi: number | null; category?: string | null }
  | {
      kind: "housing";
      twoBedroomFmr: number | null;
      medianIncome: number | null;
      lowIncome4Person: number | null;
    }
  | {
      kind: "evCharging";
      stationCount: number;
      dcFastPortCount: number;
      level2PortCount: number;
    }
  | { kind: "neighborhood"; walkBand: WalkBand | null }
  | {
      kind: "weather";
      summary: string | null;
      precipChancePct: number | null;
      tempHighF?: number | null;
      tempLowF?: number | null;
    };

/** NRI rating -> intensity: Relatively/Very High => 2, *Moderate => 1, else 0. */
function hazardIntensity(rating: string | undefined): AmbientIntensity {
  const r = (rating ?? "").toLowerCase();
  if (r.includes("high")) return 2;
  if (r.includes("moderate")) return 1;
  return 0;
}

/** Top NRI hazard name -> scene variant. Wind streaks are the safe default. */
function hazardVariant(hazard: string | undefined): AmbientVariant {
  const h = (hazard ?? "").toLowerCase();
  if (h.includes("lightning") || h.includes("thunder")) return "lightning";
  if (
    h.includes("winter") ||
    h.includes("snow") ||
    h.includes("ice") ||
    h.includes("cold") ||
    h.includes("hail") ||
    h.includes("avalanche")
  ) {
    return "winter";
  }
  return "wind";
}

function textHasAny(text: string, needles: ReadonlyArray<string>): boolean {
  return needles.some((needle) => text.includes(needle));
}

function weatherSpec({
  summary,
  precipChancePct,
  tempHighF,
  tempLowF,
}: Extract<AmbientSectionInput, { kind: "weather" }>): AmbientSpec {
  const s = (summary ?? "").toLowerCase();
  const precip = precipChancePct;
  const high = typeof tempHighF === "number" && Number.isFinite(tempHighF) ? tempHighF : null;
  const low = typeof tempLowF === "number" && Number.isFinite(tempLowF) ? tempLowF : null;

  if (textHasAny(s, ["thunder", "storm", "lightning", "squall", "tornado"])) {
    return { kind: "weather", intensity: 2, variant: "storm" };
  }
  if (textHasAny(s, ["snow", "sleet", "freezing", "ice", "blizzard", "flurr"])) {
    return {
      kind: "weather",
      intensity: textHasAny(s, ["blizzard", "heavy", "freezing"]) || (precip ?? 0) >= 70 ? 2 : 1,
      variant: "snow",
    };
  }
  if (textHasAny(s, ["fog", "mist", "haze", "smoke"])) {
    return { kind: "weather", intensity: textHasAny(s, ["dense", "smoke"]) ? 2 : 1, variant: "fog" };
  }
  if (textHasAny(s, ["wind", "gust", "breez"])) {
    return { kind: "weather", intensity: textHasAny(s, ["high wind", "gust"]) ? 2 : 1, variant: "wind" };
  }
  if (typeof precip === "number" && precip >= 50) {
    return { kind: "weather", intensity: precip >= 80 ? 2 : 1, variant: "rain" };
  }
  if (textHasAny(s, ["cloud", "overcast"])) {
    return { kind: "weather", intensity: 1, variant: "cloud" };
  }
  if (textHasAny(s, ["heat", "hot", "excessive"]) || (high !== null && high >= 95)) {
    return {
      kind: "weather",
      intensity: textHasAny(s, ["excessive"]) || (high !== null && high >= 100) ? 2 : 1,
      variant: "heat",
    };
  }
  if (textHasAny(s, ["cold", "chill", "freeze"]) || (low !== null && low <= 32)) {
    return {
      kind: "weather",
      intensity: textHasAny(s, ["freeze"]) || (low !== null && low <= 25) ? 2 : 1,
      variant: "cold",
    };
  }
  return { kind: "weather", intensity: 0, variant: "sun" };
}

function airCategoryIntensity(category: string | null | undefined): AmbientIntensity {
  const c = (category ?? "").toLowerCase();
  if (c.includes("hazard") || c.includes("very unhealthy") || c.includes("unhealthy")) return 2;
  if (c.includes("moderate") || c.includes("sensitive")) return 1;
  return 0;
}

/**
 * Map a dossier section's REAL data to its ambient scene parameters:
 *  - flood: isHighRisk true => 2, false => 0, unknown => 1;
 *  - school: fixed moderate ambience (directory data carries no risk signal);
 *  - hazard: variant from the TOP risk chip, intensity from its NRI rating;
 *  - radon: zone 1 => 2, zone 2 => 1, zone 3 => 0;
 *  - water: 0 violations => 0, unknown count => 1, violations > 0 => 2;
 *  - air: AQI <= 50 => 0 (mint), 51-100 => 1 (amber), > 100 => 2 (coral);
 *  - housing: HUD rent/income figures drive low/moderate/high-cost ambience;
 *  - evCharging: none => 0, nearby L2 => 1, DC-fast/many stations => 2;
 *  - neighborhood: walk band most => 2, above_average => 1, else 0 (cadence);
 *  - weather: storm/snow/fog/wind/rain/cloud/heat/cold/sun derived from
 *    forecast summary + precipitation + temps.
 */
export function ambientForSection(section: AmbientSectionInput): AmbientSpec {
  switch (section.kind) {
    case "flood":
      return {
        kind: "flood",
        intensity: section.isHighRisk === true ? 2 : section.isHighRisk === false ? 0 : 1,
      };
    case "school":
      return { kind: "school", intensity: 1 };
    case "hazard": {
      const top = section.topRisks[0];
      return {
        kind: "hazard",
        intensity: hazardIntensity(top?.rating),
        variant: hazardVariant(top?.hazard),
      };
    }
    case "radon":
      return { kind: "radon", intensity: section.zone === 1 ? 2 : section.zone === 2 ? 1 : 0 };
    case "water":
      return {
        kind: "water",
        intensity: section.violations5y === null ? 1 : section.violations5y > 0 ? 2 : 0,
      };
    case "air":
      return {
        kind: "air",
        intensity:
          typeof section.aqi === "number"
            ? section.aqi <= 50
              ? 0
              : section.aqi <= 100
                ? 1
                : 2
            : airCategoryIntensity(section.category),
      };
    case "housing": {
      const fmr = section.twoBedroomFmr;
      const lowIncome = section.lowIncome4Person;
      const highCost =
        (typeof fmr === "number" && fmr >= 2500) ||
        (typeof lowIncome === "number" && lowIncome >= 95000);
      const moderateCost =
        (typeof fmr === "number" && fmr >= 1600) ||
        (typeof lowIncome === "number" && lowIncome >= 65000) ||
        (typeof section.medianIncome === "number" && section.medianIncome >= 85000);
      return { kind: "housing", intensity: highCost ? 2 : moderateCost ? 1 : 0 };
    }
    case "evCharging":
      return {
        kind: "evCharging",
        intensity:
          section.stationCount <= 0
            ? 0
            : section.dcFastPortCount > 0 || section.stationCount >= 8
              ? 2
              : 1,
      };
    case "neighborhood": {
      const band = section.walkBand;
      return {
        kind: "neighborhood",
        intensity: band === "most" ? 2 : band === "above_average" ? 1 : 0,
      };
    }
    case "weather":
      return weatherSpec(section);
  }
}

/**
 * Format the forecast date ("YYYY-MM-DD" or ISO datetime) as a short local
 * label, e.g. "Fri, Jun 12". Date-only strings are parsed as LOCAL calendar
 * dates — `new Date("2026-06-12")` would parse UTC midnight and can render
 * the previous day west of Greenwich. Returns null when unparseable so the
 * caller simply omits the label.
 */
export function formatForecastDate(
  value: string | null | undefined,
  locale: string,
): string | null {
  if (!nonEmpty(value)) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    // Defensive: an invalid locale tag must not crash the card.
    return null;
  }
}

// US Census ACS 5-year neighborhood economics lookup (Pro "Neighborhood
// Intelligence").
// =============================================================================
// Part of the Pro New Home Dossier: given an address's lat/lng, report the
// American Community Survey (ACS) 5-year medians for the CENSUS TRACT the point
// falls in (median home value, median gross rent, median household income, and
// the owner-occupied share), plus a plain-English context band so a mover can
// gauge the neighborhood's economics before a move.
//
// DATA SOURCE — US Census Bureau, two endpoints:
//
//   1. KEYLESS — resolve lat/lng → state+county+tract FIPS via the Census
//      Geocoder geographies endpoint (same geocoder host the repo already uses
//      in census-geocoder.ts):
//
//        https://geocoding.geo.census.gov/geocoder/geographies/coordinates
//          ?x=<lng>&y=<lat>&benchmark=Public_AR_Current
//          &vintage=Current_Current&format=json
//
//   2. KEYED (since 2026) — query ACS 5-year detail tables for those FIPS:
//
//        https://api.census.gov/data/2023/acs/acs5
//          ?get=NAME,B25077_001E,B25064_001E,B19013_001E,B25003_001E,
//                B25003_002E&for=tract:<TTTTTT>&in=state:<SS>&in=county:<CCC>
//          &key=<CENSUS_API_KEY>
//
//      VERIFIED 2026-06-11: the geographies endpoint is keyless and returns
//      STATE/COUNTY/TRACT FIPS for a point (Austin TX → 48/453/001103). The
//      api.census.gov/data host, however, now answers EVERY query — even the
//      most minimal `get=NAME&for=state:48` — with HTTP 302 +
//      `X-DataWebAPI-KeyError: 1`, redirecting to missing_key.html. So the ACS
//      DATA query now REQUIRES a key (the geocoder still does not). The key is
//      FREE (sign up at https://api.census.gov/data/key_signup.html); set it as
//      CENSUS_API_KEY in runtime config. Until it is set this lookup is a
//      graceful no-op (`status: "not_configured"`) — the SAME pattern as
//      airnow.ts — so the dossier's neighborhood section degrades cleanly and
//      the rest of the dossier is unaffected.
//
// ACS VARIABLES (5-year detail tables):
//   B25077_001E — Median value (dollars) of owner-occupied housing units
//   B25064_001E — Median gross rent (dollars)
//   B19013_001E — Median household income in the past 12 months (dollars)
//   B25003_001E — Total occupied housing units (tenure universe)
//   B25003_002E — Owner-occupied housing units (→ owner share = 002/001)
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as airnow.ts / fema-nri.ts):
// this module NEVER throws into a user path. Missing key yields
// `{ status: "not_configured" }`; missing coordinates yield
// `{ status: "no_location" }`; network failure, timeout, or an unexpected
// payload yields `{ status: "error" }`. Callers branch on `status` and fall
// back. Only "ok" answers are cached.
//
// HONESTY NOTE: every figure here is an AREA MEDIAN for the surrounding census
// tract (~1,200–8,000 people), NOT a valuation or appraisal of the specific
// home. ACS values are 5-year rolling estimates with sampling error, and the
// Census suppresses some tract values (returned as null/negative sentinels) —
// those are reported as null, never fabricated. Surface as neighborhood
// context, never as "this home is worth $X".
// =============================================================================

import { getRuntimeConfigValue } from "@/lib/runtime-config";

// ── Public types ────────────────────────────────────────────────────────────

export type NeighborhoodAcsStatus =
  | "ok" // Census answered; figures are authoritative (individual nulls = suppressed)
  | "not_configured" // CENSUS_API_KEY unset — caller falls back
  | "no_location" // no usable lat/lng — caller falls back
  | "error"; // geocode/data network/parse/timeout/HTTP error — caller falls back

/** A plain-English band for a dollar figure, relative to US-wide reference
 *  points. Deliberately coarse — these are tract medians, not precise ranks. */
export type AcsContextBand =
  | "well_below_us"
  | "below_us"
  | "near_us"
  | "above_us"
  | "well_above_us"
  | "unknown";

export interface NeighborhoodAcsResult {
  status: NeighborhoodAcsStatus;
  /** Geography the figures describe ("tract" when resolved; null otherwise). */
  geography: "tract" | null;
  /** Census tract display name (e.g. "Census Tract 11.03"), when resolved. */
  tractName: string | null;
  /** 11-digit tract GEOID (state+county+tract FIPS), when resolved. */
  tractFips: string | null;
  /** Median value of owner-occupied homes (dollars) or null when suppressed. */
  medianHomeValue: number | null;
  /** Median gross rent (dollars) or null when suppressed. */
  medianGrossRent: number | null;
  /** Median household income (dollars) or null when suppressed. */
  medianHouseholdIncome: number | null;
  /** Owner-occupied share of occupied units, 0–1, or null when unavailable. */
  ownerOccupiedShare: number | null;
  /** Coarse plain-English band for median household income (US reference). */
  incomeBand: AcsContextBand;
  /** Coarse plain-English band for median home value (US reference). */
  homeValueBand: AcsContextBand;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Honest caveat the UI must surface alongside the figures. */
  caveat: string;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "US Census Bureau ACS 5-Year Estimates";
    url: "https://www.census.gov/programs-surveys/acs/";
  };
}

export interface NeighborhoodAcsInput {
  latitude?: number | null;
  longitude?: number | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

// Keyless geocoder geographies endpoint (point → FIPS). VERIFIED 2026-06-11.
const CENSUS_GEOGRAPHIES_URL = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
// ACS 5-year detail tables. 2023 is the latest 5-year release as of 2026-06.
// If the Census publishes a newer 5-year vintage, bump this year.
const ACS_DATASET = "2023/acs/acs5";
const ACS_DATA_BASE = `https://api.census.gov/data/${ACS_DATASET}`;

// Slightly longer than the ~3s GIS libs: this lib chains TWO Census calls
// (geocode → data), so ~4s total keeps the dossier responsive while tolerating
// one slow hop. Each individual fetch is bounded by this same cap.
const REQUEST_TIMEOUT_MS = 4000;

// ACS detail variables (see module header for meanings).
const VAR_HOME_VALUE = "B25077_001E";
const VAR_GROSS_RENT = "B25064_001E";
const VAR_HH_INCOME = "B19013_001E";
const VAR_TENURE_TOTAL = "B25003_001E";
const VAR_TENURE_OWNER = "B25003_002E";
const ACS_VARIABLES = [
  "NAME",
  VAR_HOME_VALUE,
  VAR_GROSS_RENT,
  VAR_HH_INCOME,
  VAR_TENURE_TOTAL,
  VAR_TENURE_OWNER,
] as const;

// US-wide reference points (rounded, ACS 2023 ballpark) used ONLY to label a
// coarse band — never shown as exact figures. Bands are ±25% / ±50% around
// these midpoints, so small drift in the reference year never flips a band.
const US_MEDIAN_HH_INCOME = 78_000;
const US_MEDIAN_HOME_VALUE = 340_000;

const CAVEAT =
  "These are American Community Survey 5-year medians for the surrounding census tract, not a valuation of this specific home. Treat them as neighborhood context.";

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// ACS 5-year estimates are republished about once a year, so a 7-day TTL is
// safe and keeps Census API usage minimal.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: NeighborhoodAcsResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): NeighborhoodAcsResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: NeighborhoodAcsResult): void {
  // Only cache authoritative answers — never transient errors / unconfigured.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearNeighborhoodAcsCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "US Census Bureau ACS 5-Year Estimates",
  url: "https://www.census.gov/programs-surveys/acs/",
} as const;

function degraded(status: NeighborhoodAcsStatus, reason: string): NeighborhoodAcsResult {
  return {
    status,
    geography: null,
    tractName: null,
    tractFips: null,
    medianHomeValue: null,
    medianGrossRent: null,
    medianHouseholdIncome: null,
    ownerOccupiedShare: null,
    incomeBand: "unknown",
    homeValueBand: "unknown",
    reason,
    caveat: CAVEAT,
    source: SOURCE,
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Parse an ACS estimate cell. The Census returns estimates as strings; values
 * are SUPPRESSED with large negative sentinels (e.g. -666666666) or null. Only
 * a parseable, non-negative number is a usable estimate; anything else → null.
 */
export function parseAcsEstimate(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else {
    const trimmed = String(raw).trim();
    // An empty/whitespace cell is MISSING, not zero — Number("") is 0, so we
    // must reject it explicitly before coercing.
    if (trimmed === "") return null;
    n = Number(trimmed);
  }
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Coarse band for a dollar figure vs. a US reference midpoint (±25% / ±50%). */
export function classifyBand(value: number | null, usReference: number): AcsContextBand {
  if (value === null || !isFiniteNumber(value) || usReference <= 0) return "unknown";
  const ratio = value / usReference;
  if (ratio < 0.5) return "well_below_us";
  if (ratio < 0.75) return "below_us";
  if (ratio <= 1.25) return "near_us";
  if (ratio <= 1.5) return "above_us";
  return "well_above_us";
}

/** Owner-occupied share from tenure counts; null when the universe is empty. */
export function computeOwnerShare(ownerOccupied: number | null, totalOccupied: number | null): number | null {
  if (ownerOccupied === null || totalOccupied === null || totalOccupied <= 0) return null;
  if (ownerOccupied > totalOccupied) return null; // guard against bad rows
  return ownerOccupied / totalOccupied;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      // Census data redirects unkeyed requests (302 → missing_key.html); treat
      // any redirect as a hard failure rather than silently following to HTML.
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      // Status only — the data URL carries the API key, never echo it.
      throw new Error(`Census request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface ResolvedTract {
  tractFips: string; // 11-digit GEOID
  tractName: string | null;
  state: string; // 2-digit
  county: string; // 3-digit
  tract: string; // 6-digit
}

interface RawTractGeography {
  STATE?: string | null;
  COUNTY?: string | null;
  TRACT?: string | null;
  GEOID?: string | null;
  NAME?: string | null;
}

/**
 * Pull the census-tract FIPS components out of a geographies response. The
 * documented shape is
 * `{ result: { geographies: { "Census Tracts": [{ STATE, COUNTY, TRACT, GEOID, NAME }] } } }`.
 * Read defensively; a point with no tract (offshore / non-US) yields null.
 */
export function extractTractGeography(payload: unknown): ResolvedTract | null {
  if (!payload || typeof payload !== "object") return null;
  const geographies = (payload as { result?: { geographies?: unknown } }).result?.geographies;
  if (!geographies || typeof geographies !== "object") return null;
  const tracts = (geographies as Record<string, unknown>)["Census Tracts"];
  if (!Array.isArray(tracts)) return null;
  for (const raw of tracts as RawTractGeography[]) {
    const state = (raw?.STATE || "").trim();
    const county = (raw?.COUNTY || "").trim();
    const tract = (raw?.TRACT || "").trim();
    if (state.length !== 2 || county.length !== 3 || tract.length !== 6) continue;
    const geoid = (raw?.GEOID || "").trim() || `${state}${county}${tract}`;
    return {
      tractFips: geoid,
      tractName: (raw?.NAME || "").trim() || null,
      state,
      county,
      tract,
    };
  }
  return null;
}

/**
 * Map an ACS data response (header row + one data row) to estimate cells keyed
 * by variable name. Census shape: `[[col, ...], [val, ...]]`. Returns null on
 * any unexpected shape (e.g. the HTML missing-key page parsed as non-array).
 */
export function rowToEstimateMap(payload: unknown): Record<string, unknown> | null {
  if (!Array.isArray(payload) || payload.length < 2) return null;
  const header = payload[0];
  const row = payload[1];
  if (!Array.isArray(header) || !Array.isArray(row)) return null;
  const map: Record<string, unknown> = {};
  header.forEach((col, i) => {
    if (typeof col === "string") map[col] = row[i];
  });
  return map;
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up ACS 5-year neighborhood economics for the census tract at a point.
 * Single-address by design — any cross-address comparison (e.g. origin vs.
 * destination delta) is the caller's job.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on Census/network failure. Any
 * non-"ok" status means "no neighborhood data — fall back / hide the section".
 */
export async function lookupNeighborhoodAcs(input: NeighborhoodAcsInput): Promise<NeighborhoodAcsResult> {
  // Key gate first (mirrors airnow.ts): no key → graceful no-op, zero network.
  const apiKey = (await getRuntimeConfigValue("CENSUS_API_KEY").catch(() => null))?.trim() || null;
  if (!apiKey) return degraded("not_configured", "census_api_key_missing");

  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // ~11m cache granularity — far finer than census-tract resolution.
  const cacheKey = `acs:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    // Step 1 — keyless geocode: point → tract FIPS.
    const geoParams = new URLSearchParams({
      x: String(lng),
      y: String(lat),
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      format: "json",
    });
    const geoPayload = await fetchJson(`${CENSUS_GEOGRAPHIES_URL}?${geoParams.toString()}`);
    const tract = extractTractGeography(geoPayload);
    // No tract polygon at this point (offshore / non-US): authoritative "no
    // data here", reported as ok with null figures — not an error.
    if (!tract) {
      const result = okResult(null, null);
      cacheSet(cacheKey, result);
      return result;
    }

    // Step 2 — keyed ACS data query for that tract.
    const dataParams = new URLSearchParams({
      get: ACS_VARIABLES.join(","),
      for: `tract:${tract.tract}`,
      in: `state:${tract.state} county:${tract.county}`,
      key: apiKey,
    });
    const dataPayload = await fetchJson(`${ACS_DATA_BASE}?${dataParams.toString()}`);
    const estimates = rowToEstimateMap(dataPayload);
    if (!estimates) return degraded("error", "unexpected_acs_response_shape");

    const result = okResult(tract, estimates);
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, redirect, or parse failure.
    const reason = error instanceof Error ? error.message : "census_request_failed";
    return degraded("error", reason);
  }
}

/** Build an "ok" result from a resolved tract + its estimate cells (either may
 *  be null when the point/tract has no usable data). */
function okResult(
  tract: ResolvedTract | null,
  estimates: Record<string, unknown> | null,
): NeighborhoodAcsResult {
  const medianHomeValue = estimates ? parseAcsEstimate(estimates[VAR_HOME_VALUE]) : null;
  const medianGrossRent = estimates ? parseAcsEstimate(estimates[VAR_GROSS_RENT]) : null;
  const medianHouseholdIncome = estimates ? parseAcsEstimate(estimates[VAR_HH_INCOME]) : null;
  const tenureTotal = estimates ? parseAcsEstimate(estimates[VAR_TENURE_TOTAL]) : null;
  const tenureOwner = estimates ? parseAcsEstimate(estimates[VAR_TENURE_OWNER]) : null;
  return {
    status: "ok",
    geography: tract ? "tract" : null,
    tractName: tract?.tractName ?? null,
    tractFips: tract?.tractFips ?? null,
    medianHomeValue,
    medianGrossRent,
    medianHouseholdIncome,
    ownerOccupiedShare: computeOwnerShare(tenureOwner, tenureTotal),
    incomeBand: classifyBand(medianHouseholdIncome, US_MEDIAN_HH_INCOME),
    homeValueBand: classifyBand(medianHomeValue, US_MEDIAN_HOME_VALUE),
    reason: null,
    caveat: CAVEAT,
    source: SOURCE,
  };
}

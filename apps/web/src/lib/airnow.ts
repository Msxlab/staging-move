// AirNow current air quality (AQI) lookup.
// =============================================================================
// Part of the New Home Dossier: given an address's lat/lng, report the current
// Air Quality Index near that location (worst reporting pollutant, the same
// convention airnow.gov uses for its headline number).
//
// DATA SOURCE — free but KEYED. The EPA-led AirNow program's observation API:
//
//   https://www.airnowapi.org/aq/observation/latLong/current/
//     ?format=application/json&latitude=…&longitude=…&distance=25&API_KEY=…
//
// The API key is FREE — owner signs up at https://docs.airnowapi.org and puts
// the key in runtime config as AIRNOW_API_KEY (see packages/shared/src/
// runtime-config.ts). The API requires the key as a query parameter (AirNow's
// documented scheme); we never log the request URL so the key stays out of
// reasons/telemetry. Until the key is configured this lookup is a graceful
// no-op (`status: "not_configured"`), same pattern as fcc-isp.ts.
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as fcc-isp.ts): this module
// NEVER throws into a user path. Network failure, timeout, or an unexpected
// payload yields `{ status: "error" }`; missing coordinates yield
// `{ status: "no_location" }`; missing key yields `{ status: "not_configured" }`.
// Callers branch on `status` and fall back.
//
// HONESTY NOTE: AQI observations come from the nearest reporting area (we ask
// within 25 miles) and describe conditions NOW — they are a snapshot, not the
// neighborhood's year-round air quality. An empty result (no monitor nearby)
// is reported as `aqi: null`, never fabricated. Surface as informational with
// AirNow as the named source, never alarming.
// =============================================================================

import { getRuntimeConfigValue } from "@/lib/runtime-config";

// ── Public types ────────────────────────────────────────────────────────────

export type AirQualityLookupStatus =
  | "ok" // AirNow answered; `aqi`/`category` are authoritative (nulls = no monitor nearby)
  | "not_configured" // AIRNOW_API_KEY unset — caller falls back
  | "no_location" // no usable lat/lng — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

export interface AirQualityLookupResult {
  status: AirQualityLookupStatus;
  /** Current AQI (worst reporting pollutant, 0–500) or null when no reading. */
  aqi: number | null;
  /** AirNow category name for that AQI (e.g. "Good", "Moderate") or null. */
  category: string | null;
  /** Pollutant behind the headline AQI (e.g. "PM2.5", "O3"), when known. */
  parameter: string | null;
  /** AirNow reporting area the reading came from (e.g. "Austin"), when known. */
  reportingArea: string | null;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "AirNow";
    url: "https://www.airnow.gov/";
  };
}

export interface AirQualityLookupInput {
  latitude?: number | null;
  longitude?: number | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

const AIRNOW_OBSERVATION_BASE = "https://www.airnowapi.org/aq/observation/latLong/current/";
// Search radius for the nearest reporting area, in miles (AirNow's parameter).
const SEARCH_DISTANCE_MILES = 25;

const REQUEST_TIMEOUT_MS = 3000;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// Observations update hourly, so a 1-hour TTL keeps readings fresh while
// staying far under AirNow's rate limits (500 requests/hour per key).
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: AirQualityLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): AirQualityLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: AirQualityLookupResult): void {
  // Only cache authoritative answers — never transient errors / unconfigured.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearAirQualityCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "AirNow",
  url: "https://www.airnow.gov/",
} as const;

function degraded(status: AirQualityLookupStatus, reason: string): AirQualityLookupResult {
  return {
    status,
    aqi: null,
    category: null,
    parameter: null,
    reportingArea: null,
    reason,
    source: SOURCE,
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      // Status only — never echo the URL (it carries the API key).
      throw new Error(`AirNow request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface RawAirNowObservation {
  ParameterName?: string | null;
  AQI?: number | null;
  Category?: { Number?: number | null; Name?: string | null } | null;
  ReportingArea?: string | null;
}

/**
 * Pick the headline observation: the row with the highest valid AQI across
 * reporting pollutants (AirNow's own "current AQI" convention). AirNow uses
 * negative AQI values as missing-data sentinels — those never qualify.
 */
export function pickWorstObservation(rows: RawAirNowObservation[]): RawAirNowObservation | null {
  let worst: RawAirNowObservation | null = null;
  for (const row of rows) {
    if (!isFiniteNumber(row?.AQI) || row.AQI < 0) continue;
    if (worst === null || row.AQI > (worst.AQI as number)) worst = row;
  }
  return worst;
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the current AQI near a point via AirNow.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on AirNow/network failure. Any
 * non-"ok" status means "no air data — fall back / hide the section".
 */
export async function lookupAirQuality(input: AirQualityLookupInput): Promise<AirQualityLookupResult> {
  const apiKey = (await getRuntimeConfigValue("AIRNOW_API_KEY").catch(() => null))?.trim() || null;
  if (!apiKey) return degraded("not_configured", "airnow_api_key_missing");

  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // ~1.1km cache granularity — observations are reporting-area level anyway.
  const cacheKey = `air:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      format: "application/json",
      latitude: String(lat),
      longitude: String(lng),
      distance: String(SEARCH_DISTANCE_MILES),
      API_KEY: apiKey,
    });
    const payload = await fetchJson(`${AIRNOW_OBSERVATION_BASE}?${params.toString()}`);

    // AirNow answers a bare array of observations ([] = no monitor in range).
    if (!Array.isArray(payload)) {
      return degraded("error", "unexpected_response_shape");
    }

    const worst = pickWorstObservation(payload as RawAirNowObservation[]);
    const result: AirQualityLookupResult = {
      status: "ok",
      aqi: worst ? (worst.AQI as number) : null,
      category: worst ? (worst.Category?.Name || "").trim() || null : null,
      parameter: worst ? (worst.ParameterName || "").trim() || null : null,
      reportingArea: worst ? (worst.ReportingArea || "").trim() || null : null,
      reason: worst ? null : "no_observation_in_range",
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "airnow_request_failed";
    return degraded("error", reason);
  }
}

// US Census Bureau geocoder — server-side coordinate fallback for
// manually-typed addresses.
// =============================================================================
// WHAT THIS SOLVES
// -----------------------------------------------------------------------------
// When a user picks an address from Google Places autocomplete the client sends
// latitude/longitude with the payload. When they TYPE the address by hand those
// fields are null — and every coverage feature keyed off coordinates (FCC ISP
// serviceability, flood zone, school district, weather — see fcc-isp.ts and the
// dossier endpoint) degrades to its "no_location" state for that address.
//
// This module closes that gap by geocoding the typed street/city/state/zip
// server-side via the US Census Bureau's FREE, KEY-LESS geocoder:
//
//   GET https://geocoding.geo.census.gov/geocoder/locations/onelineaddress
//       ?address=<oneline>&benchmark=Public_AR_Current&format=json
//
// No API key, no signup, no billing — appropriate for a US-only product.
//
// GRACEFUL DEGRADATION CONTRACT (same style as fcc-isp.ts): this module NEVER
// throws on network/parse/timeout failure. It returns a status union and the
// caller persists exactly what it had before (null coordinates) on anything
// other than "ok". A geocode failure must never fail or slow an address write
// beyond the hard 2.5s timeout cap.
//
// HARD RULE FOR CALLERS: never overwrite user/Places-provided coordinates —
// only fill coordinates that are null. `geocodeFallbackForPersist` enforces
// this for you.
// =============================================================================

// ── Public types ─────────────────────────────────────────────────────────────

export type CensusGeocodeStatus = "ok" | "no_match" | "error";

export type CensusGeocodeResult =
  | { status: "ok"; latitude: number; longitude: number }
  | { status: "no_match" }
  | { status: "error" };

export interface CensusGeocodeInput {
  street: string;
  city: string;
  /** 2-letter state code. */
  state: string;
  zip?: string | null;
}

// ── Configuration ─────────────────────────────────────────────────────────────

const CENSUS_GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
// Hard latency cap: address creates/updates are interactive writes, so the
// fallback may add at most this much latency before we give up and persist
// null coordinates exactly as before.
const REQUEST_TIMEOUT_MS = 2500;

// ── Small in-process LRU cache ────────────────────────────────────────────────
// Keyed by the normalized address string. Street addresses geocode to the same
// point every time, so "ok" and "no_match" answers are safe to reuse for the
// process lifetime; transient "error" results are NEVER cached (a single
// network blip must not suppress geocoding for repeat saves of that address).
// A Map preserves insertion order, so delete+set on read gives LRU recency.

const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, CensusGeocodeResult>();

function cacheGet(key: string): CensusGeocodeResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  cache.set(key, hit); // refresh recency
  return hit;
}

function cacheSet(key: string, value: CensusGeocodeResult): void {
  if (value.status === "error") return; // never cache transient failures
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

// Exposed for tests.
export function clearCensusGeocoderCache(): void {
  cache.clear();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePart(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Cache key for a geocode input: normalized parts joined with `|`. */
export function normalizeAddressKey(input: CensusGeocodeInput): string {
  return [
    normalizePart(input.street),
    normalizePart(input.city),
    normalizePart(input.state),
    normalizePart(input.zip),
  ].join("|");
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

interface RawAddressMatch {
  coordinates?: { x?: number | null; y?: number | null } | null;
}

/**
 * Pull the first usable coordinate pair out of the Census response. The
 * documented shape is `{ result: { addressMatches: [{ coordinates: { x, y }}] } }`
 * where x = longitude and y = latitude. We read defensively and skip rows with
 * missing or out-of-range coordinates.
 */
function extractFirstMatch(payload: unknown): { latitude: number; longitude: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const matches = (payload as { result?: { addressMatches?: unknown } }).result?.addressMatches;
  if (!Array.isArray(matches)) return null;
  for (const match of matches as RawAddressMatch[]) {
    const x = match?.coordinates?.x;
    const y = match?.coordinates?.y;
    if (isFiniteNumber(x) && isFiniteNumber(y) && y >= -90 && y <= 90 && x >= -180 && x <= 180) {
      return { latitude: y, longitude: x };
    }
  }
  return null;
}

// ── Core geocode call ─────────────────────────────────────────────────────────

/**
 * Geocode a US street address via the Census Bureau geocoder.
 *
 * NEVER throws: network errors, timeouts (2.5s AbortController cap), non-2xx
 * responses, and unparseable payloads all return `{ status: "error" }`. A
 * well-formed response with zero matches returns `{ status: "no_match" }`.
 */
export async function geocodeAddress(input: CensusGeocodeInput): Promise<CensusGeocodeResult> {
  const street = normalizePart(input.street);
  const city = normalizePart(input.city);
  const state = normalizePart(input.state);
  if (!street || !city || !state) return { status: "no_match" };

  const key = normalizeAddressKey(input);
  const cached = cacheGet(key);
  if (cached) return cached;

  const oneline = [input.street.trim(), input.city.trim(), input.state.trim(), input.zip?.trim()]
    .filter(Boolean)
    .join(", ");
  const url = `${CENSUS_GEOCODER_URL}?address=${encodeURIComponent(
    oneline,
  )}&benchmark=Public_AR_Current&format=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { status: "error" };
    const payload: unknown = await res.json();
    const match = extractFirstMatch(payload);
    const result: CensusGeocodeResult = match
      ? { status: "ok", latitude: match.latitude, longitude: match.longitude }
      : { status: "no_match" };
    cacheSet(key, result);
    return result;
  } catch {
    // Network failure, AbortError (timeout), or JSON parse failure.
    return { status: "error" };
  } finally {
    clearTimeout(timer);
  }
}

// ── Persist-path entry point for the address routes ───────────────────────────

export interface GeocodeFallbackFields {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Decide whether the geocode fallback should run for an address create/update
 * payload, run it, and return the coordinate fields to merge into the persisted
 * data — or `null` when nothing should change (caller persists exactly what it
 * already had, i.e. null coordinates).
 *
 * Rules:
 *  - NEVER overwrites coordinates the user/Places already provided — if either
 *    latitude or longitude is present we do nothing (no network call at all).
 *  - Requires street + city + state; otherwise the geocoder can't produce a
 *    trustworthy match and we skip silently.
 *  - On "no_match"/"error"/timeout returns null — fail-open, no user-facing
 *    error, the address saves with null coordinates exactly as before.
 *
 * Emits a single console.warn marker per attempt (status only, no PII) for
 * observability.
 */
export async function geocodeFallbackForPersist(
  fields: GeocodeFallbackFields,
): Promise<{ latitude: number; longitude: number } | null> {
  // Hard rule: never overwrite user/Places-provided coordinates.
  if (fields.latitude != null || fields.longitude != null) return null;

  const street = fields.street?.trim();
  const city = fields.city?.trim();
  const state = fields.state?.trim();
  if (!street || !city || !state) return null;

  const result = await geocodeAddress({ street, city, state, zip: fields.zip ?? null });
  // One-line observability marker — status only, never the address (PII).
  console.warn(`[census-geocoder] fallback geocode for manually-entered address: ${result.status}`);
  return result.status === "ok"
    ? { latitude: result.latitude, longitude: result.longitude }
    : null;
}

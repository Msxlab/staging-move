// EPA county radon zone lookup (EPA Map of Radon Zones).
// =============================================================================
// Part of the New Home Dossier: given an address's lat/lng, report the EPA
// radon zone of the county the point falls in, so the user knows whether a
// radon test is worth budgeting for at the new home.
//
// ZONE MEANING (EPA Map of Radon Zones, county-level):
//   Zone 1 — HIGHEST potential (predicted average indoor screening level
//            > 4 pCi/L, the EPA action level)
//   Zone 2 — moderate potential (2–4 pCi/L)
//   Zone 3 — low potential (< 2 pCi/L)
//
// DATA SOURCE — free and KEYLESS. We point-query EPA's "Report on the
// Environment" radon ArcGIS service (county polygons):
//
//   https://gispub.epa.gov/arcgis/rest/services/ORD/ROE_Radon/MapServer/0/query
//
// VERIFIED 2026-06-10: fetched the gispub.epa.gov services root, found
// ORD/ROE_Radon ("Radon Data", single polygon layer id 0, county-level,
// 3 zones), confirmed the layer fields (RadonZone double + CountyFIPS/
// CountyName/StateName), and ran a live point query (Austin TX →
// RadonZone 3, CountyFIPS 48453 "Travis"). Chosen over a static county-FIPS
// map because the live layer works, accepts 4326 point input directly (no
// separate county-FIPS resolution step needed), and stays current if EPA
// revises it. If the layer ever disappears, a vendored county-FIPS→zone
// table is the documented fallback (the underlying 1993 EPA zone map is
// effectively static).
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as fcc-isp.ts): this module
// NEVER throws into a user path. Network failure, timeout, or an unexpected
// payload yields `{ status: "error" }`; missing coordinates yield
// `{ status: "no_location" }`. Callers branch on `status` and fall back.
//
// HONESTY NOTE: the EPA zone is a county-level SCREENING prediction — homes
// with elevated radon are found in all three zones, and only a test of the
// actual home measures its level. Surface as "testing guidance", never as a
// per-home radon measurement, and never alarming.
// =============================================================================

// ── Public types ────────────────────────────────────────────────────────────

export type RadonLookupStatus =
  | "ok" // EPA answered; `zone` is authoritative (null = county not mapped)
  | "no_location" // no usable lat/lng — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

/** EPA radon zone. 1 = highest predicted potential, 3 = lowest. */
export type RadonZone = 1 | 2 | 3;

export interface RadonLookupResult {
  status: RadonLookupStatus;
  /** County radon zone (1 = highest potential) or null when unmapped/unknown. */
  zone: RadonZone | null;
  /** County display name (e.g. "Travis"), when reported — context for the UI. */
  countyName: string | null;
  /** 5-digit county FIPS, when reported — useful for joins/telemetry. */
  countyFips: string | null;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "EPA Map of Radon Zones";
    url: "https://www.epa.gov/radon";
  };
}

export interface RadonLookupInput {
  latitude?: number | null;
  longitude?: number | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

// Layer id 0 ("Radon Data") VERIFIED 2026-06-10 against the MapServer root
// JSON + a live point query. See the module header before changing this.
const RADON_QUERY_BASE = "https://gispub.epa.gov/arcgis/rest/services/ORD/ROE_Radon/MapServer/0/query";

const REQUEST_TIMEOUT_MS = 3000;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// The EPA radon zone map is effectively static (last revised decades ago),
// so a 7-day TTL is conservative.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: RadonLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): RadonLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: RadonLookupResult): void {
  // Only cache authoritative answers — never transient errors.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearRadonCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "EPA Map of Radon Zones",
  url: "https://www.epa.gov/radon",
} as const;

function degraded(status: RadonLookupStatus, reason: string): RadonLookupResult {
  return { status, zone: null, countyName: null, countyFips: null, reason, source: SOURCE };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** The layer stores RadonZone as a double; only exact 1/2/3 are valid zones. */
function parseRadonZone(raw: unknown): RadonZone | null {
  if (!isFiniteNumber(raw)) return null;
  return raw === 1 || raw === 2 || raw === 3 ? raw : null;
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
      throw new Error(`EPA radon request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface RawRadonFeature {
  attributes?: {
    RadonZone?: number | null;
    CountyFIPS?: string | null;
    CountyName?: string | null;
  } | null;
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the EPA radon zone of the county containing a point.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on network failure. Any
 * non-"ok" status means "no radon data — fall back / hide the section".
 */
export async function lookupRadonZone(input: RadonLookupInput): Promise<RadonLookupResult> {
  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // ~1.1km cache granularity — far finer than county-polygon resolution.
  const cacheKey = `radon:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "RadonZone,CountyFIPS,CountyName",
      returnGeometry: "false",
      f: "json",
    });
    const payload = await fetchJson(`${RADON_QUERY_BASE}?${params.toString()}`);

    if (!payload || typeof payload !== "object") {
      return degraded("error", "unexpected_response_shape");
    }
    const obj = payload as { error?: unknown; features?: unknown };
    // ArcGIS reports failures as HTTP 200 + an `error` object in the body.
    if (obj.error) return degraded("error", "arcgis_error_payload");
    if (!Array.isArray(obj.features)) return degraded("error", "unexpected_response_shape");

    const features = obj.features as RawRadonFeature[];
    let zone: RadonZone | null = null;
    let countyName: string | null = null;
    let countyFips: string | null = null;
    for (const feature of features) {
      const parsed = parseRadonZone(feature?.attributes?.RadonZone);
      if (parsed === null) continue;
      zone = parsed;
      countyName = (feature?.attributes?.CountyName || "").trim() || null;
      countyFips = (feature?.attributes?.CountyFIPS || "").trim() || null;
      break;
    }

    // No county polygon / no valid zone at this point = authoritative "not
    // mapped" (e.g. territories) — `zone: null`, never a fabricated zone.
    const result: RadonLookupResult = {
      status: "ok",
      zone,
      countyName,
      countyFips,
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "radon_request_failed";
    return degraded("error", reason);
  }
}

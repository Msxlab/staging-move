// NCES school district lookup (EDGE school-district boundary composites).
// =============================================================================
// Part of the New Home Dossier: given an address's lat/lng, report which
// public school district the point falls in so the user can research schools
// before/after a move.
//
// DATA SOURCE — free and KEYLESS. We point-query the NCES EDGE ArcGIS service:
//
//   https://nces.ed.gov/opengis/rest/services/School_District_Boundaries/
//     EDGE_SCHOOLDISTRICT_TL25_SY2425/MapServer/1/query
//
// VERIFIED 2026-06-10 by fetching the School_District_Boundaries folder root
// JSON (`?f=json`) and picking the newest composite boundary service
// (EDGE_SCHOOLDISTRICT_TL25_SY2425 — TIGER/Line 2025, school year 2024-25),
// then confirming its single layer (id 1) exposes the NAME ("Current school
// district name") and GEOID ("School district identifier" — the 7-digit NCES
// LEA id) fields. When NCES publishes a newer school year, re-run that root
// fetch and update NCES_DISTRICT_SERVICE / NCES_DISTRICT_LAYER_ID below.
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as fcc-isp.ts): this module
// NEVER throws into a user path. Network failure, timeout, or an unexpected
// payload yields `{ status: "error" }`; missing coordinates yield
// `{ status: "no_location" }`. Callers branch on `status` and fall back.
//
// HONESTY NOTE: boundaries describe the district a location is IN — they say
// nothing about school quality or enrollment eligibility (charters, magnets,
// intra-district choice). Surface as "district for this address", not as a
// school recommendation.
// =============================================================================

// ── Public types ────────────────────────────────────────────────────────────

export type SchoolDistrictLookupStatus =
  | "ok" // EDGE answered; district fields are authoritative (nulls = no district mapped)
  | "no_location" // no usable lat/lng — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

export interface SchoolDistrictLookupResult {
  status: SchoolDistrictLookupStatus;
  /** District display name (e.g. "Orleans Parish School District") or null. */
  districtName: string | null;
  /** 7-digit NCES LEA identifier (GEOID) or null. */
  ncesId: string | null;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "NCES EDGE School District Boundaries";
    url: "https://nces.ed.gov/programs/edge/";
  };
}

export interface SchoolDistrictLookupInput {
  latitude?: number | null;
  longitude?: number | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

// Service + layer VERIFIED 2026-06-10 (newest composite, single layer id 1).
// See the module header before changing these.
const NCES_DISTRICT_SERVICE = "EDGE_SCHOOLDISTRICT_TL25_SY2425";
const NCES_DISTRICT_LAYER_ID = 1;
const NCES_QUERY_BASE = `https://nces.ed.gov/opengis/rest/services/School_District_Boundaries/${NCES_DISTRICT_SERVICE}/MapServer/${NCES_DISTRICT_LAYER_ID}/query`;

const REQUEST_TIMEOUT_MS = 3000;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// District boundaries change once a school year, so a 7-day TTL is safe.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: SchoolDistrictLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): SchoolDistrictLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: SchoolDistrictLookupResult): void {
  // Only cache authoritative answers — never transient errors.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearSchoolDistrictCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "NCES EDGE School District Boundaries",
  url: "https://nces.ed.gov/programs/edge/",
} as const;

function degraded(status: SchoolDistrictLookupStatus, reason: string): SchoolDistrictLookupResult {
  return { status, districtName: null, ncesId: null, reason, source: SOURCE };
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
      throw new Error(`NCES EDGE request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface RawEdgeFeature {
  attributes?: {
    NAME?: string | null;
    GEOID?: string | null;
  } | null;
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the public school district containing a point.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on network failure. Any
 * non-"ok" status means "no district data — fall back / hide the section".
 */
export async function lookupSchoolDistrict(
  input: SchoolDistrictLookupInput,
): Promise<SchoolDistrictLookupResult> {
  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // ~11m cache granularity — far finer than district-boundary resolution.
  const cacheKey = `district:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "NAME,GEOID",
      returnGeometry: "false",
      f: "json",
    });
    const payload = await fetchJson(`${NCES_QUERY_BASE}?${params.toString()}`);

    if (!payload || typeof payload !== "object") {
      return degraded("error", "unexpected_response_shape");
    }
    const obj = payload as { error?: unknown; features?: unknown };
    // ArcGIS reports failures as HTTP 200 + an `error` object in the body.
    if (obj.error) return degraded("error", "arcgis_error_payload");
    if (!Array.isArray(obj.features)) return degraded("error", "unexpected_response_shape");

    const features = obj.features as RawEdgeFeature[];
    let districtName: string | null = null;
    let ncesId: string | null = null;
    for (const feature of features) {
      const name = (feature?.attributes?.NAME || "").trim();
      if (!name) continue;
      districtName = name;
      ncesId = (feature?.attributes?.GEOID || "").trim() || null;
      break;
    }

    const result: SchoolDistrictLookupResult = {
      status: "ok",
      districtName,
      ncesId,
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "nces_request_failed";
    return degraded("error", reason);
  }
}

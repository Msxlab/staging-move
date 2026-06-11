// Nearby public-school directory lookup (HIFLD / ORNL "Public Schools").
// =============================================================================
// Part of the Pro "Neighborhood Intelligence" dossier section: given an
// address's lat/lng, list the nearest OPEN public schools (name + grade level)
// so a mover can see what schools are around the new home.
//
// This complements nces-district.ts (which returns the district a point falls
// in). The repo's existing NCES EDGE geocode point file carries NAME + address
// but NO grade-level field, so for the name+level directory we point-query the
// keyless HIFLD/ORNL "Public Schools" ArcGIS feature service, which exposes
// LEVEL_ (ELEMENTARY/MIDDLE/HIGH/OTHER) and STATUS (1 = open):
//
//   https://services.arcgis.com/XG15cJAlne2vxtgt/ArcGIS/rest/services/Public_Schools/FeatureServer/3/query
//
// VERIFIED 2026-06-11 with a live distance query (Austin TX x=-97.7431
// y=30.2672, distance=5000 units=esriSRUnit_Meter → open schools with NAME +
// LEVEL_ + ST_GRADE/END_GRADE). Sourced from NCES CCD + DHS/ORNL.
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as nces-district.ts): this
// module NEVER throws into a user path. Network failure, timeout, or an
// unexpected payload yields `{ status: "error" }`; missing coordinates yield
// `{ status: "no_location" }`. Callers branch on `status` and fall back.
//
// HONESTY NOTE: this is DIRECTORY data only — school name, grade level, and
// location. There are NO quality ratings here (and we never fabricate one);
// the level is "NOT REPORTED" for some rows and is reported as null, never
// guessed. Surface as "public schools near this address", never as a ranking.
// =============================================================================

// ── Public types ────────────────────────────────────────────────────────────

export type NearbySchoolsLookupStatus =
  | "ok" // service answered; `schools` is authoritative (may be empty)
  | "no_location" // no usable lat/lng — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

/** Normalized grade level; null when the source did not report a usable level. */
export type SchoolLevel = "Elementary" | "Middle" | "High" | "Other" | null;

export interface NearbySchool {
  /** School name (e.g. "Hill Elementary"). */
  name: string;
  /** Normalized grade level, or null when not reported (never guessed). */
  level: SchoolLevel;
}

export interface NearbySchoolsLookupResult {
  status: NearbySchoolsLookupStatus;
  /** Nearest open public schools, closest first, capped at MAX_SCHOOLS. */
  schools: NearbySchool[];
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "NCES / HIFLD Public Schools";
    url: "https://nces.ed.gov/programs/edge/";
  };
}

export interface NearbySchoolsLookupInput {
  latitude?: number | null;
  longitude?: number | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

// Service + layer VERIFIED 2026-06-11 (FeatureServer layer 3, fields NAME /
// LEVEL_ / STATUS). See the module header before changing this.
const SCHOOLS_QUERY_BASE =
  "https://services.arcgis.com/XG15cJAlne2vxtgt/ArcGIS/rest/services/Public_Schools/FeatureServer/3/query";

// Search radius around the address (meters). 5km captures the local schools a
// mover cares about without pulling a whole district's worth of rows.
const SEARCH_RADIUS_M = 5000;
// Ask for a bounded page; we sort by distance and keep the nearest few.
const RESULT_RECORD_COUNT = 40;
const MAX_SCHOOLS = 6;

const REQUEST_TIMEOUT_MS = 3500;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// The public-school directory changes about once a school year, so a 7-day TTL
// is safe.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: NearbySchoolsLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): NearbySchoolsLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: NearbySchoolsLookupResult): void {
  // Only cache authoritative answers — never transient errors.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearNearbySchoolsCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "NCES / HIFLD Public Schools",
  url: "https://nces.ed.gov/programs/edge/",
} as const;

function degraded(status: NearbySchoolsLookupStatus, reason: string): NearbySchoolsLookupResult {
  return { status, schools: [], reason, source: SOURCE };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Normalize the source LEVEL_ enum to a clean grade level. Unknown / "NOT
 * REPORTED" / blank → null (never guessed). Exported for tests.
 */
export function normalizeSchoolLevel(raw: unknown): SchoolLevel {
  if (typeof raw !== "string") return null;
  switch (raw.trim().toUpperCase()) {
    case "ELEMENTARY":
      return "Elementary";
    case "MIDDLE":
      return "Middle";
    case "HIGH":
      return "High";
    case "OTHER":
      return "Other";
    default:
      // "NOT REPORTED", "", "M" (missing), or anything unexpected → unknown.
      return null;
  }
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
      throw new Error(`Public schools request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface RawSchoolFeature {
  attributes?: {
    NAME?: string | null;
    LEVEL_?: string | null;
    STATUS?: number | string | null;
  } | null;
  geometry?: { x?: number | null; y?: number | null } | null;
}

/** STATUS is 1 for open schools; the field arrives as a number or a string. */
function isOpen(status: unknown): boolean {
  return status === 1 || status === "1";
}

/**
 * Reduce raw ArcGIS features to the nearest, de-duplicated, named open schools.
 * Sorts by squared planar distance from the query point (fine for a few-km
 * radius) so the closest schools surface first. Exported for tests.
 */
export function selectNearbySchools(
  features: RawSchoolFeature[],
  lat: number,
  lng: number,
): NearbySchool[] {
  const scored: Array<{ name: string; level: SchoolLevel; dist: number }> = [];
  const seen = new Set<string>();
  for (const feature of features) {
    if (!isOpen(feature?.attributes?.STATUS)) continue;
    const name = (feature?.attributes?.NAME || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const x = feature?.geometry?.x;
    const y = feature?.geometry?.y;
    // Missing geometry sorts last (Infinity) but the school is still listed.
    const dist =
      isFiniteNumber(x) && isFiniteNumber(y) ? (x - lng) ** 2 + (y - lat) ** 2 : Number.POSITIVE_INFINITY;
    scored.push({ name, level: normalizeSchoolLevel(feature?.attributes?.LEVEL_), dist });
  }
  scored.sort((a, b) => a.dist - b.dist);
  return scored.slice(0, MAX_SCHOOLS).map(({ name, level }) => ({ name, level }));
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * List the nearest open public schools (name + level) around a point.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on network failure. Any
 * non-"ok" status means "no school list — fall back / hide the list".
 */
export async function lookupNearbySchools(
  input: NearbySchoolsLookupInput,
): Promise<NearbySchoolsLookupResult> {
  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // ~110m cache granularity — neighborhood-level, far coarser than the radius.
  const cacheKey = `schools:${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      where: "STATUS=1",
      geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      distance: String(SEARCH_RADIUS_M),
      units: "esriSRUnit_Meter",
      outFields: "NAME,LEVEL_,STATUS",
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: String(RESULT_RECORD_COUNT),
      f: "json",
    });
    const payload = await fetchJson(`${SCHOOLS_QUERY_BASE}?${params.toString()}`);

    if (!payload || typeof payload !== "object") {
      return degraded("error", "unexpected_response_shape");
    }
    const obj = payload as { error?: unknown; features?: unknown };
    // ArcGIS reports failures as HTTP 200 + an `error` object in the body.
    if (obj.error) return degraded("error", "arcgis_error_payload");
    if (!Array.isArray(obj.features)) return degraded("error", "unexpected_response_shape");

    const schools = selectNearbySchools(obj.features as RawSchoolFeature[], lat, lng);
    const result: NearbySchoolsLookupResult = {
      status: "ok",
      schools,
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "schools_request_failed";
    return degraded("error", reason);
  }
}

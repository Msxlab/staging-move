// EPA National Walkability Index lookup (Smart Location Database).
// =============================================================================
// Part of the Pro "Neighborhood Intelligence" dossier section: given an
// address's lat/lng, report the EPA National Walkability Index for the Census
// block group the point falls in, so a mover can gauge how walkable the new
// area is before a move.
//
// SCORE MEANING (EPA National Walkability Index, June 2021 methodology guide,
// 1–20 scale, block-group level):
//   1.00 – 5.75   — Least walkable
//   5.76 – 10.50  — Below average walkable
//   10.51 – 15.25 — Above average walkable
//   15.26 – 20.00 — Most walkable
//
// DATA SOURCE — free and KEYLESS. We point-query EPA's Smart Location /
// Walkability Index ArcGIS service (block-group polygons):
//
//   https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query
//
// VERIFIED 2026-06-11 with a live point query (Austin TX x=-97.7431 y=30.2672,
// inSR=4326 → features[0].attributes.NatWalkInd = 18.83 for block group
// GEOID20 484530011001, "Most walkable" bin). Service details: OA/WalkabilityIndex,
// type MapServer (NOT FeatureServer — the path must include /MapServer/0/query),
// layer id 0 ("NationalWalkabilityIndex"), block-group polygons (Census 2019).
// The key field is NatWalkInd (esriFieldTypeDouble). If the service ever moves,
// the mirror host ozoneairqualitystandards.epa.gov serves the same service.
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as epa-radon.ts): this
// module NEVER throws into a user path. Network failure, timeout, or an
// unexpected payload yields `{ status: "error" }`; missing coordinates yield
// `{ status: "no_location" }`. Callers branch on `status` and fall back.
//
// HONESTY NOTE: the index is a block-group AVERAGE built from intersection
// density, transit access, and land-use mix — it describes the surrounding
// area, not the specific street or address. Surface as area context, never as
// a per-home score.
// =============================================================================

// ── Public types ────────────────────────────────────────────────────────────

export type WalkabilityLookupStatus =
  | "ok" // EPA answered; `score` is authoritative (null = block group unmapped)
  | "no_location" // no usable lat/lng — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

/** Coarse plain-English band for the index, per the EPA methodology bins. */
export type WalkabilityBand =
  | "least"
  | "below_average"
  | "above_average"
  | "most"
  | "unknown";

export interface WalkabilityLookupResult {
  status: WalkabilityLookupStatus;
  /** National Walkability Index (1–20) or null when the area is unmapped. */
  score: number | null;
  /** Coarse band for the score, per the EPA June 2021 methodology bins. */
  band: WalkabilityBand;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "EPA National Walkability Index";
    url: "https://www.epa.gov/smartgrowth/smart-location-mapping";
  };
}

export interface WalkabilityLookupInput {
  latitude?: number | null;
  longitude?: number | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

// Service + layer VERIFIED 2026-06-11 (MapServer, layer id 0, field NatWalkInd).
// See the module header before changing this.
const WALKABILITY_QUERY_BASE =
  "https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query";

const REQUEST_TIMEOUT_MS = 3500;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// The walkability index is recomputed only when the EPA republishes the Smart
// Location Database (years apart), so a 7-day TTL is conservative.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: WalkabilityLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): WalkabilityLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: WalkabilityLookupResult): void {
  // Only cache authoritative answers — never transient errors.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearWalkabilityCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "EPA National Walkability Index",
  url: "https://www.epa.gov/smartgrowth/smart-location-mapping",
} as const;

function degraded(status: WalkabilityLookupStatus, reason: string): WalkabilityLookupResult {
  return { status, score: null, band: "unknown", reason, source: SOURCE };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Map a 1–20 index to its EPA methodology band; null/out-of-range → unknown. */
export function classifyWalkBand(score: number | null): WalkabilityBand {
  if (score === null || !isFiniteNumber(score) || score < 1 || score > 20) return "unknown";
  if (score <= 5.75) return "least";
  if (score <= 10.5) return "below_average";
  if (score <= 15.25) return "above_average";
  return "most";
}

/** NatWalkInd is an esriFieldTypeDouble; only a finite 1–20 value is usable. */
export function parseWalkScore(raw: unknown): number | null {
  if (!isFiniteNumber(raw)) return null;
  if (raw < 1 || raw > 20) return null;
  // One decimal is plenty of resolution for a 1–20 index.
  return Math.round(raw * 10) / 10;
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
      throw new Error(`EPA walkability request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface RawWalkFeature {
  attributes?: {
    NatWalkInd?: number | null;
  } | null;
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the EPA National Walkability Index for the block group at a point.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on network failure. Any
 * non-"ok" status means "no walkability data — fall back / hide the row".
 */
export async function lookupWalkability(input: WalkabilityLookupInput): Promise<WalkabilityLookupResult> {
  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // ~11m cache granularity — far finer than block-group resolution.
  const cacheKey = `walk:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      // ArcGIS rejects a geometry-only query from some clients; pair it with a
      // trivially-true where (the verified call did the same).
      where: "1=1",
      geometry: JSON.stringify({ x: lng, y: lat }),
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "NatWalkInd",
      returnGeometry: "false",
      f: "json",
    });
    const payload = await fetchJson(`${WALKABILITY_QUERY_BASE}?${params.toString()}`);

    if (!payload || typeof payload !== "object") {
      return degraded("error", "unexpected_response_shape");
    }
    const obj = payload as { error?: unknown; features?: unknown };
    // ArcGIS reports failures as HTTP 200 + an `error` object in the body.
    if (obj.error) return degraded("error", "arcgis_error_payload");
    if (!Array.isArray(obj.features)) return degraded("error", "unexpected_response_shape");

    const features = obj.features as RawWalkFeature[];
    let score: number | null = null;
    for (const feature of features) {
      const parsed = parseWalkScore(feature?.attributes?.NatWalkInd);
      if (parsed === null) continue;
      score = parsed;
      break;
    }

    // No block-group polygon at this point (offshore / territories) =
    // authoritative "not mapped" — `score: null`, never a fabricated index.
    const result: WalkabilityLookupResult = {
      status: "ok",
      score,
      band: classifyWalkBand(score),
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "walkability_request_failed";
    return degraded("error", reason);
  }
}

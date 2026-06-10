// FEMA flood zone lookup (National Flood Hazard Layer / NFHL).
// =============================================================================
// Part of the New Home Dossier: given an address's lat/lng, report the FEMA
// flood zone designation at that point so the user can see whether their new
// home sits in a Special Flood Hazard Area (where flood insurance is typically
// required for federally backed mortgages).
//
// DATA SOURCE — free and KEYLESS. We query the public NFHL ArcGIS MapServer:
//
//   https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query
//
// Layer 28 is the "Flood Hazard Zones" polygon layer. VERIFIED 2026-06-10 by
// fetching the MapServer root JSON (`?f=json`) and matching the layer named
// "Flood Hazard Zones" → id 28. If FEMA ever renumbers its layers, re-run that
// root fetch and update NFHL_FLOOD_ZONES_LAYER_ID below.
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as fcc-isp.ts): this module
// NEVER throws into a user path. Network failure, timeout, or an unexpected
// payload yields `{ status: "error" }`; missing coordinates yield
// `{ status: "no_location" }`. Callers branch on `status` and fall back.
//
// HONESTY NOTE: NFHL coverage is not nationwide. A point outside every mapped
// polygon (or in a FLD_ZONE of "AREA NOT INCLUDED") means "no mapped flood
// data here", NOT "no flood risk" — we report `zone: null, isHighRisk: null`
// for those so the UI never fabricates a "minimal risk" claim.
// =============================================================================

// ── Public types ────────────────────────────────────────────────────────────

export type FloodLookupStatus =
  | "ok" // NFHL answered; `zone`/`isHighRisk` are authoritative (nulls = unmapped area)
  | "no_location" // no usable lat/lng — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

export interface FloodLookupResult {
  status: FloodLookupStatus;
  /** FEMA flood zone designation (e.g. "AE", "VE", "X") or null when unmapped/unknown. */
  zone: string | null;
  /** Zone subtype detail (e.g. "0.2 PCT ANNUAL CHANCE FLOOD HAZARD") when reported. */
  zoneSubtype: string | null;
  /**
   * true = Special Flood Hazard Area (zones starting with "A" or "V");
   * false = mapped but outside the SFHA (e.g. zone "X" = minimal);
   * null = no mapped zone at this point — risk is UNKNOWN, not minimal.
   */
  isHighRisk: boolean | null;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "FEMA National Flood Hazard Layer";
    url: "https://hazards.fema.gov/";
  };
}

export interface FloodLookupInput {
  latitude?: number | null;
  longitude?: number | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

// Layer id VERIFIED 2026-06-10 against the MapServer root JSON ("Flood Hazard
// Zones"). See the module header before changing this.
const NFHL_FLOOD_ZONES_LAYER_ID = 28;
const NFHL_QUERY_BASE = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/${NFHL_FLOOD_ZONES_LAYER_ID}/query`;

const REQUEST_TIMEOUT_MS = 3000;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// Flood zone maps change on regulatory timescales (months/years), so a 7-day
// TTL is safe. Best-effort process-local cache, same trade-offs as fcc-isp.ts.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: FloodLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): FloodLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: FloodLookupResult): void {
  // Only cache authoritative answers — never transient errors.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearFloodCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "FEMA National Flood Hazard Layer",
  url: "https://hazards.fema.gov/",
} as const;

function degraded(status: FloodLookupStatus, reason: string): FloodLookupResult {
  return { status, zone: null, zoneSubtype: null, isHighRisk: null, reason, source: SOURCE };
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
      throw new Error(`NFHL request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Special Flood Hazard Area test. FEMA's high-risk zones all start with "A"
 * (riverine/lake) or "V" (coastal wave action): A, AE, AH, AO, AR, A99, V, VE.
 * Multi-word sentinel values like "AREA NOT INCLUDED" are filtered out by the
 * caller before this runs.
 */
function isSpecialFloodHazardZone(zone: string): boolean {
  return /^[AV]/.test(zone);
}

interface RawNfhlFeature {
  attributes?: {
    FLD_ZONE?: string | null;
    ZONE_SUBTY?: string | null;
  } | null;
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the FEMA flood zone at a point.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on network failure. Any
 * non-"ok" status means "no flood data — fall back / hide the section".
 */
export async function lookupFloodZone(input: FloodLookupInput): Promise<FloodLookupResult> {
  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // ~11m cache granularity — far finer than flood-zone polygon resolution.
  const cacheKey = `flood:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FLD_ZONE,ZONE_SUBTY",
      returnGeometry: "false",
      f: "json",
    });
    const payload = await fetchJson(`${NFHL_QUERY_BASE}?${params.toString()}`);

    if (!payload || typeof payload !== "object") {
      return degraded("error", "unexpected_response_shape");
    }
    const obj = payload as { error?: unknown; features?: unknown };
    // ArcGIS reports failures as HTTP 200 + an `error` object in the body.
    if (obj.error) return degraded("error", "arcgis_error_payload");
    if (!Array.isArray(obj.features)) return degraded("error", "unexpected_response_shape");

    const features = obj.features as RawNfhlFeature[];
    let zone: string | null = null;
    let zoneSubtype: string | null = null;
    for (const feature of features) {
      const rawZone = (feature?.attributes?.FLD_ZONE || "").trim().toUpperCase();
      if (!rawZone) continue;
      // "AREA NOT INCLUDED" = explicitly unmapped — same as no feature at all.
      if (rawZone === "AREA NOT INCLUDED") continue;
      zone = rawZone;
      zoneSubtype = (feature?.attributes?.ZONE_SUBTY || "").trim() || null;
      break;
    }

    const result: FloodLookupResult = {
      status: "ok",
      zone,
      zoneSubtype,
      // null zone = unmapped area → risk UNKNOWN (null), never "minimal".
      isHighRisk: zone === null ? null : isSpecialFloodHazardZone(zone),
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "nfhl_request_failed";
    return degraded("error", reason);
  }
}

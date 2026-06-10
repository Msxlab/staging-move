// FEMA National Risk Index (NRI) natural-hazard ratings lookup.
// =============================================================================
// Part of the New Home Dossier: given an address's lat/lng, report the FEMA
// National Risk Index ratings for the census tract the point falls in — the
// composite rating plus the few individual hazards rated at or above
// "Relatively Moderate" — so the user knows which natural hazards are worth
// reading up on before a move.
//
// DATA SOURCE — free and KEYLESS. We point-query FEMA's official NRI census
// tracts feature service (owner: FEMA_NationalRiskIndex on ArcGIS Online):
//
//   https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/
//     National_Risk_Index_Census_Tracts/FeatureServer/0/query
//
// VERIFIED 2026-06-10 by fetching the FeatureServer root JSON (`?f=json`) —
// single layer id 0 ("NRI_CensusTracts_Prod", polygons) — and the layer JSON,
// confirming the composite `RISK_RATNG` field plus all 18 per-hazard
// `*_RISKR` string rating fields listed in HAZARD_FIELDS below. (The legacy
// hazards.geoplatform.gov NRI MapServer no longer resolves; the AGOL feature
// service above is the one FEMA's own NRI map app uses.) If FEMA republishes
// the service, re-run that root fetch and update NRI_QUERY_BASE / the fields.
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as fcc-isp.ts): this module
// NEVER throws into a user path. Network failure, timeout, or an unexpected
// payload yields `{ status: "error" }`; missing coordinates yield
// `{ status: "no_location" }`. Callers branch on `status` and fall back.
//
// HONESTY NOTE: NRI ratings are RELATIVE comparisons across U.S. communities
// (risk = expected annual loss × social vulnerability ÷ resilience), not a
// prediction that a disaster will happen at this address. Surface as
// "compared with other U.S. communities", informational and never alarming.
// A tract with no qualifying hazards is a perfectly good answer.
// =============================================================================

// ── Public types ────────────────────────────────────────────────────────────

export type HazardRiskLookupStatus =
  | "ok" // NRI answered; ratings are authoritative (empty topRisks = nothing at/above moderate)
  | "no_location" // no usable lat/lng — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

export interface HazardTopRisk {
  /** Human-readable hazard label (e.g. "Hurricane", "Riverine Flooding"). */
  hazard: string;
  /** NRI rating string as published (e.g. "Very High", "Relatively Moderate"). */
  rating: string;
}

export interface HazardRiskLookupResult {
  status: HazardRiskLookupStatus;
  /**
   * Hazards rated at/above "Relatively Moderate" for this tract, worst-first,
   * capped at 3. Empty when nothing qualifies (a good answer, not a failure).
   */
  topRisks: HazardTopRisk[];
  /** Composite NRI rating (RISK_RATNG, e.g. "Very High") or null when unrated. */
  overallRating: string | null;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "FEMA National Risk Index";
    url: "https://hazards.fema.gov/nri/";
  };
}

export interface HazardRiskLookupInput {
  latitude?: number | null;
  longitude?: number | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

// Layer id 0 VERIFIED 2026-06-10 against the FeatureServer root JSON
// ("NRI_CensusTracts_Prod"). See the module header before changing this.
const NRI_QUERY_BASE =
  "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query";

const REQUEST_TIMEOUT_MS = 3000;

// The 18 NRI hazard rating fields, VERIFIED 2026-06-10 against the layer JSON.
// Order here is the stable tie-break order for equally rated hazards.
const HAZARD_FIELDS = [
  { field: "AVLN_RISKR", hazard: "Avalanche" },
  { field: "CFLD_RISKR", hazard: "Coastal Flooding" },
  { field: "CWAV_RISKR", hazard: "Cold Wave" },
  { field: "DRGT_RISKR", hazard: "Drought" },
  { field: "ERQK_RISKR", hazard: "Earthquake" },
  { field: "HAIL_RISKR", hazard: "Hail" },
  { field: "HWAV_RISKR", hazard: "Heat Wave" },
  { field: "HRCN_RISKR", hazard: "Hurricane" },
  { field: "ISTM_RISKR", hazard: "Ice Storm" },
  { field: "LNDS_RISKR", hazard: "Landslide" },
  { field: "LTNG_RISKR", hazard: "Lightning" },
  { field: "IFLD_RISKR", hazard: "Riverine Flooding" },
  { field: "SWND_RISKR", hazard: "Strong Wind" },
  { field: "TRND_RISKR", hazard: "Tornado" },
  { field: "TSUN_RISKR", hazard: "Tsunami" },
  { field: "VLCN_RISKR", hazard: "Volcanic Activity" },
  { field: "WFIR_RISKR", hazard: "Wildfire" },
  { field: "WNTW_RISKR", hazard: "Winter Weather" },
] as const;

// NRI rating scale, worst-first severity. Values like "No Rating",
// "Not Applicable", and "Insufficient Data" are intentionally absent — they
// never qualify as a top risk.
const RATING_SEVERITY: Record<string, number> = {
  "Very High": 5,
  "Relatively High": 4,
  "Relatively Moderate": 3,
  "Relatively Low": 2,
  "Very Low": 1,
};

const TOP_RISK_MIN_SEVERITY = RATING_SEVERITY["Relatively Moderate"];
const MAX_TOP_RISKS = 3;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// NRI data is republished roughly annually, so a 7-day TTL is safe.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: HazardRiskLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): HazardRiskLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: HazardRiskLookupResult): void {
  // Only cache authoritative answers — never transient errors.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearHazardRiskCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "FEMA National Risk Index",
  url: "https://hazards.fema.gov/nri/",
} as const;

function degraded(status: HazardRiskLookupStatus, reason: string): HazardRiskLookupResult {
  return { status, topRisks: [], overallRating: null, reason, source: SOURCE };
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
      throw new Error(`NRI request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

type RawNriAttributes = Record<string, unknown>;

interface RawNriFeature {
  attributes?: RawNriAttributes | null;
}

/**
 * Map a tract's raw attributes to the top-risk list: hazards rated at/above
 * "Relatively Moderate", sorted worst-first (severity desc, then the stable
 * HAZARD_FIELDS order), capped at MAX_TOP_RISKS. Unknown/sentinel rating
 * strings ("No Rating", "Insufficient Data", …) never qualify.
 */
export function extractTopRisks(attributes: RawNriAttributes): HazardTopRisk[] {
  const qualifying: Array<HazardTopRisk & { severity: number; order: number }> = [];
  HAZARD_FIELDS.forEach(({ field, hazard }, order) => {
    const raw = attributes[field];
    if (typeof raw !== "string") return;
    const rating = raw.trim();
    const severity = RATING_SEVERITY[rating];
    if (severity === undefined || severity < TOP_RISK_MIN_SEVERITY) return;
    qualifying.push({ hazard, rating, severity, order });
  });
  qualifying.sort((a, b) => b.severity - a.severity || a.order - b.order);
  return qualifying.slice(0, MAX_TOP_RISKS).map(({ hazard, rating }) => ({ hazard, rating }));
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the FEMA National Risk Index ratings for the census tract at a point.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on network failure. Any
 * non-"ok" status means "no hazard data — fall back / hide the section".
 */
export async function lookupHazardRisks(input: HazardRiskLookupInput): Promise<HazardRiskLookupResult> {
  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // ~11m cache granularity — far finer than census-tract resolution.
  const cacheKey = `nri:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: ["RISK_RATNG", ...HAZARD_FIELDS.map((h) => h.field)].join(","),
      returnGeometry: "false",
      f: "json",
    });
    const payload = await fetchJson(`${NRI_QUERY_BASE}?${params.toString()}`);

    if (!payload || typeof payload !== "object") {
      return degraded("error", "unexpected_response_shape");
    }
    const obj = payload as { error?: unknown; features?: unknown };
    // ArcGIS reports failures as HTTP 200 + an `error` object in the body.
    if (obj.error) return degraded("error", "arcgis_error_payload");
    if (!Array.isArray(obj.features)) return degraded("error", "unexpected_response_shape");

    const features = obj.features as RawNriFeature[];
    const attributes = features.find((f) => f?.attributes)?.attributes ?? null;

    // No tract polygon at this point (offshore / outside NRI coverage):
    // an authoritative "no data here", not an error.
    const overallRaw = attributes?.RISK_RATNG;
    const overall = typeof overallRaw === "string" ? overallRaw.trim() : "";
    const result: HazardRiskLookupResult = {
      status: "ok",
      topRisks: attributes ? extractTopRisks(attributes) : [],
      // Sentinels like "No Rating"/"Insufficient Data" are not a usable
      // composite rating — report null so the UI never shows them as a rating.
      overallRating: overall && RATING_SEVERITY[overall] !== undefined ? overall : null,
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "nri_request_failed";
    return degraded("error", reason);
  }
}

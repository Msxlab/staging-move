// FCC ISP serviceability lookup (FCC National Broadband Map / BDC).
// =============================================================================
// WHAT THIS SOLVES
// -----------------------------------------------------------------------------
// Internet providers are modeled as `live_address` coverage (see
// apps/web/src/lib/provider-matching.ts + the recommendation engine). That means
// the catalog can only ever say "check availability at your address" — it has no
// way to *confirm* an ISP actually serves a given ZIP/address. This is the #1
// data gap in the recommendation engine.
//
// This module closes that gap by querying the FCC National Broadband Map's
// Broadband Data Collection (BDC) public availability API for the fixed-broadband
// ISPs that report service at a location, so confirmed-serviceable ISPs can
// surface with an "available at your address" confidence instead of the generic
// "check availability".
//
// =============================================================================
// ⚠️  OWNER / PRODUCTION SETUP — READ THIS BEFORE RELYING ON FCC DATA
// -----------------------------------------------------------------------------
// This integration is GRACEFULLY DEGRADING and OFF by default. With nothing
// configured, `lookupFccIsps()` returns `{ status: "not_configured", ... }` and
// the recommendation engine keeps its current behavior (no crash, no broken
// recs). To turn it ON in production the owner must configure the following
// (all via the Runtime Config / deployment env — NEVER hardcode secrets here):
//
//   1. FCC_BDC_ENABLED = "true"
//        Master flag. Until this is "true" no FCC call is ever made.
//
//   2. FCC_BDC_API_KEY = <your FCC BDC API username/token>
//        The FCC BDC "Public Data API" requires a (free) registered API key.
//        Register at https://broadbandmap.fcc.gov/ → "Data Download / APIs" and
//        request a Public Data API key (FCC issues a username + token). Put the
//        token here. The endpoint + auth header below reflect the documented
//        BDC API; if the FCC changes its scheme, only this file needs updating.
//
//   3. GEOCODING (already required): converting a street address → lat/lng is
//        done by the EXISTING Google Maps integration (GOOGLE_MAPS_API_KEY, see
//        apps/web/src/lib/address-autocomplete.ts). The recommendations route
//        already passes saved-address lat/lng. The FCC location lookup needs a
//        block GEOID (census block). We resolve lat/lng → block GEOID via the
//        FCC's free Area/Block API (no key) — see `resolveBlockGeoid` below. No
//        new geocoding provider is required; if no coordinates are available we
//        fall back gracefully.
//
//   4. (Optional) FCC_BDC_API_BASE
//        Override the API base URL if the FCC moves the endpoint. Defaults to
//        the documented public host below.
//
// If ANY of the above is missing, or the network call fails/times out, this
// module returns a non-"ok" status and the caller MUST fall back to existing
// behavior. It throws only programmer errors, never on FCC/network failure.
//
// =============================================================================
// DATA / LEGAL NOTE
// -----------------------------------------------------------------------------
// BDC availability data is SELF-REPORTED by providers to the FCC and updated
// roughly twice a year. "Available" here means "the ISP reported service at this
// block" — it is strong evidence but not a guarantee of an installable line at
// the exact unit. Surface it as confidence, not a promise (the AVAILABLE_AT_-
// ADDRESS copy already says final plans/pricing are set by the provider). This
// module does NOT auto-update any provider account; it is read-only lookup.
// =============================================================================

import { normalizeIspName } from "@locateflow/shared";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

export { normalizeIspName };

// ── Public types ────────────────────────────────────────────────────────────

export type FccLookupStatus =
  | "ok" // FCC answered; `providers` is authoritative for this location
  | "not_configured" // flag off or API key missing — caller falls back
  | "no_location" // no usable lat/lng (or block) — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

export interface FccIspResult {
  /** Provider brand name as reported to the FCC (e.g. "Comcast", "AT&T"). */
  brandName: string;
  /** FCC provider id, when present — useful for future bulk-dataset joins. */
  providerId: string | null;
  /** Max advertised download Mbps reported for this location, if available. */
  maxDownloadMbps: number | null;
  /** Max advertised upload Mbps reported for this location, if available. */
  maxUploadMbps: number | null;
  /** Technology codes reported (FCC BDC tech codes), if available. */
  technologyCodes: number[];
}

export interface FccLookupResult {
  status: FccLookupStatus;
  /** Fixed-broadband ISPs reported available at the location. Empty unless ok. */
  providers: FccIspResult[];
  /** Lowercased, normalized brand names for fast membership checks by callers. */
  normalizedBrandNames: Set<string>;
  /** The block GEOID actually queried, when resolved (for debugging/telemetry). */
  blockGeoid: string | null;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution + freshness disclosure for the UI / audit trail. */
  source: {
    name: "FCC National Broadband Map (BDC)";
    url: "https://broadbandmap.fcc.gov/";
    selfReported: true;
  };
}

export interface FccLookupInput {
  latitude?: number | null;
  longitude?: number | null;
  /** Optional: a pre-resolved census block GEOID skips the area/block call. */
  blockGeoid?: string | null;
}

// ── Configuration (all via runtime config / env — no hardcoded secrets) ──────

const DEFAULT_FCC_BDC_API_BASE = "https://broadbandmap.fcc.gov/api/public/map";
// FCC "Area and Census Block API" — resolves a lat/lng → census block GEOID.
// This endpoint is free and key-less (it is the same service the public map
// front-end uses). Documented at https://broadbandmap.fcc.gov/ (Developer/API).
const FCC_BLOCK_API = "https://geo.fcc.gov/api/census/block/find";

const REQUEST_TIMEOUT_MS = 6000;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// FCC availability changes ~twice a year, so a long TTL is safe and keeps us far
// under any rate limits. This is a best-effort process-local cache; for a multi-
// instance deployment a shared cache (Redis) could be layered in later behind
// the same function signature — see scripts/ingest/ for the bulk path that makes
// per-request lookups unnecessary at scale.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 5000;

interface CacheEntry {
  expiresAt: number;
  value: FccLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): FccLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: FccLookupResult): void {
  // Only cache authoritative answers. Never cache transient errors / unconfigured
  // states — otherwise a single network blip would suppress FCC data for a week.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearFccCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "FCC National Broadband Map (BDC)",
  url: "https://broadbandmap.fcc.gov/",
  selfReported: true,
} as const;

function degraded(status: FccLookupStatus, reason: string, blockGeoid: string | null = null): FccLookupResult {
  return {
    status,
    providers: [],
    normalizedBrandNames: new Set<string>(),
    blockGeoid,
    reason,
    source: SOURCE,
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) {
      let detail = "";
      try {
        const text = await res.text();
        const parsed = JSON.parse(text) as { message?: unknown; status_code?: unknown };
        const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
        const statusCode = typeof parsed.status_code === "number" ? parsed.status_code : null;
        detail = message ? ` ${message}` : statusCode ? ` status_code=${statusCode}` : "";
      } catch {
        detail = "";
      }
      throw new Error(`FCC request failed: HTTP ${res.status}${detail}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve lat/lng → census block GEOID via the FCC's free, key-less Area/Block
 * API. Returns null on any failure so the caller degrades gracefully.
 */
async function resolveBlockGeoid(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url = `${FCC_BLOCK_API}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(
      longitude,
    )}&format=json&censusYear=2020`;
    const data = (await fetchJson(url)) as { Block?: { FIPS?: string | null } | null } | null;
    const fips = data?.Block?.FIPS;
    return typeof fips === "string" && fips.length >= 12 ? fips : null;
  } catch {
    return null;
  }
}

interface RawFccAvailabilityRow {
  // The BDC availability payload uses snake_case keys. We read defensively and
  // tolerate missing fields — only `brand_name`/provider_id is strictly needed.
  provider_id?: string | number | null;
  brand_name?: string | null;
  technology?: number | null;
  technology_code?: number | null;
  max_advertised_download_speed?: number | null;
  max_advertised_upload_speed?: number | null;
  // Fixed vs mobile + residential filter, when present.
  residential?: boolean | number | null;
  low_latency?: boolean | number | null;
}

// FCC BDC technology codes that represent *fixed* broadband (we exclude mobile
// 300/400 and satellite-only edge cases are kept since they are still service).
const FIXED_BROADBAND_TECH_CODES = new Set<number>([
  10, // Copper / DSL
  40, // Cable (DOCSIS)
  50, // Fiber to the premises
  60, // Geostationary satellite
  61, // Non-geostationary satellite
  70, // Unlicensed terrestrial fixed wireless
  71, // Licensed terrestrial fixed wireless
  72, // Licensed-by-rule terrestrial fixed wireless
]);

function parseAvailabilityRows(rows: RawFccAvailabilityRow[]): FccIspResult[] {
  const byProvider = new Map<string, FccIspResult>();

  for (const row of rows) {
    const brandName = (row.brand_name || "").trim();
    if (!brandName) continue;

    const tech = isFiniteNumber(row.technology)
      ? row.technology
      : isFiniteNumber(row.technology_code)
        ? row.technology_code
        : null;
    // Keep only fixed-broadband technologies when a code is present; if the
    // payload omits a tech code, keep the row (better to over-include than to
    // silently drop a real ISP).
    if (tech !== null && !FIXED_BROADBAND_TECH_CODES.has(tech)) continue;

    const providerId =
      row.provider_id === null || row.provider_id === undefined ? null : String(row.provider_id);
    const key = providerId || normalizeIspName(brandName);

    const existing = byProvider.get(key);
    const maxDown = isFiniteNumber(row.max_advertised_download_speed)
      ? row.max_advertised_download_speed
      : null;
    const maxUp = isFiniteNumber(row.max_advertised_upload_speed)
      ? row.max_advertised_upload_speed
      : null;

    if (existing) {
      // Same ISP can report multiple technologies/speed tiers at one block —
      // collapse into the best-advertised numbers and union the tech codes.
      if (maxDown !== null) existing.maxDownloadMbps = Math.max(existing.maxDownloadMbps ?? 0, maxDown);
      if (maxUp !== null) existing.maxUploadMbps = Math.max(existing.maxUploadMbps ?? 0, maxUp);
      if (tech !== null && !existing.technologyCodes.includes(tech)) existing.technologyCodes.push(tech);
    } else {
      byProvider.set(key, {
        brandName,
        providerId,
        maxDownloadMbps: maxDown,
        maxUploadMbps: maxUp,
        technologyCodes: tech !== null ? [tech] : [],
      });
    }
  }

  return [...byProvider.values()];
}

/**
 * Extract the availability row array from the FCC response. The BDC public map
 * API has historically wrapped results in `{ results: [...] }` or `{ data: [...] }`
 * or returned a bare array; we accept all three so a minor API shape change does
 * not break the integration.
 */
function extractRows(payload: unknown): RawFccAvailabilityRow[] | null {
  if (Array.isArray(payload)) return payload as RawFccAvailabilityRow[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as RawFccAvailabilityRow[];
    if (Array.isArray(obj.data)) return obj.data as RawFccAvailabilityRow[];
  }
  return null;
}

function extractPayloadError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const statusCode = typeof obj.status_code === "number" ? obj.status_code : null;
  if (statusCode === null || statusCode < 400) return null;
  const message = typeof obj.message === "string" && obj.message.trim() ? obj.message.trim() : "FCC payload error";
  return `FCC request failed: status_code=${statusCode} ${message}`;
}

// ── Configuration loader ─────────────────────────────────────────────────────

interface FccConfig {
  enabled: boolean;
  apiKey: string | null;
  username: string | null;
  apiBase: string;
}

/** Path segment the BDC availability call lives under, below the host. */
const FCC_BDC_API_PATH = "/api/public/map";

/**
 * Resolve the FCC BDC availability API base URL from the (optional) override.
 *
 * The admin runtime-config field normalizes URLs to their ORIGIN (it strips the
 * path) and won't store an empty value, so an override can realistically only
 * arrive as a bare host like "https://broadbandmap.fcc.gov". The availability
 * call lives under `/api/public/map`, so re-append that path whenever the
 * configured base has none — a host-only override still hits the right endpoint.
 * A non-URL value (e.g. a stray "true") degrades to the working default instead
 * of breaking every FCC call with a relative URL. An explicit non-root path is
 * respected (in case the FCC truly moves the endpoint). Idempotent for the
 * full default.
 */
export function normalizeFccApiBase(raw: string | null | undefined): string {
  const candidate = raw?.trim() || DEFAULT_FCC_BDC_API_BASE;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return DEFAULT_FCC_BDC_API_BASE;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_FCC_BDC_API_BASE;
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path === "" ? FCC_BDC_API_PATH : path}`;
}

async function loadFccConfig(): Promise<FccConfig> {
  // Read flags/keys from the same runtime-config resolver used by the rest of
  // the app (deployment env first, DB fallback). Never read raw secrets here.
  const [enabledRaw, apiKey, usernameRaw, apiBaseRaw] = await Promise.all([
    getRuntimeConfigValue("FCC_BDC_ENABLED").catch(() => null),
    getRuntimeConfigValue("FCC_BDC_API_KEY").catch(() => null),
    getRuntimeConfigValue("FCC_BDC_USERNAME").catch(() => null),
    getRuntimeConfigValue("FCC_BDC_API_BASE").catch(() => null),
  ]);
  return {
    enabled: (enabledRaw || "").trim().toLowerCase() === "true",
    apiKey: apiKey?.trim() || null,
    username: usernameRaw?.trim() || null,
    apiBase: normalizeFccApiBase(apiBaseRaw),
  };
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the fixed-broadband ISPs the FCC reports as available at a location.
 *
 * GRACEFUL DEGRADATION CONTRACT: this never throws on FCC/network failure. It
 * returns a result whose `status` tells the caller whether `providers` can be
 * trusted. Any non-"ok" status means "fall back to existing catalog behavior".
 */
export async function lookupFccIsps(input: FccLookupInput): Promise<FccLookupResult> {
  const config = await loadFccConfig();

  // (3) GRACEFUL DEGRADATION — unconfigured: no flag / no key → no-op.
  if (!config.enabled) return degraded("not_configured", "fcc_bdc_disabled");
  if (!config.apiKey) return degraded("not_configured", "fcc_bdc_api_key_missing");

  // Resolve a queryable census block.
  let blockGeoid = input.blockGeoid?.trim() || null;
  if (!blockGeoid) {
    const lat = input.latitude;
    const lng = input.longitude;
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
      return degraded("no_location", "no_coordinates_or_block");
    }
    blockGeoid = await resolveBlockGeoid(lat, lng);
    if (!blockGeoid) return degraded("no_location", "block_geoid_unresolved");
  }

  const cacheKey = `fcc:${blockGeoid}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    // Documented BDC public availability endpoint, keyed by census block. The
    // exact path/params can shift across BDC releases; this reflects the public
    // map's "broadband availability by block" call. If the owner overrides
    // FCC_BDC_API_BASE, only the host changes.
    const url = `${config.apiBase}/availability/fixed?block=${encodeURIComponent(blockGeoid)}`;
    const payload = await fetchJson(url, {
      headers: {
        // FCC's documented Public Data API scheme (spec rev 1.5) authenticates
        // with two headers: `username` (the FCC account email) + `hash_value`
        // (the token generated under "Manage API Access" on broadbandmap.fcc.gov).
        // We send those when FCC_BDC_USERNAME is configured, plus a Bearer
        // header as a tolerant fallback for endpoints that accept it.
        Authorization: `Bearer ${config.apiKey}`,
        hash_value: config.apiKey,
        ...(config.username ? { username: config.username } : {}),
      },
    });

    const payloadError = extractPayloadError(payload);
    if (payloadError) return degraded("error", payloadError, blockGeoid);

    const rows = extractRows(payload);
    if (!rows) return degraded("error", "unexpected_response_shape", blockGeoid);

    const providers = parseAvailabilityRows(rows);
    const result: FccLookupResult = {
      status: "ok",
      providers,
      normalizedBrandNames: new Set(providers.map((p) => normalizeIspName(p.brandName)).filter(Boolean)),
      blockGeoid,
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "fcc_request_failed";
    return degraded("error", reason, blockGeoid);
  }
}

/**
 * Convenience predicate used by the recommendations route: is `providerName`
 * among the FCC-confirmed ISPs in `result`? Uses normalized matching so catalog
 * names ("AT&T Internet") match FCC brand names ("AT&T"). Returns false for any
 * non-"ok" result, so callers can use it unconditionally.
 */
export function isIspServiceable(result: FccLookupResult, providerName: string | null | undefined): boolean {
  if (result.status !== "ok") return false;
  const normalized = normalizeIspName(providerName);
  if (!normalized) return false;
  if (result.normalizedBrandNames.has(normalized)) return true;
  // Fall back to a containment check for partial brand overlaps (e.g. catalog
  // "Xfinity" vs FCC "Comcast"/"Xfinity"): match when one normalized name is a
  // prefix of the other and both are reasonably specific.
  if (normalized.length < 4) return false;
  for (const fccName of result.normalizedBrandNames) {
    if (fccName.length < 4) continue;
    if (fccName.startsWith(normalized) || normalized.startsWith(fccName)) return true;
  }
  return false;
}

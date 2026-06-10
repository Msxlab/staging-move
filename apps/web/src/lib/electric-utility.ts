// Electric-utility serviceability lookup (OpenEI U.S. Utility Rate Database).
// =============================================================================
// WHAT THIS SOLVES
// -----------------------------------------------------------------------------
// Electric providers are territory-based monopolies, but the catalog can only
// model coarse coverage (state / ZIP-prefix / live_address), so recommendations
// can only ever say "check availability at your address" for them. This module
// is the electric mirror of the FCC ISP lookup (apps/web/src/lib/fcc-isp.ts):
// it queries the OpenEI U.S. Utility Rate Database (URDB) for the electric
// utility companies that file residential rates at a coordinate, so the
// utility that actually serves the user's destination can surface with an
// "available at your address" confidence instead of the generic copy.
//
// =============================================================================
// ⚠️  OWNER / PRODUCTION SETUP — READ THIS BEFORE RELYING ON OPENEI DATA
// -----------------------------------------------------------------------------
// This integration is GRACEFULLY DEGRADING and OFF by default. With nothing
// configured, `lookupElectricUtilities()` returns `{ status: "not_configured" }`
// and the recommendation engine keeps its current behavior (no crash, no broken
// recs). To turn it ON in production the owner must configure the following
// (all via the Runtime Config / deployment env — NEVER hardcode secrets here):
//
//   1. ELECTRIC_LOOKUP_ENABLED = "true"
//        Master flag. Until this is "true" no OpenEI call is ever made.
//
//   2. OPENEI_API_KEY = <your OpenEI API key>
//        Free, instant signup at https://openei.org/services/api/signup
//        (the OpenEI services use api.data.gov-style keys).
//
//   3. GEOCODING (already required): street address → lat/lng comes from the
//        EXISTING Google Maps integration (GOOGLE_MAPS_API_KEY). The
//        recommendations route already passes saved-address coordinates; if no
//        coordinates are available we fall back gracefully ("no_location").
//
// If ANY of the above is missing, or the network call fails/times out, this
// module returns a non-"ok" status and the caller MUST fall back to existing
// behavior. It throws only programmer errors, never on OpenEI/network failure.
//
// =============================================================================
// DATA / LEGAL NOTE
// -----------------------------------------------------------------------------
// URDB coverage is derived from utility rate filings and EIA service-territory
// data; it is strong evidence of which utility serves a coordinate, but not a
// guarantee of an energizable meter at the exact unit (territory borders and
// municipal carve-outs exist). Surface it as confidence, not a promise (the
// AVAILABLE_AT_ADDRESS copy already says final plans/availability are set by
// the provider). This module is read-only lookup — it never updates accounts.
// =============================================================================

import { getRuntimeConfigValue } from "@/lib/runtime-config";

// ── Public types ────────────────────────────────────────────────────────────

export type ElectricLookupStatus =
  | "ok" // OpenEI answered; `utilities` is authoritative for this location
  | "not_configured" // flag off or API key missing — caller falls back
  | "no_location" // no usable lat/lng — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

export interface ElectricUtilityCompany {
  /** Utility company name as filed in the URDB (e.g. "Austin Energy"). */
  name: string;
  /** EIA utility id, when present — useful for future bulk-dataset joins. */
  eiaId: string | null;
}

export interface ElectricLookupResult {
  status: ElectricLookupStatus;
  /** Distinct electric utilities serving the location. Empty unless ok. */
  utilities: ElectricUtilityCompany[];
  /** Lowercased, normalized utility names for fast membership checks by callers. */
  normalizedNames: Set<string>;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution + freshness disclosure for the UI / audit trail. */
  source: {
    name: "OpenEI U.S. Utility Rate Database (URDB)";
    url: "https://openei.org/wiki/Utility_Rate_Database";
    modeled: true;
  };
}

export interface ElectricLookupInput {
  latitude?: number | null;
  longitude?: number | null;
}

// ── Configuration (all via runtime config / env — no hardcoded secrets) ──────

// OpenEI URDB v7 endpoint. Stable, documented at
// https://openei.org/services/doc/rest/util_rates/ — sector=Residential +
// approved=true keeps the answer to real, current residential filings, and
// detail=minimal keeps the payload small (we only need utility name + eiaid).
const OPENEI_URDB_API = "https://api.openei.org/utility_rates";

const REQUEST_TIMEOUT_MS = 6000;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// Utility service territories change very rarely (annexations / mergers), so a
// long TTL is safe and keeps us far under OpenEI rate limits. Best-effort
// process-local cache, same trade-offs as the FCC module: a shared cache could
// be layered in later behind the same function signature.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 5000;

interface CacheEntry {
  expiresAt: number;
  value: ElectricLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): ElectricLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: ElectricLookupResult): void {
  // Only cache authoritative answers. Never cache transient errors / unconfigured
  // states — otherwise a single network blip would suppress the data for a week.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearElectricUtilityCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "OpenEI U.S. Utility Rate Database (URDB)",
  url: "https://openei.org/wiki/Utility_Rate_Database",
  modeled: true,
} as const;

function degraded(status: ElectricLookupStatus, reason: string): ElectricLookupResult {
  return {
    status,
    utilities: [],
    normalizedNames: new Set<string>(),
    reason,
    source: SOURCE,
  };
}

// Tokens that carry no brand identity in utility company names. Stripping them
// lets "Austin Energy" and "City of Austin" reduce to the same distinctive
// token ("austin"), while still refusing to match two names that share ONLY
// generic words. Same spirit as fcc-isp's normalizeIspName, but tuned for the
// municipal/co-op naming conventions of electric utilities.
const GENERIC_UTILITY_TOKENS = new Set<string>([
  "energy", "electric", "electrical", "electricity", "power", "utility", "utilities",
  "company", "co", "corp", "corporation", "inc", "incorporated", "llc", "ltd",
  "light", "lights", "lighting", "gas", "water", "and", "the", "of",
  "city", "town", "village", "county", "public", "service", "services",
  "department", "dept", "authority", "board", "district", "municipal",
  "cooperative", "coop", "association", "assn", "assoc", "membership",
  "rural", "works", "commission", "system",
]);

/**
 * Normalize a utility company name for cross-source equality checks: lowercase,
 * "&" → "and", strip generic utility words and all non-alphanumerics. Catalog
 * "Austin Energy" and URDB "City of Austin" both normalize to "austin".
 */
export function normalizeUtilityName(name: string | null | undefined): string {
  return [...significantUtilityTokens(name)].sort().join("");
}

/**
 * The distinctive (non-generic) tokens of a utility company name, lowercased.
 * Tokens shorter than 3 characters are dropped — they are almost always
 * initials/abbreviation noise and would make overlap matching too loose.
 */
export function significantUtilityTokens(name: string | null | undefined): Set<string> {
  if (!name) return new Set();
  const tokens = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC_UTILITY_TOKENS.has(token));
  return new Set(tokens);
}

/**
 * Conservative cross-source name match. Utility naming is fragile ("Austin
 * Energy" vs "City of Austin"), so we match on DISTINCTIVE-token overlap and
 * only flag clear matches:
 *   • both names must have at least one distinctive token, AND
 *   • every distinctive token of one name must appear in the other
 *     (subset relation — "Duke Energy" ⊆ "Duke Energy Indiana").
 * Names made up purely of generic words ("Public Service Co") never match
 * anything — better to keep the generic "check availability" copy than to
 * claim the wrong monopoly serves the address.
 */
export function utilityNamesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const tokensA = significantUtilityTokens(a);
  const tokensB = significantUtilityTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  const [small, large] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  for (const token of small) {
    if (!large.has(token)) return false;
  }
  return true;
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
      throw new Error(`OpenEI request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface RawUrdbItem {
  // URDB v7 items are rate filings; `utility` (company name) is the field we
  // need, `eiaid` when present lets us dedupe rigorously. Read defensively —
  // tolerate missing/renamed fields.
  utility?: string | null;
  utility_name?: string | null;
  eiaid?: string | number | null;
}

/**
 * Extract the rate-filing item array from the OpenEI response. URDB wraps
 * results in `{ items: [...] }`; accept `{ data: [...] }` and bare arrays too
 * so a minor API shape change does not break the integration.
 */
function extractItems(payload: unknown): RawUrdbItem[] | null {
  if (Array.isArray(payload)) return payload as RawUrdbItem[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as RawUrdbItem[];
    if (Array.isArray(obj.data)) return obj.data as RawUrdbItem[];
  }
  return null;
}

/** Collapse rate filings (many per utility) into distinct utility companies. */
function parseUtilityItems(items: RawUrdbItem[]): ElectricUtilityCompany[] {
  const byUtility = new Map<string, ElectricUtilityCompany>();

  for (const item of items) {
    const name = (item.utility || item.utility_name || "").trim();
    if (!name) continue;

    const eiaId =
      item.eiaid === null || item.eiaid === undefined || item.eiaid === ""
        ? null
        : String(item.eiaid);
    const key = eiaId || normalizeUtilityName(name) || name.toLowerCase();
    if (!byUtility.has(key)) {
      byUtility.set(key, { name, eiaId });
    }
  }

  return [...byUtility.values()];
}

// ── Configuration loader ─────────────────────────────────────────────────────

interface ElectricLookupConfig {
  enabled: boolean;
  apiKey: string | null;
}

async function loadElectricLookupConfig(): Promise<ElectricLookupConfig> {
  // Read flags/keys from the same runtime-config resolver used by the rest of
  // the app (deployment env first, DB fallback). Never read raw secrets here.
  const [enabledRaw, apiKey] = await Promise.all([
    getRuntimeConfigValue("ELECTRIC_LOOKUP_ENABLED").catch(() => null),
    getRuntimeConfigValue("OPENEI_API_KEY").catch(() => null),
  ]);
  return {
    enabled: (enabledRaw || "").trim().toLowerCase() === "true",
    apiKey: apiKey?.trim() || null,
  };
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the electric utilities the OpenEI URDB reports as serving a
 * coordinate.
 *
 * GRACEFUL DEGRADATION CONTRACT: this never throws on OpenEI/network failure.
 * It returns a result whose `status` tells the caller whether `utilities` can
 * be trusted. Any non-"ok" status means "fall back to existing catalog
 * behavior".
 */
export async function lookupElectricUtilities(input: ElectricLookupInput): Promise<ElectricLookupResult> {
  const config = await loadElectricLookupConfig();

  // GRACEFUL DEGRADATION — unconfigured: no flag / no key → no-op.
  if (!config.enabled) return degraded("not_configured", "electric_lookup_disabled");
  if (!config.apiKey) return degraded("not_configured", "openei_api_key_missing");

  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // ~111m cache granularity — far finer than any utility territory boundary,
  // while keeping nearby requests on the same cache entry.
  const cacheKey = `openei:${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `${OPENEI_URDB_API}?version=7&format=json` +
      `&api_key=${encodeURIComponent(config.apiKey)}` +
      `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
      `&sector=Residential&approved=true&limit=20&detail=minimal`;
    const payload = await fetchJson(url);

    const items = extractItems(payload);
    if (!items) return degraded("error", "unexpected_response_shape");

    const utilities = parseUtilityItems(items);
    const result: ElectricLookupResult = {
      status: "ok",
      utilities,
      normalizedNames: new Set(utilities.map((u) => normalizeUtilityName(u.name)).filter(Boolean)),
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "openei_request_failed";
    return degraded("error", reason);
  }
}

/**
 * Convenience predicate used by the recommendations route: does `providerName`
 * match one of the utilities confirmed at the location? Uses normalized
 * equality plus conservative distinctive-token-overlap matching so catalog
 * "Austin Energy" matches URDB "City of Austin". Returns false for any
 * non-"ok" result, so callers can use it unconditionally.
 */
export function isElectricUtilityServiceable(
  result: ElectricLookupResult,
  providerName: string | null | undefined,
): boolean {
  if (result.status !== "ok") return false;
  const normalized = normalizeUtilityName(providerName);
  if (!normalized) return false;
  if (result.normalizedNames.has(normalized)) return true;
  for (const utility of result.utilities) {
    if (utilityNamesMatch(providerName, utility.name)) return true;
  }
  return false;
}

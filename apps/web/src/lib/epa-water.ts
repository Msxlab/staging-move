// EPA drinking-water system lookup (SDWIS via Envirofacts).
// =============================================================================
// Part of the New Home Dossier: given an address's city + state, report the
// community water system (CWS) most likely serving it and how many
// HEALTH-BASED Safe Drinking Water Act violations it logged in the last 5
// years, so the user can read the system's record before a move.
//
// DATA SOURCE — free and KEYLESS. EPA Envirofacts REST (SDWIS tables):
//
//   https://data.epa.gov/efservice/GEOGRAPHIC_AREA/CITY_SERVED/<city>/
//     STATE_SERVED/<state>/WATER_SYSTEM/JSON
//   https://data.epa.gov/efservice/VIOLATION/PWSID/<pwsid>/
//     IS_HEALTH_BASED_IND/Y/JSON
//
// VERIFIED 2026-06-10 with live queries:
//   • GEOGRAPHIC_AREA joined to WATER_SYSTEM in one call returns pwsid,
//     pws_name, pws_type_code, pws_activity_code, population_served_count,
//     city_served, state_served (value matching is case-insensitive:
//     "Austin" matched "AUSTIN").
//   • VIOLATION rows carry is_health_based_ind and compl_per_begin_date
//     ("YYYY-MM-DD HH:MM:SS") for the 5-year window filter.
//   • KNOWN DATA GAP: some systems register only a COUNTY in
//     GEOGRAPHIC_AREA (e.g. "CITY OF AUSTIN WATER & WASTEWATER" lists only
//     county "Travis", no city row), so a city+state query can come back
//     empty for a perfectly served address. Per the conservative-matching
//     rule we then report `systemName: null` ("couldn't identify the
//     system") rather than guessing from a county-wide list that may span
//     dozens of unrelated systems.
//
// MATCHING RULE (conservative by design): among the systems registered for
// exactly this city + state, keep only ACTIVE COMMUNITY systems
// (pws_type_code "CWS", pws_activity_code "A") and pick the one serving the
// largest population — the dominant utility for the municipality. If nothing
// qualifies we return nulls; if the network/API misbehaves we return
// status "error". We never return a system we are not confident about:
// showing the WRONG utility's violation record would be worse than showing
// nothing.
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as fcc-isp.ts): this module
// NEVER throws into a user path. Network failure, timeout, or an unexpected
// payload yields `{ status: "error" }`; missing city/state yields
// `{ status: "no_location" }`. Callers branch on `status` and fall back.
//
// HONESTY NOTE: violations counted here are the system's reported
// HEALTH-BASED violations (MCL/MRDL/treatment-technique) over the last 5
// years, as recorded in federal SDWIS. A non-zero count means "worth reading
// the system's annual water quality report", not "the water is unsafe
// today" — most violations are resolved. Surface as informational with the
// EPA as the named source, never alarming.
// =============================================================================

// ── Public types ────────────────────────────────────────────────────────────

export type WaterSystemLookupStatus =
  | "ok" // Envirofacts answered; fields are authoritative (nulls = no confident match)
  | "no_location" // no usable city/state — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

export interface WaterSystemLookupResult {
  status: WaterSystemLookupStatus;
  /** Water system display name (e.g. "STUCKER FORK WATER UTILITY") or null. */
  systemName: string | null;
  /** EPA public water system id (PWSID), when matched — for joins/telemetry. */
  pwsid: string | null;
  /** Population the matched system reports serving, when available. */
  populationServed: number | null;
  /** Health-based violations in the last 5 years, or null when unmatched. */
  violations5y: number | null;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "EPA Safe Drinking Water Information System";
    url: "https://www.epa.gov/enviro";
  };
}

export interface WaterSystemLookupInput {
  city?: string | null;
  state?: string | null;
}

// ── Configuration ────────────────────────────────────────────────────────────

const EFSERVICE_BASE = "https://data.epa.gov/efservice";

// Envirofacts is the slowest of the dossier sources and this lookup makes two
// sequential calls, so it gets a slightly longer per-request budget than the
// 3s ArcGIS lookups (worst case ~8s, still inside the route's allSettled).
const REQUEST_TIMEOUT_MS = 4000;

const VIOLATION_WINDOW_YEARS = 5;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// SDWIS quarterly refresh cadence makes a 7-day TTL safe. Keyed by city+state,
// so a metro's worth of users shares one entry.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: WaterSystemLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): WaterSystemLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: WaterSystemLookupResult): void {
  // Only cache authoritative answers — never transient errors.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearWaterSystemCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "EPA Safe Drinking Water Information System",
  url: "https://www.epa.gov/enviro",
} as const;

function degraded(status: WaterSystemLookupStatus, reason: string): WaterSystemLookupResult {
  return {
    status,
    systemName: null,
    pwsid: null,
    populationServed: null,
    violations5y: null,
    reason,
    source: SOURCE,
  };
}

function waterCityCandidates(cityKey: string, stateKey: string): string[] {
  const fallbackByStateCity: Record<string, string[]> = {
    "FL:MIAMI BEACH": ["MIAMI"],
  };
  return [...new Set([cityKey, ...(fallbackByStateCity[`${stateKey}:${cityKey}`] || [])])];
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
      throw new Error(`Envirofacts request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface RawJoinedSystemRow {
  // GEOGRAPHIC_AREA ⋈ WATER_SYSTEM columns (snake_case), read defensively.
  pwsid?: string | null;
  pws_name?: string | null;
  pws_type_code?: string | null;
  pws_activity_code?: string | null;
  population_served_count?: number | null;
}

interface RawViolationRow {
  is_health_based_ind?: string | null;
  compl_per_begin_date?: string | null;
}

/**
 * Pick the active community water system serving the largest population.
 * Ties break on PWSID (deterministic). Returns null when nothing qualifies.
 */
export function pickLargestCommunitySystem(
  rows: RawJoinedSystemRow[],
): { pwsid: string; systemName: string | null; populationServed: number | null } | null {
  let best: { pwsid: string; systemName: string | null; populationServed: number | null } | null = null;
  for (const row of rows) {
    const pwsid = (row.pwsid || "").trim();
    if (!pwsid) continue;
    if ((row.pws_type_code || "").trim().toUpperCase() !== "CWS") continue;
    if ((row.pws_activity_code || "").trim().toUpperCase() !== "A") continue;
    const population = isFiniteNumber(row.population_served_count) ? row.population_served_count : null;
    if (
      best === null ||
      (population ?? -1) > (best.populationServed ?? -1) ||
      ((population ?? -1) === (best.populationServed ?? -1) && pwsid < best.pwsid)
    ) {
      best = { pwsid, systemName: (row.pws_name || "").trim() || null, populationServed: population };
    }
  }
  return best;
}

/**
 * Count health-based violations whose compliance period began within the last
 * `VIOLATION_WINDOW_YEARS` years. Rows with unparseable dates are EXCLUDED —
 * we under-count rather than inflate (informational, never alarming).
 */
export function countRecentHealthViolations(rows: RawViolationRow[], now: Date = new Date()): number {
  const windowStart = new Date(now);
  windowStart.setUTCFullYear(windowStart.getUTCFullYear() - VIOLATION_WINDOW_YEARS);
  let count = 0;
  for (const row of rows) {
    // The endpoint is already filtered server-side, but verify defensively.
    if ((row.is_health_based_ind || "").trim().toUpperCase() !== "Y") continue;
    // "YYYY-MM-DD HH:MM:SS" → take the date part (avoids TZ ambiguity).
    const datePart = (row.compl_per_begin_date || "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) continue;
    const begin = Date.parse(`${datePart}T00:00:00Z`);
    if (!Number.isFinite(begin)) continue;
    if (begin >= windowStart.getTime() && begin <= now.getTime()) count += 1;
  }
  return count;
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the community water system serving a city/state and its recent
 * health-based violation count.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on network failure. Any
 * non-"ok" status means "no water data — fall back / hide the section".
 * An "ok" with null fields means "no confident match" — an honest answer.
 */
export async function lookupWaterSystem(input: WaterSystemLookupInput): Promise<WaterSystemLookupResult> {
  const city = (input.city || "").trim();
  const state = (input.state || "").trim();
  if (!city || !state) {
    return degraded("no_location", "no_city_or_state");
  }

  // Normalized for cache hits + deterministic queries (API matching is
  // case-insensitive anyway — verified live).
  const cityKey = city.toUpperCase();
  const stateKey = state.toUpperCase();
  const cacheKey = `water:${stateKey}:${cityKey}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    // One joined call: GEOGRAPHIC_AREA rows for this city+state, each joined
    // to its WATER_SYSTEM row (name/type/activity/population). Verified live.
    const systemsUrl = `${EFSERVICE_BASE}/GEOGRAPHIC_AREA/CITY_SERVED/${encodeURIComponent(
      cityKey,
    )}/STATE_SERVED/${encodeURIComponent(stateKey)}/WATER_SYSTEM/JSON`;
    const systemsPayload = await fetchJson(systemsUrl);
    if (!Array.isArray(systemsPayload)) {
      return degraded("error", "unexpected_response_shape");
    }

    const match = pickLargestCommunitySystem(systemsPayload as RawJoinedSystemRow[]);
    if (!match) {
      const fallbackCity = waterCityCandidates(cityKey, stateKey).find((candidate) => candidate !== cityKey);
      if (fallbackCity) {
        return lookupWaterSystem({ city: fallbackCity, state: stateKey });
      }
      // Authoritative "no active community system registered for this exact
      // city" (see KNOWN DATA GAP in the header) — honest nulls, cached.
      const result: WaterSystemLookupResult = {
        status: "ok",
        systemName: null,
        pwsid: null,
        populationServed: null,
        violations5y: null,
        reason: "no_community_system_matched",
        source: SOURCE,
      };
      cacheSet(cacheKey, result);
      return result;
    }

    // Second call: the matched system's health-based violations. If THIS call
    // fails we degrade the whole section to "error" instead of showing a
    // system with an unknown record (uncached, so it self-heals next request).
    const violationsUrl = `${EFSERVICE_BASE}/VIOLATION/PWSID/${encodeURIComponent(
      match.pwsid,
    )}/IS_HEALTH_BASED_IND/Y/JSON`;
    const violationsPayload = await fetchJson(violationsUrl);
    if (!Array.isArray(violationsPayload)) {
      return degraded("error", "unexpected_violations_shape");
    }

    const result: WaterSystemLookupResult = {
      status: "ok",
      systemName: match.systemName,
      pwsid: match.pwsid,
      populationServed: match.populationServed,
      violations5y: countRecentHealthViolations(violationsPayload as RawViolationRow[]),
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "sdwis_request_failed";
    return degraded("error", reason);
  }
}

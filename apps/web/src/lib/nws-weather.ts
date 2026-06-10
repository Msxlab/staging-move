// NWS move-day forecast lookup (api.weather.gov).
// =============================================================================
// Part of the New Home Dossier: when the user's move date is inside the NWS
// forecast horizon (~7 days), show the forecast at the DESTINATION address so
// they can plan the move day (rain, heat, etc.).
//
// DATA SOURCE — free and KEYLESS, two-step (verified 2026-06-10):
//
//   1. GET https://api.weather.gov/points/{lat},{lng}
//        → properties.forecast (a gridpoint forecast URL on api.weather.gov)
//   2. GET that forecast URL
//        → properties.periods[] — half-day periods (day + night) with
//          temperature, shortForecast, probabilityOfPrecipitation.
//
// The NWS API REQUIRES a User-Agent identifying the application; requests
// without one are rejected. We send "LocateFlow (support@locateflow.com)".
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as fcc-isp.ts): this module
// NEVER throws into a user path. Network failure, timeout, or an unexpected
// payload yields `{ status: "error" }`; missing coordinates yield
// `{ status: "no_location" }`; a target date beyond the returned forecast
// periods yields `{ status: "too_far" }`. Callers branch on `status`.
//
// HONESTY NOTE: this is a *forecast* — the UI must present it as such (it can
// and does change), never as a guarantee of move-day conditions.
// =============================================================================

// ── Public types ────────────────────────────────────────────────────────────

export type WeatherLookupStatus =
  | "ok" // NWS answered with a forecast for the target date
  | "no_location" // no usable lat/lng — caller falls back
  | "too_far" // target date beyond the available forecast periods
  | "error"; // network/parse/timeout/HTTP error — caller falls back

export interface WeatherLookupResult {
  status: WeatherLookupStatus;
  /** The forecast date (YYYY-MM-DD, local to the forecast point) or null. */
  forecastDate: string | null;
  /** Short conditions summary, e.g. "Partly Sunny then Slight Chance Showers". */
  summary: string | null;
  /** Daytime high in °F, when a daytime period exists for the date. */
  tempHighF: number | null;
  /** Overnight low in °F, when a nighttime period exists for the date. */
  tempLowF: number | null;
  /** Probability of precipitation (0-100) for the primary period, when given. */
  precipChancePct: number | null;
  /** Machine-readable reason when status !== "ok" (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "National Weather Service";
    url: "https://www.weather.gov/";
  };
}

export interface WeatherLookupInput {
  latitude?: number | null;
  longitude?: number | null;
  /** Target calendar date as YYYY-MM-DD (e.g. the moving plan's move date). */
  targetDate: string;
}

// ── Configuration ────────────────────────────────────────────────────────────

const NWS_API_BASE = "https://api.weather.gov";
// Hosts we accept for the step-2 forecast URL (it comes from the step-1
// response body — pin it to NWS so a tampered/odd payload can't make the
// server fetch an arbitrary URL).
const ALLOWED_FORECAST_HOST_SUFFIX = ".weather.gov";
// The NWS API requires an identifying User-Agent on every request.
const NWS_USER_AGENT = "LocateFlow (support@locateflow.com)";

const REQUEST_TIMEOUT_MS = 3000;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// Forecasts update throughout the day — keep the TTL short (~1h), unlike the
// 7-day TTLs used for the slow-moving flood/district datasets.
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: WeatherLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): WeatherLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: WeatherLookupResult): void {
  // Only cache authoritative answers — never transient errors.
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearWeatherCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "National Weather Service",
  url: "https://www.weather.gov/",
} as const;

function degraded(status: WeatherLookupStatus, reason: string): WeatherLookupResult {
  return {
    status,
    forecastDate: null,
    summary: null,
    tempHighF: null,
    tempLowF: null,
    precipChancePct: null,
    reason,
    source: SOURCE,
  };
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
      headers: {
        Accept: "application/geo+json, application/json",
        "User-Agent": NWS_USER_AGENT,
      },
    });
    if (!res.ok) {
      throw new Error(`NWS request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Accept only forecast URLs on api.weather.gov / *.weather.gov over https. */
function isAllowedForecastUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    return (
      url.hostname === ALLOWED_FORECAST_HOST_SUFFIX.slice(1) ||
      url.hostname.endsWith(ALLOWED_FORECAST_HOST_SUFFIX)
    );
  } catch {
    return false;
  }
}

/** Convert a period temperature to °F (NWS may report "F" or "C"). */
function toFahrenheit(temperature: unknown, unit: unknown): number | null {
  if (!isFiniteNumber(temperature)) return null;
  if (typeof unit === "string" && unit.trim().toUpperCase() === "C") {
    return Math.round((temperature * 9) / 5 + 32);
  }
  return temperature;
}

interface RawNwsPeriod {
  startTime?: string | null; // ISO with the point's local offset
  isDaytime?: boolean | null;
  temperature?: number | null;
  temperatureUnit?: string | null;
  shortForecast?: string | null;
  probabilityOfPrecipitation?: { value?: number | null } | null;
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Look up the NWS forecast for a calendar date at a point. The caller decides
 * WHETHER a forecast applies (move within the 7-day window, address is the
 * destination); this module only fetches and shapes it.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on network failure. Any
 * non-"ok" status means "no forecast — fall back / show nothing".
 */
export async function lookupMoveDayForecast(input: WeatherLookupInput): Promise<WeatherLookupResult> {
  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) {
    return degraded("error", "invalid_target_date");
  }

  // NWS recommends ≤4 decimal places (more precision triggers a redirect);
  // rounding also gives us a stable cache key.
  const lat4 = lat.toFixed(4);
  const lng4 = lng.toFixed(4);
  const cacheKey = `wx:${lat4},${lng4}:${input.targetDate}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    // Step 1: lat/lng → gridpoint metadata with the forecast URL.
    const pointsPayload = (await fetchJson(`${NWS_API_BASE}/points/${lat4},${lng4}`)) as {
      properties?: { forecast?: string | null } | null;
    } | null;
    const forecastUrl = pointsPayload?.properties?.forecast;
    if (typeof forecastUrl !== "string" || !isAllowedForecastUrl(forecastUrl)) {
      return degraded("error", "no_forecast_url");
    }

    // Step 2: gridpoint forecast → half-day periods.
    const forecastPayload = (await fetchJson(forecastUrl)) as {
      properties?: { periods?: unknown } | null;
    } | null;
    const rawPeriods = forecastPayload?.properties?.periods;
    if (!Array.isArray(rawPeriods)) {
      return degraded("error", "unexpected_response_shape");
    }

    // Periods carry the point's local offset in startTime — slice the date
    // part directly instead of re-deriving it through the server's timezone.
    const periods = (rawPeriods as RawNwsPeriod[]).filter(
      (p) => typeof p?.startTime === "string" && p.startTime.slice(0, 10) === input.targetDate,
    );
    if (periods.length === 0) {
      // The forecast only covers ~7 days; the target date is past its horizon.
      return degraded("too_far", "date_beyond_forecast_horizon");
    }

    const day = periods.find((p) => p.isDaytime === true) ?? null;
    const night = periods.find((p) => p.isDaytime !== true) ?? null;
    // Prefer the daytime narrative (that's when moves happen); fall back to
    // the night period when the day half has already rolled off (e.g. the
    // move is today and it's evening at the destination).
    const primary = day ?? night;
    if (!primary) {
      return degraded("error", "unexpected_response_shape");
    }

    const precipRaw = primary.probabilityOfPrecipitation?.value;
    const result: WeatherLookupResult = {
      status: "ok",
      forecastDate: input.targetDate,
      summary: (primary.shortForecast || "").trim() || null,
      tempHighF: day ? toFahrenheit(day.temperature, day.temperatureUnit) : null,
      tempLowF: night ? toFahrenheit(night.temperature, night.temperatureUnit) : null,
      precipChancePct: isFiniteNumber(precipRaw) ? precipRaw : null,
      reason: null,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "nws_request_failed";
    return degraded("error", reason);
  }
}

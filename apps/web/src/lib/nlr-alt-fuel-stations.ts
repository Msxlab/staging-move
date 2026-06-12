// NLR Alternative Fuel Stations EV charging lookup.
// =============================================================================
// Part of the New Home Dossier: given an address's lat/lng, report nearby
// public, active EV charging stations from the NLR Developer Network
// Alternative Fuel Stations API.
//
// DATA SOURCE - free but KEYED:
//
//   https://developer.nlr.gov/api/alt-fuel-stations/v1/nearest.json
//     ?api_key=...&latitude=...&longitude=...&radius=10
//     &fuel_type=ELEC&access=public&status=E&limit=20
//
// GRACEFUL DEGRADATION CONTRACT: this module never throws into a user path.
// Missing/disabled config, missing coordinates, network failures, timeouts, or
// unexpected payloads produce a status union and null/empty data.
//
// HONESTY NOTE: this reports known public station listings near the address.
// It is not a guarantee that a charger is working, available, priced as shown,
// compatible with a vehicle, or accessible at move time.
// =============================================================================

import { getRuntimeConfigValue } from "@/lib/runtime-config";

export type EvChargingLookupStatus =
  | "ok"
  | "disabled"
  | "not_configured"
  | "no_location"
  | "error";

export interface EvChargingStationSummary {
  id: string | null;
  name: string | null;
  distanceMiles: number | null;
  network: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  accessDaysTime: string | null;
  connectorTypes: string[];
  dcFastPorts: number | null;
  level2Ports: number | null;
}

export interface EvChargingLookupResult {
  status: EvChargingLookupStatus;
  radiusMiles: number;
  totalResults: number | null;
  stationCount: number;
  nearestDistanceMiles: number | null;
  dcFastPortCount: number;
  level2PortCount: number;
  teslaCompatibleCount: number;
  ccsCompatibleCount: number;
  stations: EvChargingStationSummary[];
  reason: string | null;
  caveat: string;
  source: {
    name: "NLR Alternative Fuel Stations";
    url: "https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/nearest/";
  };
}

export interface EvChargingLookupInput {
  latitude?: number | null;
  longitude?: number | null;
}

const NLR_NEAREST_URL = "https://developer.nlr.gov/api/alt-fuel-stations/v1/nearest.json";
const SEARCH_RADIUS_MILES = 10;
const REQUEST_TIMEOUT_MS = 3500;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const MAX_CACHE_ENTRIES = 2000;
const MAX_RETURNED_STATIONS = 5;

const SOURCE = {
  name: "NLR Alternative Fuel Stations",
  url: "https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/nearest/",
} as const;

const CAVEAT =
  "EV charging results are nearby public active station listings from NLR/AFDC. Verify access, pricing, connector compatibility, and real-time availability with the station or charging network before relying on it.";

interface CacheEntry {
  expiresAt: number;
  value: EvChargingLookupResult;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): EvChargingLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: EvChargingLookupResult): void {
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export function clearEvChargingCache(): void {
  cache.clear();
}

function isTruthy(value: string | null | undefined): boolean {
  return ["true", "1", "yes", "on"].includes((value || "").trim().toLowerCase());
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function parseConnectorTypes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter((item): item is string => Boolean(item));
  }
  const raw = cleanString(value);
  if (!raw) return [];
  return raw
    .split(/[,;/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function degraded(status: EvChargingLookupStatus, reason: string): EvChargingLookupResult {
  return {
    status,
    radiusMiles: SEARCH_RADIUS_MILES,
    totalResults: null,
    stationCount: 0,
    nearestDistanceMiles: null,
    dcFastPortCount: 0,
    level2PortCount: 0,
    teslaCompatibleCount: 0,
    ccsCompatibleCount: 0,
    stations: [],
    reason,
    caveat: CAVEAT,
    source: SOURCE,
  };
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
      // Status only; never echo the URL because it carries the API key.
      throw new Error(`NLR request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface RawStation {
  id?: string | number | null;
  station_name?: string | null;
  distance?: string | number | null;
  ev_network?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  access_days_time?: string | null;
  ev_connector_types?: unknown;
  ev_dc_fast_num?: string | number | null;
  ev_level2_evse_num?: string | number | null;
}

function summarizeStation(raw: RawStation): EvChargingStationSummary {
  return {
    id: cleanString(raw.id),
    name: cleanString(raw.station_name),
    distanceMiles: parseNumber(raw.distance),
    network: cleanString(raw.ev_network),
    streetAddress: cleanString(raw.street_address),
    city: cleanString(raw.city),
    state: cleanString(raw.state),
    zip: cleanString(raw.zip),
    accessDaysTime: cleanString(raw.access_days_time),
    connectorTypes: parseConnectorTypes(raw.ev_connector_types),
    dcFastPorts: parseNumber(raw.ev_dc_fast_num),
    level2Ports: parseNumber(raw.ev_level2_evse_num),
  };
}

function sumPorts(stations: EvChargingStationSummary[], field: "dcFastPorts" | "level2Ports"): number {
  return stations.reduce((total, station) => total + Math.max(0, station[field] ?? 0), 0);
}

function countConnector(stations: EvChargingStationSummary[], pattern: RegExp): number {
  return stations.filter((station) => station.connectorTypes.some((connector) => pattern.test(connector))).length;
}

export function parseEvChargingPayload(payload: unknown): Omit<EvChargingLookupResult, "status" | "reason" | "caveat" | "source"> | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as { fuel_stations?: unknown; total_results?: unknown };
  if (!Array.isArray(obj.fuel_stations)) return null;

  const stations = (obj.fuel_stations as RawStation[])
    .map(summarizeStation)
    .sort((a, b) => (a.distanceMiles ?? Number.POSITIVE_INFINITY) - (b.distanceMiles ?? Number.POSITIVE_INFINITY));
  const returned = stations.slice(0, MAX_RETURNED_STATIONS);

  return {
    radiusMiles: SEARCH_RADIUS_MILES,
    totalResults: parseNumber(obj.total_results) ?? stations.length,
    stationCount: stations.length,
    nearestDistanceMiles: stations[0]?.distanceMiles ?? null,
    dcFastPortCount: sumPorts(stations, "dcFastPorts"),
    level2PortCount: sumPorts(stations, "level2Ports"),
    teslaCompatibleCount: countConnector(stations, /tesla|nacs|j3400|j3271/i),
    ccsCompatibleCount: countConnector(stations, /j1772combo|ccs/i),
    stations: returned,
  };
}

export async function lookupEvCharging(input: EvChargingLookupInput): Promise<EvChargingLookupResult> {
  const enabled = await getRuntimeConfigValue("NLR_ALT_FUEL_STATIONS_ENABLED").catch(() => null);
  if (!isTruthy(enabled)) return degraded("disabled", "nlr_alt_fuel_stations_disabled");

  const apiKey = (await getRuntimeConfigValue("NLR_API_KEY").catch(() => null))?.trim() || null;
  if (!apiKey) return degraded("not_configured", "nlr_api_key_missing");

  const lat = input.latitude;
  const lng = input.longitude;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return degraded("no_location", "no_coordinates");
  }

  // About 2km cache granularity. Charger inventory is not address-precise and
  // this keeps API usage far under hourly limits during repeated dossier opens.
  const cacheKey = `nlr-ev:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      latitude: String(lat),
      longitude: String(lng),
      radius: String(SEARCH_RADIUS_MILES),
      fuel_type: "ELEC",
      access: "public",
      status: "E",
      limit: "20",
    });
    const parsed = parseEvChargingPayload(await fetchJson(`${NLR_NEAREST_URL}?${params.toString()}`));
    if (!parsed) return degraded("error", "unexpected_response_shape");

    const result: EvChargingLookupResult = {
      status: "ok",
      ...parsed,
      reason: null,
      caveat: CAVEAT,
      source: SOURCE,
    };
    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    return degraded("error", error instanceof Error ? error.message : "nlr_request_failed");
  }
}

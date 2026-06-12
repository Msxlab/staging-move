// HUD User housing-data lookup.
// =============================================================================
// Part of the New Home Dossier: given a saved address ZIP/state, report HUD
// housing-market context: ZIP-to-county/metro crosswalk plus Fair Market Rent
// and Income Limits data when HUD has a matching geography.
//
// DATA SOURCES - free but KEYED with HUD_USER_API_TOKEN:
//
//   https://www.huduser.gov/hudapi/public/usps?type=2&query=<zip>
//   https://www.huduser.gov/hudapi/public/usps?type=3&query=<zip>
//   https://www.huduser.gov/hudapi/public/fmr/data/<entityid>
//   https://www.huduser.gov/hudapi/public/il/data/<entityid>
//
// GRACEFUL DEGRADATION CONTRACT: this module never throws into a user path.
// Disabled/missing config, missing ZIP, no HUD row, network failures, timeouts,
// or unexpected payloads produce status unions and nullable data.
//
// HONESTY NOTE: HUD FMR/Income Limits describe HUD geographies and program
// thresholds. They are not rent quotes, affordability advice, eligibility
// determinations, appraisals, or guarantees for a specific home.
// =============================================================================

import { getRuntimeConfigValue } from "@/lib/runtime-config";

export type HudHousingLookupStatus =
  | "ok"
  | "disabled"
  | "not_configured"
  | "no_location"
  | "no_zip"
  | "not_found"
  | "error";

export interface HudFairMarketRent {
  year: number | null;
  efficiency: number | null;
  oneBedroom: number | null;
  twoBedroom: number | null;
  threeBedroom: number | null;
  fourBedroom: number | null;
  zipSpecific: boolean;
}

export interface HudIncomeLimits {
  year: number | null;
  medianIncome: number | null;
  extremelyLowIncome4Person: number | null;
  veryLowIncome4Person: number | null;
  lowIncome4Person: number | null;
}

export interface HudHousingLookupResult {
  status: HudHousingLookupStatus;
  zip: string | null;
  entityId: string | null;
  countyFips: string | null;
  cbsaCode: string | null;
  countyName: string | null;
  metroName: string | null;
  areaName: string | null;
  fairMarketRent: HudFairMarketRent | null;
  incomeLimits: HudIncomeLimits | null;
  reason: string | null;
  caveat: string;
  source: {
    name: "HUD User Data API";
    url: "https://www.huduser.gov/portal/dataset/fmr-api.html";
  };
}

export interface HudHousingLookupInput {
  zip?: string | null;
  state?: string | null;
}

const HUD_PUBLIC_BASE = "https://www.huduser.gov/hudapi/public";
const REQUEST_TIMEOUT_MS = 4500;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

const SOURCE = {
  name: "HUD User Data API",
  url: "https://www.huduser.gov/portal/dataset/fmr-api.html",
} as const;

const CAVEAT =
  "This product uses the HUD User Data API but is not endorsed or certified by HUD User. HUD rent and income-limit figures describe HUD geographies and program thresholds, not a quote, appraisal, or eligibility decision for a specific home.";

interface CacheEntry {
  expiresAt: number;
  value: HudHousingLookupResult;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): HudHousingLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: HudHousingLookupResult): void {
  if (value.status !== "ok") return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export function clearHudHousingCache(): void {
  cache.clear();
}

function isTruthy(value: string | null | undefined): boolean {
  return ["true", "1", "yes", "on"].includes((value || "").trim().toLowerCase());
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeZip(value: unknown): string | null {
  const raw = cleanString(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : null;
}

export function parseHudNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHudYear(value: unknown): number | null {
  const parsed = parseHudNumber(value);
  if (parsed === null) return null;
  return parsed >= 1900 && parsed <= 2100 ? Math.trunc(parsed) : null;
}

function degraded(status: HudHousingLookupStatus, reason: string, zip: string | null = null): HudHousingLookupResult {
  return {
    status,
    zip,
    entityId: null,
    countyFips: null,
    cbsaCode: null,
    countyName: null,
    metroName: null,
    areaName: null,
    fairMarketRent: null,
    incomeLimits: null,
    reason,
    caveat: CAVEAT,
    source: SOURCE,
  };
}

class HudHttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`HUD request failed: HTTP ${status}`);
    this.status = status;
  }
}

async function fetchHudJson(pathOrUrl: string, token: string): Promise<unknown> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${HUD_PUBLIC_BASE}${pathOrUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      // Status only; never echo the token-bearing request in errors.
      throw new HudHttpError(res.status);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function dataPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  return obj.data ?? payload;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getField(record: Record<string, unknown> | null, names: string[]): unknown {
  if (!record) return undefined;
  const wanted = new Set(names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, "")));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""))) return value;
  }
  return undefined;
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  const data = dataPayload(payload);
  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> => Boolean(asRecord(row)));
  }
  const dataObj = asRecord(data);
  const results = dataObj?.results;
  if (Array.isArray(results)) {
    return results.filter((row): row is Record<string, unknown> => Boolean(asRecord(row)));
  }
  return [];
}

function normalizeCode(value: unknown, length: number): string | null {
  const raw = cleanString(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === length ? digits : null;
}

interface HudCrosswalkCode {
  code: string;
  ratio: number | null;
}

function rowRatio(row: Record<string, unknown>): number | null {
  return (
    parseHudNumber(getField(row, ["res_ratio", "resratio", "residential_ratio", "residentialratio"])) ??
    parseHudNumber(getField(row, ["tot_ratio", "totratio", "total_ratio", "totalratio"])) ??
    parseHudNumber(getField(row, ["bus_ratio", "busratio"]))
  );
}

function pickBestCode(payload: unknown, codeKeys: string[], length: number): HudCrosswalkCode | null {
  let best: HudCrosswalkCode | null = null;
  for (const row of extractRows(payload)) {
    const code = normalizeCode(getField(row, codeKeys), length);
    if (!code) continue;
    const ratio = rowRatio(row);
    if (!best || (ratio ?? -1) > (best.ratio ?? -1)) {
      best = { code, ratio };
    }
  }
  return best;
}

export function extractCountyFipsFromCrosswalk(payload: unknown): string | null {
  return pickBestCode(payload, ["county", "county_geoid", "countygeoid", "geoid", "cnty"], 5)?.code ?? null;
}

export function extractCbsaCodeFromCrosswalk(payload: unknown): string | null {
  return pickBestCode(payload, ["cbsa", "cbsa_code", "cbsacode", "geoid"], 5)?.code ?? null;
}

function buildEntityIds(countyFips: string | null, cbsaCode: string | null): string[] {
  const candidates = [
    countyFips ? `${countyFips}99999` : null,
    cbsaCode ? `METRO${cbsaCode}M${cbsaCode}` : null,
  ].filter((value): value is string => Boolean(value));
  return [...new Set(candidates)];
}

function fmrRowFromBasicData(data: Record<string, unknown>, zip: string): Record<string, unknown> | null {
  const basic = data.basicdata;
  if (Array.isArray(basic)) {
    const rows = basic.filter((row): row is Record<string, unknown> => Boolean(asRecord(row)));
    return (
      rows.find((row) => normalizeZip(getField(row, ["zip_code", "zipcode", "zip"])) === zip) ??
      rows.find((row) => /msa level/i.test(cleanString(getField(row, ["zip_code", "zipcode", "zip"])) || "")) ??
      rows[0] ??
      null
    );
  }
  return asRecord(basic);
}

export function parseFairMarketRent(payload: unknown, zip: string): HudFairMarketRent | null {
  const data = asRecord(dataPayload(payload));
  if (!data) return null;
  const row = fmrRowFromBasicData(data, zip);
  if (!row) return null;

  const result: HudFairMarketRent = {
    year: parseHudYear(getField(row, ["year"])) ?? parseHudYear(getField(data, ["year"])),
    efficiency: parseHudNumber(getField(row, ["Efficiency", "efficiency"])),
    oneBedroom: parseHudNumber(getField(row, ["One-Bedroom", "one_bedroom", "onebedroom"])),
    twoBedroom: parseHudNumber(getField(row, ["Two-Bedroom", "two_bedroom", "twobedroom"])),
    threeBedroom: parseHudNumber(getField(row, ["Three-Bedroom", "three_bedroom", "threebedroom"])),
    fourBedroom: parseHudNumber(getField(row, ["Four-Bedroom", "four_bedroom", "fourbedroom"])),
    zipSpecific: normalizeZip(getField(row, ["zip_code", "zipcode", "zip"])) === zip,
  };

  return Object.values(result).some((value) => typeof value === "number") ? result : null;
}

export function parseIncomeLimits(payload: unknown): HudIncomeLimits | null {
  const data = asRecord(dataPayload(payload));
  if (!data) return null;
  const extremelyLow = asRecord(getField(data, ["extremely_low", "extremelylow"]));
  const veryLow = asRecord(getField(data, ["very_low", "verylow"]));
  const low = asRecord(getField(data, ["low"]));
  const result: HudIncomeLimits = {
    year: parseHudYear(getField(data, ["year"])),
    medianIncome: parseHudNumber(getField(data, ["median_income", "medianincome"])),
    extremelyLowIncome4Person: parseHudNumber(getField(extremelyLow, ["il30_p4", "il30p4"])),
    veryLowIncome4Person: parseHudNumber(getField(veryLow, ["il50_p4", "il50p4"])),
    lowIncome4Person: parseHudNumber(getField(low, ["il80_p4", "il80p4"])),
  };

  return Object.values(result).some((value) => typeof value === "number") ? result : null;
}

function regionFromPayloads(
  fmrPayload: unknown,
  incomePayload: unknown,
): Pick<HudHousingLookupResult, "countyName" | "metroName" | "areaName"> {
  const data = asRecord(dataPayload(fmrPayload)) ?? asRecord(dataPayload(incomePayload));
  return {
    countyName: cleanString(getField(data, ["county_name", "countyname"])),
    metroName: cleanString(getField(data, ["metro_name", "metroname"])),
    areaName: cleanString(getField(data, ["area_name", "areaname"])),
  };
}

interface EntityPayloads {
  entityId: string | null;
  fmrPayload: unknown | null;
  incomePayload: unknown | null;
  notFoundOnly: boolean;
  reason: string;
}

async function fetchFirstEntityPayloads(entityIds: string[], token: string, zip: string): Promise<EntityPayloads> {
  let sawNon404 = false;
  let lastReason = "hud_data_not_found";

  for (const entityId of entityIds) {
    const [fmrSettled, incomeSettled] = await Promise.allSettled([
      fetchHudJson(`/fmr/data/${encodeURIComponent(entityId)}`, token),
      fetchHudJson(`/il/data/${encodeURIComponent(entityId)}`, token),
    ]);

    const fmrPayload = fmrSettled.status === "fulfilled" ? fmrSettled.value : null;
    const incomePayload = incomeSettled.status === "fulfilled" ? incomeSettled.value : null;
    if (fmrPayload || incomePayload) {
      const hasUsableData =
        (fmrPayload !== null && parseFairMarketRent(fmrPayload, zip) !== null) ||
        (incomePayload !== null && parseIncomeLimits(incomePayload) !== null);
      if (hasUsableData) {
        return { entityId, fmrPayload, incomePayload, notFoundOnly: false, reason: "ok" };
      }
      lastReason = "hud_data_empty";
      continue;
    }

    for (const settled of [fmrSettled, incomeSettled]) {
      if (settled.status === "rejected") {
        const error = settled.reason;
        const status = error instanceof HudHttpError ? error.status : null;
        if (status !== 404) sawNon404 = true;
        lastReason = error instanceof Error ? error.message : "hud_data_request_failed";
      }
    }
  }

  return {
    entityId: null,
    fmrPayload: null,
    incomePayload: null,
    notFoundOnly: !sawNon404,
    reason: lastReason,
  };
}

function okResult(input: {
  zip: string;
  entityId: string;
  countyFips: string | null;
  cbsaCode: string | null;
  fmrPayload: unknown | null;
  incomePayload: unknown | null;
}): HudHousingLookupResult {
  const region = regionFromPayloads(input.fmrPayload, input.incomePayload);
  return {
    status: "ok",
    zip: input.zip,
    entityId: input.entityId,
    countyFips: input.countyFips,
    cbsaCode: input.cbsaCode,
    ...region,
    fairMarketRent: input.fmrPayload ? parseFairMarketRent(input.fmrPayload, input.zip) : null,
    incomeLimits: input.incomePayload ? parseIncomeLimits(input.incomePayload) : null,
    reason: null,
    caveat: CAVEAT,
    source: SOURCE,
  };
}

export async function lookupHudHousing(input: HudHousingLookupInput): Promise<HudHousingLookupResult> {
  const enabled = await getRuntimeConfigValue("HUD_HOUSING_DATA_ENABLED").catch(() => null);
  if (!isTruthy(enabled)) return degraded("disabled", "hud_housing_data_disabled");

  const token = (await getRuntimeConfigValue("HUD_USER_API_TOKEN").catch(() => null))?.trim() || null;
  if (!token) return degraded("not_configured", "hud_user_api_token_missing");

  const zip = normalizeZip(input.zip);
  if (!zip) return degraded("no_zip", "zip_missing");

  const cacheKey = `hud-housing:${zip}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const [countyCrosswalk, cbsaCrosswalk] = await Promise.allSettled([
      fetchHudJson(`/usps?type=2&query=${encodeURIComponent(zip)}`, token),
      fetchHudJson(`/usps?type=3&query=${encodeURIComponent(zip)}`, token),
    ]);

    const countyFips =
      countyCrosswalk.status === "fulfilled" ? extractCountyFipsFromCrosswalk(countyCrosswalk.value) : null;
    const cbsaCode = cbsaCrosswalk.status === "fulfilled" ? extractCbsaCodeFromCrosswalk(cbsaCrosswalk.value) : null;
    const entityIds = buildEntityIds(countyFips, cbsaCode);
    if (entityIds.length === 0) {
      const crosswalkReason =
        countyCrosswalk.status === "rejected" && cbsaCrosswalk.status === "rejected"
          ? "hud_crosswalk_request_failed"
          : "hud_crosswalk_not_found";
      return degraded(crosswalkReason === "hud_crosswalk_not_found" ? "not_found" : "error", crosswalkReason, zip);
    }

    const entityPayloads = await fetchFirstEntityPayloads(entityIds, token, zip);
    if (!entityPayloads.entityId) {
      return degraded(entityPayloads.notFoundOnly ? "not_found" : "error", entityPayloads.reason, zip);
    }

    const result = okResult({
      zip,
      entityId: entityPayloads.entityId,
      countyFips,
      cbsaCode,
      fmrPayload: entityPayloads.fmrPayload,
      incomePayload: entityPayloads.incomePayload,
    });

    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    return degraded("error", error instanceof Error ? error.message : "hud_request_failed", zip);
  }
}

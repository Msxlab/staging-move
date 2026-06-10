// NHTSA vehicle lookup (vPIC VIN decoder + recalls-by-vehicle).
// =============================================================================
// Part of the move checklist's "vehicle registration" helper: a mover who has
// to re-register a car in the destination state can paste their VIN and get
//   1. the decoded vehicle (year / make / model) from NHTSA vPIC, and
//   2. the open-recall count + top recall items from the NHTSA recalls API,
// so they show up at the DMV knowing exactly which car they're registering and
// whether an open recall needs handling first.
//
// DATA SOURCES — free and KEYLESS (both are public NHTSA endpoints):
//   • vPIC "DecodeVinValues" (flat-format VIN decode):
//       https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{VIN}?format=json
//   • Recalls by vehicle (make + model + modelYear):
//       https://api.nhtsa.gov/recalls/recallsByVehicle?make=...&model=...&modelYear=...
//
// GRACEFUL DEGRADATION CONTRACT (same architecture as fcc-isp.ts): this module
// NEVER throws into a user path. Network failure, timeout, or an unexpected
// payload yields `{ status: "error" }`; a syntactically bad VIN yields
// `{ status: "invalid_vin" }` without any network call; a well-formed VIN that
// vPIC cannot decode yields `{ status: "no_match" }`. The recalls block is
// INDEPENDENT: a decoded vehicle with an unreachable recalls API still returns
// `status: "ok"` with `recalls.status: "unavailable"` — the caller renders the
// vehicle and simply omits recall info.
//
// HONESTY NOTE: vPIC decodes what the VIN encodes — it is not a registration
// or title record. Recall data is the federal NHTSA campaign list; state DMV
// registration requirements are NOT part of either dataset. Surface with the
// fine print "Specs and recalls from NHTSA — registration requirements come
// from your state DMV."
// =============================================================================

// ── Public types ────────────────────────────────────────────────────────────

export type VehicleLookupStatus =
  | "ok" // vPIC decoded at least one of year/make/model; `vehicle` is set
  | "invalid_vin" // VIN failed syntactic validation — no network call made
  | "no_match" // vPIC answered but decoded nothing usable — caller falls back
  | "error"; // network/parse/timeout/HTTP error — caller falls back

export type VehicleRecallStatus =
  | "ok" // recalls API answered; `count`/`topItems` are authoritative
  | "unavailable"; // not queryable (partial decode) or the recalls call failed

export interface DecodedVehicle {
  /** The normalized (trimmed, uppercased) VIN that was decoded. */
  vin: string;
  /** Model year as a number (e.g. 2019), when vPIC reports a plausible one. */
  year: number | null;
  /** Make as reported by vPIC (e.g. "HONDA"). */
  make: string | null;
  /** Model as reported by vPIC (e.g. "CR-V"). */
  model: string | null;
}

export interface VehicleRecallItem {
  /** NHTSA campaign number (e.g. "19V182000"), when present. */
  campaignNumber: string | null;
  /** Affected component (e.g. "FUEL SYSTEM, GASOLINE"), when present. */
  component: string | null;
  /** Defect summary, when present. */
  summary: string | null;
}

export interface VehicleRecallsResult {
  status: VehicleRecallStatus;
  /** Total open recall campaigns for the vehicle. Null unless status "ok". */
  count: number | null;
  /** Up to MAX_RECALL_ITEMS items for display. Empty unless status "ok". */
  topItems: VehicleRecallItem[];
}

export interface VehicleLookupResult {
  status: VehicleLookupStatus;
  /** Decoded vehicle. Null unless status "ok". */
  vehicle: DecodedVehicle | null;
  /** Recall block — independent of the decode (see module header). */
  recalls: VehicleRecallsResult;
  /** Machine-readable reason when degraded (never user-facing copy). */
  reason: string | null;
  /** Source attribution for the UI / audit trail. */
  source: {
    name: "NHTSA";
    url: "https://www.nhtsa.gov/recalls";
  };
}

// ── VIN validation ───────────────────────────────────────────────────────────

// 17 characters; letters I, O, and Q are never used in a VIN (ISO 3779).
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Trim + uppercase a raw VIN input. Does NOT validate — see isValidVin. */
export function normalizeVin(raw: string | null | undefined): string {
  return (raw || "").trim().toUpperCase();
}

/** True when `vin` is a syntactically valid, already-normalized VIN. */
export function isValidVin(vin: string): boolean {
  return VIN_PATTERN.test(vin);
}

// ── Configuration ────────────────────────────────────────────────────────────

const VPIC_DECODE_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues";
const RECALLS_BASE = "https://api.nhtsa.gov/recalls/recallsByVehicle";

const REQUEST_TIMEOUT_MS = 3000;
const MAX_RECALL_ITEMS = 3;

// ── In-memory cache (per-server-process) ─────────────────────────────────────
// A VIN's decode is immutable and recall campaigns change slowly (new ones a
// few times a year for a given model), so 7 days is safe. Only fully
// authoritative answers are cached — a decode whose recalls call failed is NOT
// cached, so the next attempt retries the recalls API instead of pinning
// "unavailable" for a week.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

interface CacheEntry {
  expiresAt: number;
  value: VehicleLookupResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): VehicleLookupResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: VehicleLookupResult): void {
  // Cache "ok with recalls ok" (fully authoritative) and "no_match" (vPIC's
  // authoritative answer for a junk-but-well-formed VIN). Never cache errors
  // or partial answers — see the cache section header.
  const cacheable =
    value.status === "no_match" || (value.status === "ok" && value.recalls.status === "ok");
  if (!cacheable) return;
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

// Exposed for tests / admin tooling.
export function clearVehicleCache(): void {
  cache.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE = {
  name: "NHTSA",
  url: "https://www.nhtsa.gov/recalls",
} as const;

const RECALLS_UNAVAILABLE: VehicleRecallsResult = {
  status: "unavailable",
  count: null,
  topItems: [],
};

function degraded(status: VehicleLookupStatus, reason: string): VehicleLookupResult {
  return {
    status,
    vehicle: null,
    recalls: { ...RECALLS_UNAVAILABLE, topItems: [] },
    reason,
    source: SOURCE,
  };
}

function cleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** vPIC reports ModelYear as a string; only plausible 4-digit years pass. */
function parseModelYear(raw: unknown): number | null {
  const text = cleanString(raw);
  if (!text || !/^\d{4}$/.test(text)) return null;
  const year = Number(text);
  return year >= 1900 && year <= 2100 ? year : null;
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
      throw new Error(`NHTSA request failed: HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── vPIC decode ──────────────────────────────────────────────────────────────

interface RawVpicResult {
  Make?: string | null;
  Model?: string | null;
  ModelYear?: string | null;
}

/** Decode a normalized VIN via vPIC. Throws only into the caller's catch. */
async function decodeVinValues(vin: string): Promise<DecodedVehicle | null> {
  const url = `${VPIC_DECODE_BASE}/${encodeURIComponent(vin)}?format=json`;
  const payload = await fetchJson(url);

  const results =
    payload && typeof payload === "object" && Array.isArray((payload as { Results?: unknown }).Results)
      ? ((payload as { Results: RawVpicResult[] }).Results)
      : null;
  if (!results || results.length === 0) return null;

  const row = results[0] || {};
  const year = parseModelYear(row.ModelYear);
  const make = cleanString(row.Make);
  const model = cleanString(row.Model);

  // Nothing decoded at all → "no_match" (vPIC always answers with a row, even
  // for garbage; an all-empty row is its way of saying "unknown VIN").
  if (year === null && make === null && model === null) return null;

  return { vin, year, make, model };
}

// ── Recalls by vehicle ───────────────────────────────────────────────────────

interface RawRecallRow {
  NHTSACampaignNumber?: string | null;
  Component?: string | null;
  Summary?: string | null;
}

function parseRecallRows(rows: RawRecallRow[]): VehicleRecallItem[] {
  const items: VehicleRecallItem[] = [];
  for (const row of rows) {
    const campaignNumber = cleanString(row?.NHTSACampaignNumber);
    const component = cleanString(row?.Component);
    const summary = cleanString(row?.Summary);
    // Keep only rows with something displayable — never render an empty item.
    if (!campaignNumber && !component && !summary) continue;
    items.push({ campaignNumber, component, summary });
    if (items.length >= MAX_RECALL_ITEMS) break;
  }
  return items;
}

/**
 * Fetch open recall campaigns for a fully decoded vehicle. Returns the
 * "unavailable" block on ANY failure so the caller's vehicle answer survives.
 */
async function lookupRecalls(vehicle: DecodedVehicle): Promise<VehicleRecallsResult> {
  // The recalls API needs all three of make/model/modelYear; a partial decode
  // cannot be queried meaningfully.
  if (vehicle.year === null || !vehicle.make || !vehicle.model) {
    return { ...RECALLS_UNAVAILABLE, topItems: [] };
  }

  try {
    const params = new URLSearchParams({
      make: vehicle.make,
      model: vehicle.model,
      modelYear: String(vehicle.year),
    });
    const payload = await fetchJson(`${RECALLS_BASE}?${params.toString()}`);
    if (!payload || typeof payload !== "object") {
      return { ...RECALLS_UNAVAILABLE, topItems: [] };
    }

    const obj = payload as { Count?: unknown; results?: unknown; Results?: unknown };
    const rows = Array.isArray(obj.results)
      ? (obj.results as RawRecallRow[])
      : Array.isArray(obj.Results)
        ? (obj.Results as RawRecallRow[])
        : null;
    if (!rows) return { ...RECALLS_UNAVAILABLE, topItems: [] };

    const count =
      typeof obj.Count === "number" && Number.isFinite(obj.Count) && obj.Count >= 0
        ? Math.round(obj.Count)
        : rows.length;

    return { status: "ok", count, topItems: parseRecallRows(rows) };
  } catch {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure —
    // the decode still stands, only the recall block degrades.
    return { ...RECALLS_UNAVAILABLE, topItems: [] };
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Decode a VIN and look up its open NHTSA recalls.
 *
 * GRACEFUL DEGRADATION CONTRACT: never throws on NHTSA/network failure. Any
 * non-"ok" status means "no vehicle answer — fall back"; an "ok" status with
 * `recalls.status: "unavailable"` means "show the vehicle, omit recall info".
 */
export async function lookupVehicleByVin(rawVin: string): Promise<VehicleLookupResult> {
  const vin = normalizeVin(rawVin);
  if (!isValidVin(vin)) {
    return degraded("invalid_vin", "vin_failed_validation");
  }

  const cacheKey = `nhtsa:${vin}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let vehicle: DecodedVehicle | null;
  try {
    vehicle = await decodeVinValues(vin);
  } catch (error) {
    // Network error, timeout (AbortError), non-2xx, or JSON parse failure.
    const reason = error instanceof Error ? error.message : "vpic_request_failed";
    return degraded("error", reason);
  }

  if (!vehicle) {
    const result = degraded("no_match", "vin_not_decoded");
    cacheSet(cacheKey, result);
    return result;
  }

  const recalls = await lookupRecalls(vehicle);
  const result: VehicleLookupResult = {
    status: "ok",
    vehicle,
    recalls,
    reason: null,
    source: SOURCE,
  };
  cacheSet(cacheKey, result);
  return result;
}

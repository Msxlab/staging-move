import { prisma } from "@/lib/db";

/**
 * Durable, AREA-scoped cache for the external Home-Dossier lookups (FEMA
 * flood/NRI, NCES schools, EPA radon/water/walkability, NWS weather, AirNow
 * AQI, HUD FMR, Census ACS, EV stations).
 *
 * Why: the Home Dossier is free for everyone now, so the SAME area facts must
 * not be re-fetched from upstream on every request (each call costs money or
 * burns an upstream quota). Each data point is fetched ONCE per geo cell,
 * persisted (survives restart, shared across instances), and served from
 * cache. A section is re-fetched only when its cache is expired OR the last
 * fetch returned no real data (status !== "REAL") — "fetch once; serve cache;
 * retry only if we never got real data."
 *
 * The cache holds non-PII AREA facts only, so it is keyed by ROUNDED
 * coordinates — shared across users and nearby addresses — never by user. This
 * maximizes hit rate and minimizes upstream spend.
 *
 * Decoupled from every lookup lib: the CALLER runs the upstream call and
 * classifies the result as REAL | DEGRADED | EMPTY; this module only persists
 * and gates on freshness + status.
 *
 * NOTE: requires the `AddressDataCacheEntry` Prisma model (added in the same
 * change). Run `prisma generate` + migrate before this typechecks/runs.
 */

export type DossierSection =
  | "FLOOD"
  | "SCHOOL"
  | "WEATHER"
  | "HAZARDS"
  | "RADON"
  | "WATER"
  | "AIR"
  | "HOUSING"
  | "EV"
  | "NEIGHBORHOOD";

export type SectionDataStatus = "REAL" | "DEGRADED" | "EMPTY";
export type SectionCacheState = "HIT" | "MISS" | "RETRY" | "STALE";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/**
 * Per-section TTL. Static federal/area data changes rarely → long TTL; weather
 * and air are volatile → short (weather is additionally keyed by target date).
 */
const SECTION_TTL_MS: Record<DossierSection, number> = {
  FLOOD: 60 * DAY,
  SCHOOL: 60 * DAY,
  RADON: 90 * DAY,
  HAZARDS: 60 * DAY,
  HOUSING: 60 * DAY,
  EV: 30 * DAY,
  NEIGHBORHOOD: 30 * DAY,
  WATER: 30 * DAY,
  WEATHER: 6 * HOUR,
  AIR: 3 * HOUR,
};

/** 4 decimals ≈ 11 m: two units in one building (and two users) share a cell. */
const GEO_DECIMALS = 4;

function roundCoord(n: number): string {
  return n.toFixed(GEO_DECIMALS);
}

export function buildGeoKey(
  section: DossierSection,
  lat: number,
  lng: number,
  date?: string | null,
): string {
  const base = `${section}:${roundCoord(lat)},${roundCoord(lng)}`;
  return date ? `${base}:${date}` : base;
}

export interface GetOrFetchSectionArgs<T> {
  section: DossierSection;
  lat: number;
  lng: number;
  /** WEATHER only: the forecast target date (YYYY-MM-DD). */
  date?: string | null;
  /**
   * Runs the upstream lookup and classifies it. Should not throw by contract;
   * a throw is tolerated (stale fallback when a prior row exists).
   */
  fetcher: () => Promise<{ data: T; status: SectionDataStatus }>;
  /** Override the section TTL (ms). Tests / special cases only. */
  ttlMs?: number;
  /** Injectable clock for tests. */
  now?: number;
}

export interface SectionResult<T> {
  data: T;
  cache: SectionCacheState;
}

/**
 * Cache-first read for one dossier section. Returns cached data when it is
 * fresh AND was real; otherwise calls `fetcher`, persists the result under the
 * section TTL, and returns it. On a fetcher error, falls back to any prior
 * cached row (a stale area fact beats a hard failure); if none exists the error
 * propagates so the caller's `allSettled` records the section as degraded.
 */
export async function getOrFetchSection<T>(
  args: GetOrFetchSectionArgs<T>,
): Promise<SectionResult<T>> {
  const { section, lat, lng, date, fetcher } = args;
  const now = args.now ?? Date.now();
  const ttlMs = args.ttlMs ?? SECTION_TTL_MS[section];
  const geoKey = buildGeoKey(section, lat, lng, date);

  const existing = await prisma.addressDataCacheEntry.findUnique({ where: { geoKey } });

  if (existing && existing.status === "REAL" && existing.expiresAt.getTime() > now) {
    return { data: JSON.parse(existing.dataJson) as T, cache: "HIT" };
  }

  let fetched: { data: T; status: SectionDataStatus };
  try {
    fetched = await fetcher();
  } catch (err) {
    if (existing) {
      // Upstream failed but we have a prior row — serve it rather than fail.
      return { data: JSON.parse(existing.dataJson) as T, cache: "STALE" };
    }
    throw err;
  }

  const dataJson = JSON.stringify(fetched.data ?? null);
  const expiresAt = new Date(now + ttlMs);
  await prisma.addressDataCacheEntry.upsert({
    where: { geoKey },
    create: { geoKey, section, status: fetched.status, dataJson, fetchedAt: new Date(now), expiresAt },
    update: { section, status: fetched.status, dataJson, fetchedAt: new Date(now), expiresAt },
  });

  return { data: fetched.data, cache: existing ? "RETRY" : "MISS" };
}

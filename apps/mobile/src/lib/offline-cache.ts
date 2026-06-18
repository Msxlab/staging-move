/**
 * GENERIC OFFLINE LIST CACHE — "last-known data" for the manually-fetched tab
 * screens (Services, Moving), mirroring the dashboard's offline snapshot.
 *
 * Why this and not react-query persistence: these screens fetch with plain
 * `api.get` + useState (not useQuery), and the query client deliberately keeps
 * its cache in memory only (see src/lib/query-client.ts) because results are
 * personal data. This helper applies the SAME privacy stance the dashboard
 * snapshot already uses — persist a compact echo of what the screen just showed,
 * in the app's private AsyncStorage, cleared on logout (see local-cleanup.ts) —
 * so a cold start (or a fetch failure) on no signal hydrates the last view
 * instead of a blank/error wall, then reconciles against the network.
 *
 * Contract: best-effort + total. Reads/writes never throw; a malformed/old/other
 * payload reads back as `null` (the live fetch is always the source of truth).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

/** Prefix for every offline list cache so logout can wipe them all by prefix. */
export const OFFLINE_CACHE_PREFIX = "locateflow.offline.";

/** Bump when the envelope shape changes so old payloads are ignored, not crashed on. */
const ENVELOPE_VERSION = 1 as const;
const memoryCache = new Map<string, OfflineCacheEnvelope<unknown>>();

interface OfflineCacheEnvelope<T> {
  v: typeof ENVELOPE_VERSION;
  /** ISO instant the cache was written (drives the "updated X ago" chip). */
  updatedAt: string;
  data: T;
}

export interface OfflineCacheEntry<T> {
  data: T;
  /** ISO instant this entry was written. */
  updatedAt: string;
}

function keyFor(name: string): string {
  return `${OFFLINE_CACHE_PREFIX}${name}`;
}

function readEnvelope<T>(
  envelope: unknown,
  sanitize: (raw: unknown) => T | null,
): OfflineCacheEntry<T> | null {
  if (typeof envelope !== "object" || envelope === null) return null;
  const parsed = envelope as Record<string, unknown>;
  if (parsed.v !== ENVELOPE_VERSION) return null;
  const data = sanitize(parsed.data);
  if (data === null) return null;
  const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString();
  return { data, updatedAt };
}

/**
 * Persist `data` under `name`. Best-effort: returns false (never throws) on any
 * failure so the screen's load is never disturbed.
 */
export async function writeOfflineCache<T>(name: string, data: T, now: Date = new Date()): Promise<boolean> {
  const envelope: OfflineCacheEnvelope<T> = { v: ENVELOPE_VERSION, updatedAt: now.toISOString(), data };
  memoryCache.set(name, envelope);
  try {
    await AsyncStorage.setItem(keyFor(name), JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronous in-memory read for screens that remount during the same app
 * session. AsyncStorage remains the durable source, but this removes the
 * one-frame skeleton flash on stack/detail revisits after a successful write.
 */
export function peekOfflineCache<T>(
  name: string,
  sanitize: (raw: unknown) => T | null,
): OfflineCacheEntry<T> | null {
  return readEnvelope(memoryCache.get(name), sanitize);
}

/**
 * Read the last-persisted entry for `name`, validated by `sanitize`. Returns
 * `null` when absent, unparseable, the wrong version, or rejected by `sanitize`
 * (which returns the validated data, or null to reject). Never throws.
 */
export async function readOfflineCache<T>(
  name: string,
  sanitize: (raw: unknown) => T | null,
): Promise<OfflineCacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(name));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const entry = readEnvelope(parsed, sanitize);
    if (entry) memoryCache.set(name, parsed as OfflineCacheEnvelope<unknown>);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Prime the in-memory layer from AsyncStorage without returning user data.
 * Authenticated app bootstrap calls this for hot tab screens so a later
 * navigation can use `peekOfflineCache()` synchronously and avoid the full
 * skeleton flash. The eventual screen read still sanitizes the payload.
 */
export async function hydrateOfflineCache(name: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(name));
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return false;
    const envelope = parsed as Record<string, unknown>;
    if (envelope.v !== ENVELOPE_VERSION || !("data" in envelope)) return false;
    memoryCache.set(name, parsed as OfflineCacheEnvelope<unknown>);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear EVERY offline list cache (best-effort). Called on logout/delete so a
 * signed-out / switched user never sees the previous account's last-known data.
 */
export async function clearAllOfflineCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(OFFLINE_CACHE_PREFIX));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
    memoryCache.clear();
  } catch {
    memoryCache.clear();
    /* non-blocking */
  }
}

/** Sanitizer: accept any array (the tab screens render `any[]` lists). */
export function asArray(raw: unknown): unknown[] | null {
  return Array.isArray(raw) ? raw : null;
}

/** Sanitizer: accept any object payload (detail screens render API-shaped objects). */
export function asObject(raw: unknown): Record<string, unknown> | null {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

import { api } from "@/lib/api";
import { readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";
import type { HomeDossierResponse } from "@/lib/home-dossier";

export type HomeDossierCacheMode = "full" | "summary";

const CACHE_PREFIX = "home-dossier";
const LEGACY_FULL_CACHE_PREFIX = "home-dossier";
const LEGACY_INSIGHT_CACHE_PREFIX = "home-insight";
const DEFAULT_FRESH_MS = 30 * 60 * 1000;

interface MemoryEntry {
  data: HomeDossierResponse;
  updatedAt: string;
}

export interface HomeDossierCacheEntry extends MemoryEntry {
  ageMs: number;
  stale: boolean;
  source: "memory" | "disk";
}

export interface HomeDossierFetchResult {
  data: HomeDossierResponse | null;
  fromCache: boolean;
  stale: boolean;
  error: boolean;
  updatedAt: string | null;
}

const memoryCache = new Map<string, MemoryEntry>();

function cacheName(mode: HomeDossierCacheMode, addressId: string): string {
  return `${CACHE_PREFIX}.${mode}.${addressId}`;
}

function memoryKey(mode: HomeDossierCacheMode, addressId: string): string {
  return `${mode}:${addressId}`;
}

function readDossierCache(raw: unknown): HomeDossierResponse | null {
  if (typeof raw !== "object" || raw === null) return null;
  const dossier = raw as HomeDossierResponse;
  return typeof dossier.configured === "boolean" ? dossier : null;
}

function ageMs(updatedAt: string, nowMs: number): number {
  const t = new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - t);
}

function cacheNamesForRead(mode: HomeDossierCacheMode, addressId: string): string[] {
  if (mode === "full") {
    return [
      cacheName("full", addressId),
      `${LEGACY_FULL_CACHE_PREFIX}.${addressId}`,
    ];
  }

  return [
    cacheName("summary", addressId),
    cacheName("full", addressId),
    `${LEGACY_INSIGHT_CACHE_PREFIX}.${addressId}`,
    `${LEGACY_FULL_CACHE_PREFIX}.${addressId}`,
  ];
}

function memoryKeysForRead(mode: HomeDossierCacheMode, addressId: string): string[] {
  return mode === "summary"
    ? [memoryKey("summary", addressId), memoryKey("full", addressId)]
    : [memoryKey("full", addressId)];
}

function shouldMirrorFullToSummary(dossier: HomeDossierResponse): boolean {
  return dossier.configured === true && dossier.entitled !== false && !dossier.upgradeRequired;
}

export function clearHomeDossierMemoryCacheForTests() {
  memoryCache.clear();
}

export async function readHomeDossierCache(
  addressId: string | null | undefined,
  mode: HomeDossierCacheMode,
  options: { maxAgeMs?: number; now?: Date } = {},
): Promise<HomeDossierCacheEntry | null> {
  if (!addressId) return null;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_FRESH_MS;
  const nowMs = (options.now ?? new Date()).getTime();

  for (const key of memoryKeysForRead(mode, addressId)) {
    const entry = memoryCache.get(key);
    if (!entry) continue;
    const age = ageMs(entry.updatedAt, nowMs);
    return {
      data: entry.data,
      updatedAt: entry.updatedAt,
      ageMs: age,
      stale: age > maxAgeMs,
      source: "memory",
    };
  }

  for (const name of cacheNamesForRead(mode, addressId)) {
    const entry = await readOfflineCache(name, readDossierCache);
    if (!entry) continue;
    const keyMode = name.includes(".summary.") || name.startsWith(LEGACY_INSIGHT_CACHE_PREFIX)
      ? "summary"
      : "full";
    memoryCache.set(memoryKey(keyMode, addressId), entry);
    const age = ageMs(entry.updatedAt, nowMs);
    return {
      data: entry.data,
      updatedAt: entry.updatedAt,
      ageMs: age,
      stale: age > maxAgeMs,
      source: "disk",
    };
  }

  return null;
}

export async function writeHomeDossierCache(
  addressId: string | null | undefined,
  mode: HomeDossierCacheMode,
  dossier: HomeDossierResponse,
  now: Date = new Date(),
): Promise<void> {
  if (!addressId) return;
  const entry: MemoryEntry = { data: dossier, updatedAt: now.toISOString() };
  memoryCache.set(memoryKey(mode, addressId), entry);
  await writeOfflineCache(cacheName(mode, addressId), dossier, now);

  if (mode === "full" && shouldMirrorFullToSummary(dossier)) {
    memoryCache.set(memoryKey("summary", addressId), entry);
    await writeOfflineCache(cacheName("summary", addressId), dossier, now);
  }
}

export async function fetchHomeDossier(
  addressId: string | null | undefined,
  mode: HomeDossierCacheMode = "full",
  options: { force?: boolean; maxAgeMs?: number } = {},
): Promise<HomeDossierFetchResult> {
  if (!addressId) {
    return { data: null, fromCache: false, stale: false, error: false, updatedAt: null };
  }

  const cached = await readHomeDossierCache(addressId, mode, { maxAgeMs: options.maxAgeMs });
  if (cached && !options.force && !cached.stale) {
    return {
      data: cached.data,
      fromCache: true,
      stale: false,
      error: false,
      updatedAt: cached.updatedAt,
    };
  }

  const res = await api.get<HomeDossierResponse>(
    `/api/addresses/${addressId}/dossier`,
    mode === "summary" ? { summary: "1" } : undefined,
  );

  if (res.error) {
    return {
      data: cached?.data ?? null,
      fromCache: !!cached,
      stale: !!cached,
      error: true,
      updatedAt: cached?.updatedAt ?? null,
    };
  }

  const next = res.data ?? null;
  if (next) {
    await writeHomeDossierCache(addressId, mode, next);
  }

  return {
    data: next,
    fromCache: false,
    stale: false,
    error: false,
    updatedAt: next ? new Date().toISOString() : null,
  };
}

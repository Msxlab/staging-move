import { useCallback, useEffect, useRef, useState } from "react";
import { peekOfflineCache, readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";

export function detailCacheKey(screen: string, id?: string | null): string | null {
  return id ? `detail.${screen}.${id}` : null;
}

export function useDetailOfflineCache<T>(
  cacheName: string | null,
  sanitize: (raw: unknown) => T | null,
) {
  const initial = cacheName ? peekOfflineCache(cacheName, sanitize) : null;
  const [data, setDataState] = useState<T | null>(() => initial?.data ?? null);
  const [loading, setLoading] = useState(() => !initial);
  const hasDataRef = useRef(Boolean(initial));

  useEffect(() => {
    let cancelled = false;

    if (!cacheName) {
      setDataState(null);
      hasDataRef.current = false;
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const memoryEntry = peekOfflineCache(cacheName, sanitize);
    if (memoryEntry) {
      setDataState(memoryEntry.data);
      hasDataRef.current = true;
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    hasDataRef.current = false;
    setDataState(null);
    setLoading(true);

    (async () => {
      const cached = await readOfflineCache(cacheName, sanitize);
      if (cancelled || !cached) return;
      setDataState(cached.data);
      hasDataRef.current = true;
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheName, sanitize]);

  const setCachedData = useCallback(
    (next: T | null, now: Date = new Date()) => {
      setDataState(next);
      hasDataRef.current = next !== null;
      setLoading(false);
      if (cacheName && next !== null) {
        void writeOfflineCache(cacheName, next, now);
      }
    },
    [cacheName],
  );

  const startForegroundLoad = useCallback(() => {
    if (!hasDataRef.current) setLoading(true);
  }, []);

  return {
    data,
    setCachedData,
    loading,
    setLoading,
    hasDataRef,
    startForegroundLoad,
  };
}

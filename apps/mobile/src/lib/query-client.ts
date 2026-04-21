import { QueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

/**
 * React Query client tuned for a mobile app that users will open on flaky
 * networks (subway, elevator, rural drive). Defaults:
 *
 *  - `networkMode: "offlineFirst"` lets queries serve cached data instantly
 *    even when the OS reports offline, instead of hanging with a spinner.
 *  - `gcTime: 7 days` keeps responses around long enough to survive the
 *    persister's `maxAge`; shorter GC would evict data before a cold start
 *    can rehydrate it.
 *  - Retries stay conservative (1 for reads, 0 for writes) so we don't
 *    double-post a mutation when the radio briefly drops.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 7 * 24 * 60 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        networkMode: "offlineFirst",
      },
      mutations: {
        retry: 0,
        networkMode: "online",
      },
    },
  });
}

/**
 * AsyncStorage-backed persister. The PersistQueryClientProvider (wired in
 * apps/mobile/app/_layout.tsx) uses this to hydrate the query cache on
 * boot and write it back on every query change.
 *
 * `buster` bumps invalidate the whole cache without any user action — use
 * it when shipping an API breaking change that would make stale cached
 * responses dangerous to render.
 */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "locateflow.reactquery.v1",
  // 7 days — matches gcTime so a user who opens the app after a week gets
  // a clean re-fetch instead of a week-stale dashboard.
  throttleTime: 1_000,
});

export const PERSISTER_OPTIONS = {
  persister: asyncStoragePersister,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  buster: "v1",
} as const;

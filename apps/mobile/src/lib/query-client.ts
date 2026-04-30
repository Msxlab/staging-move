import { QueryClient } from "@tanstack/react-query";

/**
 * React Query client tuned for mobile reads on flaky networks.
 *
 * Query results stay in memory only. We intentionally do not persist the cache
 * because addresses, budgets, and service costs are personal data.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60 * 1000,
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

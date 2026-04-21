import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Provider {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  scope: string;
  states: string[];
  zipCodes: string[];
  tags: string[];
  popularityScore: number;
  displayOrder: number;
  coverageModel?: string;
  coverageMatchLevel?: string;
  coverageNote?: string | null;
  coverageSourceUrl?: string | null;
  requiresAddressCheck?: boolean;
  requiresPolygonCheck?: boolean;
}

interface ProvidersResponse {
  providers: Provider[];
  grouped: Record<string, Provider[]>;
  total: number;
  meta: {
    effectiveState: string | null;
    zipMatchLevel: string | null;
    coordinatesUsed?: boolean;
  };
}

interface ProviderQuery {
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  category?: string;
  scope?: "FEDERAL" | "STATE";
  q?: string;
  tags?: string;
}

function providersKey(q: ProviderQuery) {
  return [
    "providers",
    q.state ?? "",
    q.zip ?? "",
    q.lat ?? "",
    q.lng ?? "",
    q.category ?? "",
    q.scope ?? "",
    q.q ?? "",
    q.tags ?? "",
  ] as const;
}

async function fetchProviders(q: ProviderQuery): Promise<ProvidersResponse> {
  const params: Record<string, string> = {};
  if (q.state) params.state = q.state;
  if (q.zip) params.zip = q.zip;
  if (typeof q.lat === "number") params.lat = q.lat.toString();
  if (typeof q.lng === "number") params.lng = q.lng.toString();
  if (q.category) params.category = q.category;
  if (q.scope) params.scope = q.scope;
  if (q.q) params.q = q.q;
  if (q.tags) params.tags = q.tags;
  const res = await api.get<ProvidersResponse>("/api/providers", params);
  if (res.error || !res.data) throw new Error(res.error || "Failed to fetch providers");
  return res.data;
}

export function useProviders(query: ProviderQuery = {}, enabled = true) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: providersKey(query),
    queryFn: () => fetchProviders(query),
    enabled,
    staleTime: 5 * 60_000,
  });

  return {
    providers: data?.providers ?? [],
    grouped: data?.grouped ?? {},
    meta: data?.meta,
    total: data?.total ?? 0,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

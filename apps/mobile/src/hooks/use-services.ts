import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Service {
  id: string;
  category: string;
  providerName: string;
  monthlyCost?: number;
  isActive: boolean;
  address?: { nickname?: string; city: string; state: string };
}

interface ServiceFilters {
  addressId?: string;
  category?: string;
  search?: string;
}

function servicesKey(filters?: ServiceFilters) {
  return ["services", filters?.addressId ?? "", filters?.category ?? "", filters?.search ?? ""] as const;
}

async function fetchServices(filters?: ServiceFilters): Promise<Service[]> {
  const params: Record<string, string> = {};
  if (filters?.addressId) params.addressId = filters.addressId;
  if (filters?.category) params.category = filters.category;
  if (filters?.search) params.search = filters.search;
  const res = await api.get<{ services: Service[] }>("/api/services", params);
  if (res.error || !res.data) throw new Error(res.error || "Failed to fetch");
  return res.data.services;
}

export function useServices(filters?: ServiceFilters) {
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: servicesKey(filters),
    queryFn: () => fetchServices(filters),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Service>) => {
      const res = await api.post<{ service: Service }>("/api/services", payload);
      if (res.error || !res.data) throw new Error(res.error || "Failed to create");
      return res.data.service;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/services/${id}`);
      if (res.error) throw new Error(res.error);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });

  return {
    services: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    createService: createMutation.mutateAsync,
    deleteService: deleteMutation.mutateAsync,
  };
}

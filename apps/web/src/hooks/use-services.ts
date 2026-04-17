import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  const params = new URLSearchParams();
  if (filters?.addressId) params.set("addressId", filters.addressId);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.search) params.set("search", filters.search);
  const res = await fetch(`/api/services?${params}`);
  if (!res.ok) throw new Error("Failed to fetch");
  const data = await res.json();
  return data.services as Service[];
}

export function useServices(filters?: ServiceFilters) {
  const qc = useQueryClient();
  const key = servicesKey(filters);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => fetchServices(filters),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Service>) => {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create");
      const result = await res.json();
      return result.service as Service;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
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

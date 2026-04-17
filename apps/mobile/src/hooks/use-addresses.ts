import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Address {
  id: string;
  type: string;
  nickname?: string;
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  isPrimary: boolean;
  ownership: string;
  startDate: string;
}

const ADDRESSES_KEY = ["addresses"] as const;

async function fetchAddresses(): Promise<Address[]> {
  const res = await api.get<{ addresses: Address[] }>("/api/addresses");
  if (res.error || !res.data) throw new Error(res.error || "Failed to fetch");
  return res.data.addresses;
}

export function useAddresses() {
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ADDRESSES_KEY,
    queryFn: fetchAddresses,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Address>) => {
      const res = await api.post<{ address: Address }>("/api/addresses", payload);
      if (res.error || !res.data) throw new Error(res.error || "Failed to create");
      return res.data.address;
    },
    onSuccess: (address) => {
      qc.setQueryData<Address[]>(ADDRESSES_KEY, (prev) => (prev ? [address, ...prev] : [address]));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/addresses/${id}`);
      if (res.error) throw new Error(res.error);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<Address[]>(ADDRESSES_KEY, (prev) => prev?.filter((a) => a.id !== id) ?? []);
    },
  });

  return {
    addresses: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    createAddress: createMutation.mutateAsync,
    deleteAddress: deleteMutation.mutateAsync,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  services?: { id: string }[];
}

const ADDRESSES_KEY = ["addresses"] as const;

async function fetchAddresses(): Promise<Address[]> {
  const res = await fetch("/api/addresses");
  if (!res.ok) throw new Error("Failed to fetch");
  const data = await res.json();
  return data.addresses as Address[];
}

export function useAddresses() {
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ADDRESSES_KEY,
    queryFn: fetchAddresses,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Address>) => {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create");
      const result = await res.json();
      return result.address as Address;
    },
    onSuccess: (address) => {
      qc.setQueryData<Address[]>(ADDRESSES_KEY, (prev) => (prev ? [address, ...prev] : [address]));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to delete");
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

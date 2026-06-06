import { normalizeProviderName } from "@locateflow/shared";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";

export interface ServiceDuplicateLookup {
  service: {
    findMany: (args: any) => Promise<ServiceDuplicateRecord[]>;
  };
}

export interface ServiceDuplicateRecord {
  id: string;
  providerName: string;
  providerId?: string | null;
  customProviderId?: string | null;
}

export interface ServiceDuplicateCandidate {
  userId: string;
  workspaceId?: string | null;
  addressId: string;
  category: string;
  providerName: string;
  providerId?: string | null;
  customProviderId?: string | null;
  ignoreServiceId?: string | null;
}

function cleanCategory(value: string): string {
  return value.trim().toUpperCase();
}

export async function findDuplicateTrackedService(
  db: ServiceDuplicateLookup,
  input: ServiceDuplicateCandidate,
): Promise<ServiceDuplicateRecord | null> {
  const category = cleanCategory(input.category);
  const normalizedName = normalizeProviderName(input.providerName);
  const candidates = await db.service.findMany({
    where: activeTrackedServiceWhereForScope(
      { userId: input.userId, workspaceId: input.workspaceId },
      { addressId: input.addressId, category },
    ),
    select: {
      id: true,
      providerName: true,
      providerId: true,
      customProviderId: true,
    },
  });

  return (
    candidates.find((service) => {
      if (service.id === input.ignoreServiceId) return false;
      if (input.providerId && service.providerId === input.providerId) return true;
      if (input.customProviderId && service.customProviderId === input.customProviderId) return true;
      return normalizeProviderName(service.providerName) === normalizedName;
    }) || null
  );
}

export function duplicateServiceError(existing: ServiceDuplicateRecord) {
  return {
    code: "DUPLICATE_ACTIVE_SERVICE",
    error: "You already track this provider for that address and category.",
    existingServiceId: existing.id,
  };
}

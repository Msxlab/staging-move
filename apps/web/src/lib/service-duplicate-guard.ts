import { normalizeProviderName } from "@locateflow/shared";

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

const NON_TRACKED_SERVICE_ACTIONS = [
  "CANCEL",
  "CANCELED",
  "CANCELLED",
  "REMOVE",
  "REMOVED",
  "ARCHIVE",
  "ARCHIVED",
];

export async function findDuplicateTrackedService(
  db: ServiceDuplicateLookup,
  input: ServiceDuplicateCandidate,
): Promise<ServiceDuplicateRecord | null> {
  const category = cleanCategory(input.category);
  const normalizedName = normalizeProviderName(input.providerName);
  const candidates = await db.service.findMany({
    where: {
      userId: input.userId,
      addressId: input.addressId,
      category,
      isActive: true,
      deletedAt: null,
      OR: [
        { migrationAction: null },
        { migrationAction: { notIn: NON_TRACKED_SERVICE_ACTIONS } },
      ],
    },
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
    error: "You already track this provider for that address and category.",
    existingServiceId: existing.id,
  };
}

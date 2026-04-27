import { normalizeProviderName } from "@locateflow/shared";

export interface CustomProviderDuplicateLookup {
  userCustomProvider: {
    findMany: (args: any) => Promise<Array<{ id: string; name: string }>>;
  };
  serviceProvider: {
    findMany: (args: any) => Promise<Array<{ id: string; name: string; slug: string }>>;
  };
}

export interface CustomProviderDuplicateInput {
  userId: string;
  name: string;
  category: string;
  ignoreCustomProviderId?: string | null;
}

function cleanCategory(value: string): string {
  return value.trim().toUpperCase();
}

export async function findDuplicateCustomProvider(
  db: Pick<CustomProviderDuplicateLookup, "userCustomProvider">,
  input: CustomProviderDuplicateInput,
): Promise<{ id: string; name: string } | null> {
  const normalizedName = normalizeProviderName(input.name);
  const providers = await db.userCustomProvider.findMany({
    where: {
      userId: input.userId,
      category: cleanCategory(input.category),
      deletedAt: null,
    },
    select: { id: true, name: true },
    take: 100,
  });

  return (
    providers.find(
      (provider) =>
        provider.id !== input.ignoreCustomProviderId &&
        normalizeProviderName(provider.name) === normalizedName,
    ) || null
  );
}

export async function findListedProviderNameConflict(
  db: Pick<CustomProviderDuplicateLookup, "serviceProvider">,
  input: Pick<CustomProviderDuplicateInput, "name" | "category">,
): Promise<{ id: string; name: string; slug: string } | null> {
  const normalizedName = normalizeProviderName(input.name);
  const providers = await db.serviceProvider.findMany({
    where: {
      category: cleanCategory(input.category),
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, name: true, slug: true },
    take: 100,
  });

  return (
    providers.find((provider) => normalizeProviderName(provider.name) === normalizedName) ||
    null
  );
}

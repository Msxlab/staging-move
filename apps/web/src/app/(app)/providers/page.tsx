import { unstable_cache } from "next/cache";
import { resolveEffectiveState } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { ProvidersClient, type ProviderItem, type AddressOption } from "./providers-client";

// Page is user-scoped (user's addresses drive the view) — dynamic is
// required. But the provider catalog itself is global and changes rarely,
// so we cache just that query under a `providers` tag. Admin mutations
// already call revalidateTag("providers"), so this stays fresh without a
// time-based refetch.
export const dynamic = "force-dynamic";

const getActiveProviders = unstable_cache(
  async (effectiveState: string | null) =>
    prisma.serviceProvider.findMany({
      where: {
        isActive: true,
        ...(effectiveState
          ? { OR: [{ scope: "FEDERAL" }, { coverages: { some: { state: effectiveState } } }] }
          : { scope: "FEDERAL" }),
      },
      orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
      take: 200,
    }),
  ["active-providers-by-user-state"],
  { tags: ["providers"], revalidate: 300 },
);

type ProviderRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  logoUrl: string | null;
  scope: string;
  states: string;
  zipCodes: string;
  tags: string;
  popularityScore: number;
  displayOrder: number;
  userCount?: number;
};

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function ProvidersPage() {
  const userId = await requireDbUserId();

  const addresses = await prisma.address.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });

  const addressOptions: AddressOption[] = addresses.map((a) => ({
    id: a.id,
    nickname: a.nickname ?? undefined,
    city: a.city,
    state: a.state,
    zip: a.zip,
    isPrimary: a.isPrimary,
  }));

  const primaryAddress = addressOptions.find((a) => a.isPrimary) || addressOptions[0] || null;
  const effectiveState = resolveEffectiveState(primaryAddress?.state ?? null, primaryAddress?.zip ?? null) ?? null;
  const providerRows = (await getActiveProviders(effectiveState)) as unknown as ProviderRow[];

  const initialProviders: ProviderItem[] = providerRows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    subCategory: p.subCategory,
    description: p.description,
    website: p.website,
    phone: p.phone,
    logoUrl: p.logoUrl,
    scope: p.scope,
    states: parseJsonArray(p.states),
    zipCodes: parseJsonArray(p.zipCodes),
    tags: parseJsonArray(p.tags),
    popularityScore: p.popularityScore || 0,
    displayOrder: p.displayOrder || 0,
    userCount: p.userCount || 0,
  }));

  return (
    <ProvidersClient
      initialProviders={initialProviders}
      addresses={addressOptions}
      initialState={primaryAddress?.state ?? null}
      initialZip={primaryAddress?.zip ?? null}
      initialAddressId={primaryAddress?.id ?? null}
    />
  );
}

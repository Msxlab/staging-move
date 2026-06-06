import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";
import { ProvidersClient, type ProviderItem, type AddressOption } from "./providers-client";

// Page is user-scoped (user's addresses drive the view) — dynamic is
// required. But the provider catalog itself is global and changes rarely,
// so we cache just that query under a `providers` tag. Admin mutations
// already call revalidateTag("providers"), so this stays fresh without a
// time-based refetch.
export const dynamic = "force-dynamic";

const getActiveProviders = unstable_cache(
  async () =>
    prisma.serviceProvider.findMany({
      where: { isActive: true },
      orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
      take: 200,
    }),
  ["active-providers-top-200"],
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
  affiliateActive?: boolean;
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
  const request = new Request("http://locateflow.local", { headers: await headers() });
  const scope = await resolveWorkspaceDataScope(request, userId);

  const [addresses, providerRows] = await Promise.all([
    prisma.address.findMany({
      where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    }),
    getActiveProviders() as unknown as Promise<ProviderRow[]>,
  ]);

  const addressOptions: AddressOption[] = addresses.map((a) => ({
    id: a.id,
    nickname: a.nickname ?? undefined,
    city: a.city,
    state: a.state,
    zip: a.zip,
    isPrimary: a.isPrimary,
  }));

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
    affiliateActive: p.affiliateActive === true,
  }));

  const primaryAddress = addressOptions.find((a) => a.isPrimary) || addressOptions[0] || null;

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

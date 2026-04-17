import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { ProvidersClient, type ProviderItem, type AddressOption } from "./providers-client";

export const dynamic = "force-dynamic";

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
  tags: string;
  popularityScore: number;
  displayOrder: number;
  avgRating?: number | null;
  reviewCount?: number;
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

  const [addresses, providerRows] = await Promise.all([
    prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    }),
    prisma.serviceProvider.findMany({
      where: { isActive: true },
      orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
      take: 200,
    }) as unknown as Promise<ProviderRow[]>,
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
    tags: parseJsonArray(p.tags),
    popularityScore: p.popularityScore || 0,
    displayOrder: p.displayOrder || 0,
    avgRating: p.avgRating ?? null,
    reviewCount: p.reviewCount || 0,
    userCount: p.userCount || 0,
  }));

  const primaryAddress = addressOptions.find((a) => a.isPrimary) || addressOptions[0] || null;

  return (
    <ProvidersClient
      initialProviders={initialProviders}
      addresses={addressOptions}
      initialState={primaryAddress?.state ?? null}
      initialAddressId={primaryAddress?.id ?? null}
    />
  );
}

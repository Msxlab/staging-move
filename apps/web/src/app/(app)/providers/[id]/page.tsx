import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { ProviderDetailClient, type ProviderDetail } from "./detail-client";

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

function shape(p: ProviderRow): ProviderDetail {
  return {
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
  };
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let userId: string | null = null;
  try {
    userId = await requireDbUserId();
  } catch {
    redirect("/login");
  }

  const provider = (await prisma.serviceProvider.findFirst({
    where: { id, isActive: true },
  })) as ProviderRow | null;

  if (!provider) {
    notFound();
  }

  const [primaryAddress, alternativesRaw, stateRuleRow] = await Promise.all([
    prisma.address.findFirst({
      where: { userId: userId!, deletedAt: null, isPrimary: true },
      select: { id: true, state: true, zip: true, city: true, nickname: true },
    }),
    prisma.serviceProvider.findMany({
      where: { isActive: true, category: provider.category, id: { not: provider.id } },
      orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
      take: 4,
    }) as unknown as Promise<ProviderRow[]>,
    prisma.address
      .findFirst({
        where: { userId: userId!, deletedAt: null, isPrimary: true },
        select: { state: true },
      })
      .then(async (a) =>
        a?.state ? prisma.stateRule.findUnique({ where: { stateCode: a.state } }) : null
      ),
  ]);

  return (
    <ProviderDetailClient
      provider={shape(provider)}
      alternatives={alternativesRaw.map(shape)}
      primaryAddress={
        primaryAddress
          ? {
              id: primaryAddress.id,
              state: primaryAddress.state,
              zip: primaryAddress.zip,
              city: primaryAddress.city,
              nickname: primaryAddress.nickname ?? null,
            }
          : null
      }
      stateRule={
        stateRuleRow
          ? {
              stateCode: stateRuleRow.stateCode,
              stateName: stateRuleRow.stateName,
              dmvRules: stateRuleRow.dmvRules ?? null,
              voterRegistration: stateRuleRow.voterRegistration ?? null,
              taxInfo: stateRuleRow.taxInfo ?? null,
            }
          : null
      }
    />
  );
}

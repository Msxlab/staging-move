import { notFound, redirect } from "next/navigation";
import { getProviderCoverageMetadata, type ProviderCoverageModel } from "@locateflow/db";
import { getProviderTrustSummary } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { getProviderMatchLevelFromDb } from "@/lib/provider-matching";
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
  coverageModel?: string | null;
  tags: string;
  popularityScore: number;
  displayOrder: number;
  userCount?: number;
  affiliateActive?: boolean;
  coverages?: Array<{
    state: string | null;
    zipPrefix: string | null;
    zipExact: string | null;
  }>;
};

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type CoverageAddress = {
  state: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
} | null;

function shape(p: ProviderRow, address: CoverageAddress): ProviderDetail {
  const states = parseJsonArray(p.states);
  const zipCodes = parseJsonArray(p.zipCodes);
  const tags = parseJsonArray(p.tags);
  const metadata = getProviderCoverageMetadata(p.slug);
  const coverageModel: ProviderCoverageModel =
    (p.coverageModel as ProviderCoverageModel | null | undefined) ||
    metadata?.coverageModel ||
    (zipCodes.length > 0 ? "zip_prefix" : "state");
  // Pass the full address (zip + coordinates when known) so ZIP- and
  // polygon-level coverage can resolve instead of always falling back to a
  // coarse state-level match.
  const coverageMatchLevel = getProviderMatchLevelFromDb(
    {
      id: p.id,
      slug: p.slug,
      scope: p.scope,
      coverageModel,
      coverages: p.coverages || [],
    },
    {
      state: address?.state ?? null,
      zip: address?.zip ?? null,
      latitude: address?.latitude ?? null,
      longitude: address?.longitude ?? null,
    },
  );
  const requiresAddressCheck = coverageModel === "live_address";
  const requiresPolygonCheck = coverageModel === "polygon";
  const coverageNote = metadata?.note || null;
  const coverageSourceUrl = metadata?.officialUrl || null;
  const trust = getProviderTrustSummary({
    ...p,
    states,
    zipCodes,
    tags,
    coverageModel,
    coverageMatchLevel,
    coverageNote,
    coverageSourceUrl,
    requiresAddressCheck,
    requiresPolygonCheck,
  });

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
    states,
    zipCodes,
    tags,
    popularityScore: p.popularityScore || 0,
    displayOrder: p.displayOrder || 0,
    userCount: p.userCount || 0,
    affiliateActive: p.affiliateActive === true,
    coverageModel,
    coverageMatchLevel,
    coverageNote,
    coverageSourceUrl,
    requiresAddressCheck,
    requiresPolygonCheck,
    coverageConfidence: trust.coverageConfidence,
    trust,
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
    redirect(`/sign-in?redirect=${encodeURIComponent(`/providers/${id}`)}`);
  }

  const provider = (await prisma.serviceProvider.findFirst({
    where: { id, isActive: true },
    include: { coverages: true },
  })) as ProviderRow | null;

  if (!provider) {
    notFound();
  }

  const [primaryAddress, alternativesRaw, stateRuleRow] = await Promise.all([
    prisma.address.findFirst({
      where: { userId: userId!, deletedAt: null, isPrimary: true },
      select: { id: true, state: true, zip: true, city: true, nickname: true, latitude: true, longitude: true },
    }),
    prisma.serviceProvider.findMany({
      where: { isActive: true, category: provider.category, id: { not: provider.id } },
      include: { coverages: true },
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
      provider={shape(provider, primaryAddress)}
      alternatives={alternativesRaw.map((alt) => shape(alt, primaryAddress))}
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

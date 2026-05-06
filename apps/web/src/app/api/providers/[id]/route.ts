import { NextRequest, NextResponse } from "next/server";
import { getProviderCoverageMetadata, type ProviderCoverageModel } from "@locateflow/db";
import { getProviderTrustSummary, isProviderResourceOnly, providerRequiresAddressCheck } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getProviderMatchLevelFromDb } from "@/lib/provider-matching";

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
  coverages?: Array<{
    state: string | null;
    zipPrefix: string | null;
    zipExact: string | null;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeAlts = searchParams.get("alternatives") !== "0";
    const stateParam = searchParams.get("state")?.toUpperCase() || null;

    const provider = (await prisma.serviceProvider.findFirst({
      where: { id, isActive: true },
      include: {
        coverages: stateParam ? { where: { state: stateParam } } : true,
      },
    })) as ProviderRow | null;

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Find 4 alternatives in the same category (state-scoped if provided).
    let alternatives: ProviderRow[] = [];
    if (includeAlts) {
      const altWhere: Record<string, unknown> = {
        isActive: true,
        category: provider.category,
        id: { not: provider.id },
      };
      if (stateParam) {
        altWhere.OR = [
          { scope: "FEDERAL" },
          { coverages: { some: { state: stateParam } } },
        ];
      } else {
        altWhere.scope = "FEDERAL";
      }
      alternatives = (await prisma.serviceProvider.findMany({
        where: altWhere,
        include: {
          coverages: stateParam ? { where: { state: stateParam } } : true,
        },
        orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
        take: 4,
      })) as ProviderRow[];
    }

    return NextResponse.json({
      provider: shape(provider, stateParam),
      alternatives: alternatives.map((alt) => shape(alt, stateParam)),
    });
  } catch (error) {
    console.error("Failed to fetch provider:", error);
    return NextResponse.json({ error: "Failed to fetch provider" }, { status: 500 });
  }
}

function shape(p: ProviderRow, state: string | null) {
  const states = safeJsonParse(p.states, []) as string[];
  const zipCodes = safeJsonParse(p.zipCodes, []) as string[];
  const tags = safeJsonParse(p.tags, []) as string[];
  const metadata = getProviderCoverageMetadata(p.slug);
  const coverageModel: ProviderCoverageModel = metadata?.coverageModel || (zipCodes.length > 0 ? "zip_prefix" : "state");
  const coverageMatchLevel = getProviderMatchLevelFromDb(
    {
      id: p.id,
      slug: p.slug,
      scope: p.scope,
      tags,
      coverageModel,
      coverages: p.coverages || [],
    },
    { state },
  );
  const requiresAddressCheck = providerRequiresAddressCheck({ ...p, tags, coverageModel });
  const requiresPolygonCheck = coverageModel === "polygon";
  const resourceOnly = isProviderResourceOnly({ ...p, tags });
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
    resourceOnly,
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
    popularityScore: p.popularityScore,
    displayOrder: p.displayOrder,
    userCount: p.userCount || 0,
    coverageModel,
    coverageMatchLevel,
    coverageNote,
    coverageSourceUrl,
    requiresAddressCheck,
    requiresPolygonCheck,
    resourceOnly,
    coverageConfidence: trust.coverageConfidence,
    trust,
  };
}

function safeJsonParse(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

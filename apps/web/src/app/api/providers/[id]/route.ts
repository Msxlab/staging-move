import { NextRequest, NextResponse } from "next/server";
import { getProviderCoverageMetadata, type ProviderCoverageModel } from "@locateflow/db";
import { getProviderTrustSummary } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getProviderPresentationMatchLevelFromDb, resolveEffectiveState } from "@/lib/provider-matching";
import {
  applyProviderServiceabilityMatchLevel,
  enrichProviderServiceability,
} from "@/lib/provider-serviceability";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

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
  fccServiceable?: boolean;
  utilityServiceable?: boolean;
  coverages?: Array<{
    state: string | null;
    zipPrefix: string | null;
    zipExact: string | null;
  }>;
};

type CoverageContext = {
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = await rateLimit(getRateLimitKey(request, "providers:detail"), { limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } },
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeAlts = searchParams.get("alternatives") !== "0";
    const stateParam = searchParams.get("state")?.toUpperCase() || null;
    const zipParam = searchParams.get("zip")?.trim() || null;
    const latitude = parseFiniteNumber(searchParams.get("lat"));
    const longitude = parseFiniteNumber(searchParams.get("lng"));
    const effectiveState = resolveEffectiveState(stateParam, zipParam) || stateParam;
    const coverageContext: CoverageContext = {
      state: effectiveState,
      zip: zipParam,
      latitude,
      longitude,
    };

    const provider = (await prisma.serviceProvider.findFirst({
      where: { id, isActive: true },
      include: {
        coverages: effectiveState ? { where: { state: effectiveState } } : true,
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
      if (effectiveState) {
        altWhere.OR = [
          { scope: "FEDERAL" },
          { coverages: { some: { state: effectiveState } } },
        ];
      }
      alternatives = (await prisma.serviceProvider.findMany({
        where: altWhere,
        include: {
          coverages: effectiveState ? { where: { state: effectiveState } } : true,
        },
        orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
        take: 4,
      })) as ProviderRow[];
    }

    await enrichProviderServiceability([provider, ...alternatives], {
      latitude,
      longitude,
    });

    return NextResponse.json({
      provider: shape(provider, coverageContext),
      alternatives: alternatives.map((alt) => shape(alt, coverageContext)),
    });
  } catch (error) {
    console.error("Failed to fetch provider:", error);
    return NextResponse.json({ error: "Failed to fetch provider" }, { status: 500 });
  }
}

function shape(p: ProviderRow, coverageContext: CoverageContext) {
  const states = safeJsonParse(p.states, []) as string[];
  const zipCodes = safeJsonParse(p.zipCodes, []) as string[];
  const tags = safeJsonParse(p.tags, []) as string[];
  const metadata = getProviderCoverageMetadata(p.slug);
  const coverageModel: ProviderCoverageModel =
    (p.coverageModel as ProviderCoverageModel | null | undefined) ||
    metadata?.coverageModel ||
    (zipCodes.length > 0 ? "zip_prefix" : "state");
  const coverageMatchLevel = applyProviderServiceabilityMatchLevel(
    p,
    getProviderPresentationMatchLevelFromDb(
      {
        id: p.id,
        slug: p.slug,
        scope: p.scope,
        coverageModel,
        coverages: p.coverages || [],
      },
      coverageContext,
    ),
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
    affiliateActive: p.affiliateActive === true,
    scope: p.scope,
    states,
    zipCodes,
    tags,
    popularityScore: p.popularityScore,
    displayOrder: p.displayOrder,
    userCount: p.userCount || 0,
    fccServiceable: p.fccServiceable === true,
    utilityServiceable: p.utilityServiceable === true,
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

function safeJsonParse(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseFiniteNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

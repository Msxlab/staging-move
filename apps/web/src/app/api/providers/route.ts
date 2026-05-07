import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getProviderCoverageMetadata, type ProviderCoverageModel } from "@locateflow/db";
import { compareCoverageConfidence, getProviderTrustSummary } from "@locateflow/shared";
import { getProviderCoverageConfidenceFromDb, getProviderMatchLevelFromDb, resolveEffectiveState, safeJsonArray, tierProvidersFromDb } from "@/lib/provider-matching";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const fetchProvidersForState = unstable_cache(
  async (effectiveState: string, category: string | null, scope: string | null) => {
    if (!effectiveState && scope === "STATE") {
      return [];
    }

    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;
    if (scope === "FEDERAL" || scope === "STATE") where.scope = scope;
    if (effectiveState) {
      where.OR = [
        { scope: "FEDERAL" },
        { coverages: { some: { state: effectiveState } } },
      ];
    } else if (!scope) {
      where.scope = "FEDERAL";
    }
    return prisma.serviceProvider.findMany({
      where,
      include: {
        coverages: effectiveState ? { where: { state: effectiveState } } : false,
      },
      orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
    });
  },
  ["providers-by-state"],
  { revalidate: 3600, tags: ["providers"] }
);

// GET /api/providers?state=TX&category=UTILITY_ELECTRIC&scope=FEDERAL&q=chase&tags=pet,kids&zip=78701
export async function GET(request: NextRequest) {
  try {
    const rl = await rateLimit(getRateLimitKey(request, "providers"), { limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } }
      );
    }

    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state")?.toUpperCase();
    const zip = searchParams.get("zip")?.trim();
    const latitudeParam = searchParams.get("lat");
    const longitudeParam = searchParams.get("lng");
    const category = searchParams.get("category");
    const scope = searchParams.get("scope");
    const q = searchParams.get("q");
    const tagsParam = searchParams.get("tags");
    const latitude = latitudeParam !== null ? Number(latitudeParam) : null;
    const longitude = longitudeParam !== null ? Number(longitudeParam) : null;
    const normalizedLatitude = Number.isFinite(latitude) ? latitude : null;
    const normalizedLongitude = Number.isFinite(longitude) ? longitude : null;

    const effectiveState = resolveEffectiveState(state, zip);

    let providers: Awaited<ReturnType<typeof fetchProvidersForState>>;
    if (q) {
      if (!effectiveState && scope === "STATE") {
        providers = [];
      } else {
        // Search across name + description + tags (tags are a JSON string column).
        const searchConditions: Record<string, unknown>[] = [
          { name: { contains: q } },
          { description: { contains: q } },
          { tags: { contains: q } },
        ];
        const where: Record<string, unknown> = {
          isActive: true,
          AND: [{ OR: searchConditions }],
        };
        if (category) where.category = category;
        if (scope === "FEDERAL" || scope === "STATE") where.scope = scope;
        if (effectiveState) {
          (where.AND as Record<string, unknown>[]).push({
            OR: [
              { scope: "FEDERAL" },
              { coverages: { some: { state: effectiveState } } },
            ],
          });
        } else if (!scope) {
          where.scope = "FEDERAL";
        }
        providers = await prisma.serviceProvider.findMany({
          where,
          include: {
            coverages: effectiveState ? { where: { state: effectiveState } } : false,
          },
          orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
        });
      }
    } else {
      providers = await fetchProvidersForState(effectiveState || "", category, scope);
    }

    const providersWithCoverageMetadata = providers.map((p) => {
      const metadata = getProviderCoverageMetadata(p.slug);
      const zipCodes = safeJsonArray(p.zipCodes);
      const coverageModel: ProviderCoverageModel = metadata?.coverageModel || (zipCodes.length > 0 ? "zip_prefix" : "state");

      return {
        ...p,
        zipCodes,
        coverageModel,
        coverageNote: metadata?.note || null,
        coverageSourceUrl: metadata?.officialUrl || null,
        coverages: "coverages" in p && Array.isArray((p as { coverages?: unknown }).coverages)
          ? (p as unknown as { coverages: { state: string | null; zipPrefix: string | null; zipExact: string | null }[] }).coverages
          : [],
      };
    });

    const tiered = tierProvidersFromDb(providersWithCoverageMetadata, {
      state,
      zip,
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
    });

    let filtered = tiered.providers;

    if (tagsParam) {
      const requested = tagsParam.split(",").map((t) => t.trim().toLowerCase());
      filtered = filtered.filter((p) => {
        const providerTags = safeJsonArray(p.tags).map((t) => t.toLowerCase());
        return requested.some((rt) => providerTags.includes(rt));
      });
    }

    filtered.sort((a, b) => {
      const confidenceRank = compareCoverageConfidence(
        getProviderCoverageConfidenceFromDb(a, {
          state,
          zip,
          latitude: normalizedLatitude,
          longitude: normalizedLongitude,
        }),
        getProviderCoverageConfidenceFromDb(b, {
          state,
          zip,
          latitude: normalizedLatitude,
          longitude: normalizedLongitude,
        }),
      );
      if (confidenceRank !== 0) return confidenceRank;
      const da = a.displayOrder > 0 ? a.displayOrder : Number.MAX_SAFE_INTEGER;
      const db = b.displayOrder > 0 ? b.displayOrder : Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      if (b.popularityScore !== a.popularityScore) return b.popularityScore - a.popularityScore;
      return a.name.localeCompare(b.name);
    });

    const result = filtered.map((p) => {
      const states = safeJsonArray(p.states);
      const zipCodes = Array.isArray((p as { zipCodes?: unknown }).zipCodes) ? ((p as { zipCodes: string[] }).zipCodes) : safeJsonArray(p.zipCodes);
      const tags = safeJsonArray(p.tags);
      const coverageModel = p.coverageModel || "state";
      const coverageMatchLevel = getProviderMatchLevelFromDb(p, {
        state,
        zip,
        latitude: normalizedLatitude,
        longitude: normalizedLongitude,
      });
      const coverageNote = ("coverageNote" in p ? (p as { coverageNote?: string | null }).coverageNote : null) || null;
      const coverageSourceUrl = ("coverageSourceUrl" in p ? (p as { coverageSourceUrl?: string | null }).coverageSourceUrl : null) || null;
      const requiresAddressCheck = coverageModel === "live_address";
      const requiresPolygonCheck = coverageModel === "polygon";
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
        popularityScore: p.popularityScore,
        displayOrder: p.displayOrder,
        coverageModel,
        coverageMatchLevel,
        coverageNote,
        coverageSourceUrl,
        requiresAddressCheck,
        requiresPolygonCheck,
        coverageConfidence: trust.coverageConfidence,
        trust,
      };
    });

    const grouped: Record<string, typeof result> = {};
    for (const p of result) {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    }

    return NextResponse.json({
      providers: result,
      grouped,
      total: result.length,
      meta: {
        effectiveState,
        zipMatchLevel: tiered.zipMatchLevel,
        coordinatesUsed: normalizedLatitude !== null && normalizedLongitude !== null,
        coverageModels: {
          polygon: result.filter((provider) => provider.coverageModel === "polygon").length,
          liveAddress: result.filter((provider) => provider.coverageModel === "live_address").length,
          zipPrefix: result.filter((provider) => provider.coverageModel === "zip_prefix").length,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch providers:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}

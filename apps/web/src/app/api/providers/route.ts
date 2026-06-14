import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getProviderCoverageMetadata, zipCentroid, type ProviderCoverageModel } from "@locateflow/db";
import { compareCoverageConfidence, getProviderBrand, getProviderTrustSummary, inferProviderCoverageModel } from "@locateflow/shared";
import { getProviderCoverageConfidenceFromDb, getProviderPresentationMatchLevelFromDb, resolveEffectiveState, safeJsonArray, tierProvidersFromDb } from "@/lib/provider-matching";
import {
  applyProviderServiceabilityConfidence,
  applyProviderServiceabilityMatchLevel,
  enrichProviderServiceability,
  providerServiceabilityGatedMeta,
} from "@/lib/provider-serviceability";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { optionalRequestHasPlanFeature } from "@/lib/request-entitlements";

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
    let normalizedLatitude = Number.isFinite(latitude) ? latitude : null;
    let normalizedLongitude = Number.isFinite(longitude) ? longitude : null;
    // No coordinates supplied but we have a ZIP → resolve its ZCTA centroid so the
    // directory can still rank by distance (finer than the 3-digit-prefix heuristic).
    if ((normalizedLatitude === null || normalizedLongitude === null) && zip) {
      const centroid = zipCentroid(zip);
      if (centroid) {
        normalizedLatitude = normalizedLatitude ?? centroid.latitude;
        normalizedLongitude = normalizedLongitude ?? centroid.longitude;
      }
    }

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
      // Prefer the admin-set per-provider override, then seed metadata, then
      // the zip-vs-state heuristic. Override is null for un-edited providers.
      const overrideModel = (p as { coverageModel?: string | null }).coverageModel;
      const coverageModel: ProviderCoverageModel =
        (overrideModel as ProviderCoverageModel | undefined) ||
        metadata?.coverageModel ||
        inferProviderCoverageModel({ category: p.category, scope: p.scope, zipCodes });

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

    const canUseDataChecked = await optionalRequestHasPlanFeature(request, "addressValidation");
    const forcedSourceCategories =
      category === "UTILITY_ELECTRIC"
        ? ["UTILITY_ELECTRIC" as const]
        : category === "UTILITY_INTERNET"
          ? ["UTILITY_INTERNET" as const]
          : undefined;
    const serviceability = canUseDataChecked
      ? await enrichProviderServiceability(filtered, {
          latitude: normalizedLatitude,
          longitude: normalizedLongitude,
          forceCategories: forcedSourceCategories,
        })
      : providerServiceabilityGatedMeta(filtered);

    // resolveProviderMatchLevelFromDb walks every coverage row, and both the
    // sort comparator and the response map need it — so compute match level +
    // confidence once per provider instead of O(n log n) times inside sort.
    const matchOptions = { state, zip, latitude: normalizedLatitude, longitude: normalizedLongitude };
    const coverageByProvider = new Map(
      filtered.map((p) => [
        p,
        {
          matchLevel: applyProviderServiceabilityMatchLevel(
            p,
            getProviderPresentationMatchLevelFromDb(p, matchOptions),
          ),
          confidence: applyProviderServiceabilityConfidence(
            p,
            getProviderCoverageConfidenceFromDb(p, matchOptions),
          ),
        },
      ] as const),
    );

    filtered.sort((a, b) => {
      const confidenceRank = compareCoverageConfidence(
        coverageByProvider.get(a)!.confidence,
        coverageByProvider.get(b)!.confidence,
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
      const coverageModel =
        p.coverageModel || inferProviderCoverageModel({ category: p.category, scope: p.scope, zipCodes });
      const coverageMatchLevel = coverageByProvider.get(p)!.matchLevel;
      const serviceabilityFlags = p as typeof p & { fccServiceable?: boolean; utilityServiceable?: boolean };
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

      // Brand identity for clustering sibling services of the same company (e.g.
      // "Chase" + "Chase Credit Cards") so search doesn't read them as dupes.
      const brand = getProviderBrand({ website: p.website, name: p.name });

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        subCategory: p.subCategory,
        description: p.description,
        website: p.website,
        brandKey: brand.brandKey,
        brandLabel: brand.brandLabel,
        phone: p.phone,
        logoUrl: p.logoUrl,
        scope: p.scope,
        states,
        zipCodes,
        tags,
        popularityScore: p.popularityScore,
        displayOrder: p.displayOrder,
        affiliateActive: Boolean((p as { affiliateActive?: boolean }).affiliateActive),
        fccServiceable: serviceabilityFlags.fccServiceable === true,
        utilityServiceable: serviceabilityFlags.utilityServiceable === true,
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
        fcc: serviceability.fcc,
        electric: serviceability.electric,
        sourceGaps: serviceability.sourceGaps,
      },
    });
  } catch (error) {
    console.error("Failed to fetch providers:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}

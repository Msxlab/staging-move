import { NextRequest, NextResponse } from "next/server";
import { getProviderCoverageMetadata, zipCentroid, type ProviderCoverageModel } from "@locateflow/db";
import { CANCELED_MOVING_PLAN_STATUSES, getCurrentRelocationPhase, inferProviderCoverageModel } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import {
  scoreProviders,
  buildRecommendationClusters,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryOrder,
  type UserProfile,
  type Provider,
  type UrgencyTier,
} from "@/lib/recommendation-engine";
import { getProviderMatchLevelFromDb, resolveEffectiveState, safeJsonArray, tierProvidersFromDb } from "@/lib/provider-matching";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { recordIntegrationOutcomes } from "@/lib/integration-telemetry";
import { getScoringWeightOverrides } from "@/lib/recommendation-weights";
import { getCommunityPopularity } from "@/lib/community-popularity";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";
import { enrichProviderServiceability, providerServiceabilityGatedMeta } from "@/lib/provider-serviceability";
import { requestHasPlanFeature } from "@/lib/request-entitlements";
import type { ProviderCoverageMetadata } from "@locateflow/db";

// Representative geo coordinate for a GEO-BEARING provider: the centroid of its
// mapped service-area polygon(s). Returned only when the provider has polygon
// metadata with points; otherwise null. This single point lets the shared
// recommendation engine rank a nearer local provider above a farther one when
// the user also has coordinates — without storing per-provider lat/lng in the
// catalog (the ServiceProvider model has none). The fold is deterministic, so
// it never affects the engine's provably-transitive comparator.
function providerGeoCentroid(
  metadata: ProviderCoverageMetadata | null | undefined,
): { latitude: number; longitude: number } | null {
  const polygons = metadata?.polygons;
  if (!polygons || polygons.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;
  for (const poly of polygons) {
    for (const point of poly.points) {
      if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
        sumLat += point.latitude;
        sumLng += point.longitude;
        count += 1;
      }
    }
  }
  if (count === 0) return null;
  return { latitude: sumLat / count, longitude: sumLng / count };
}

// GET /api/providers/recommendations — personalized, completion-aware recommendations
// Returns tiered clusters with "next critical actions" based on what user already has
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const scope = await resolveWorkspaceDataScope(request, userId);

    const rl = await enforceRateLimitPolicy(request, "provider_recommendations", {
      userId,
      routeId: "providers_recommendations",
    });
    if (!rl.success) {
      return NextResponse.json(
        { code: rl.policy.userFacingErrorCode, error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedAddressId = searchParams.get("addressId");
    const requestedState = searchParams.get("state")?.trim().toUpperCase();
    const requestedZip = searchParams.get("zip")?.trim();
    const requestedLatitudeParam = searchParams.get("lat");
    const requestedLongitudeParam = searchParams.get("lng");
    const requestedLatitude = requestedLatitudeParam !== null ? Number(requestedLatitudeParam) : null;
    const requestedLongitude = requestedLongitudeParam !== null ? Number(requestedLongitudeParam) : null;
    const queryLatitude = Number.isFinite(requestedLatitude) ? requestedLatitude : null;
    const queryLongitude = Number.isFinite(requestedLongitude) ? requestedLongitude : null;

    const [profile, addresses, services, movingPlan, recFeedback] = await Promise.all([
      prisma.profile.findUnique({ where: { userId } }).catch(() => null),
      prisma.address.findMany({
        where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
      }),
      prisma.service.findMany({
        where: activeTrackedServiceWhereForScope(
          { userId, workspaceId: scope.workspaceId },
          scope.memberRole === "CHILD" ? { userId } : {},
        ),
        select: { providerName: true, category: true, providerId: true },
      }),
      prisma.movingPlan.findFirst({
        where: scopedRecordWhere(
          scope,
          { deletedAt: null, status: { notIn: [...CANCELED_MOVING_PLAN_STATUSES] } },
          { childSelfOnly: true },
        ),
        orderBy: { moveDate: "asc" },
      }),
      // Active dismiss/snooze feedback — excluded from the recommendation clusters
      // so the engine stops re-surfacing what the user rejected. (Snoozes whose
      // `until` has passed are not loaded, so they auto-resurface.)
      prisma.recommendationFeedback
        .findMany({
          where: { userId, OR: [{ until: null }, { until: { gt: new Date() } }] },
          select: { providerId: true },
        })
        .catch(() => [] as Array<{ providerId: string }>),
    ]);

    const dismissedProviderIds = new Set(recFeedback.map((f) => f.providerId));

    const selectedAddress = addresses.find((a) => a.id === requestedAddressId);
    const primaryAddr = selectedAddress || addresses.find((a) => a.isPrimary) || addresses[0];
    const fallbackState = requestedState || primaryAddr?.state || "";
    const fallbackZip = requestedZip || primaryAddr?.zip || "";

    const effectiveState = resolveEffectiveState(fallbackState, fallbackZip);
    let fallbackLatitude = queryLatitude ?? primaryAddr?.latitude ?? null;
    let fallbackLongitude = queryLongitude ?? primaryAddr?.longitude ?? null;
    // No stored/queried coordinates but we have a ZIP → resolve its ZCTA centroid
    // (Census gazetteer) so distance-based provider ranking still works for ANY
    // address with a ZIP, instead of only those with geocoded lat/lng. This is the
    // finer alternative to the coarse 3-digit-prefix heuristic.
    if ((fallbackLatitude === null || fallbackLongitude === null) && fallbackZip) {
      const centroid = zipCentroid(fallbackZip);
      if (centroid) {
        fallbackLatitude = fallbackLatitude ?? centroid.latitude;
        fallbackLongitude = fallbackLongitude ?? centroid.longitude;
      }
    }

    const providers = await prisma.serviceProvider.findMany({
      where: {
        isActive: true,
        ...(effectiveState
          ? { OR: [{ scope: "FEDERAL" }, { coverages: { some: { state: effectiveState } } }] }
          : { scope: "FEDERAL" }),
        category: { not: "TRANSPORTATION_TRANSIT" },
      },
      include: {
        coverages: effectiveState ? { where: { state: effectiveState } } : false,
      },
    });

    const withCoverages = providers.map((p) => {
      const metadata = getProviderCoverageMetadata(p.slug);
      const zipCodes = safeJsonArray(p.zipCodes);
      // Resolution order: per-provider DB override (set by the admin coverage
      // editor) → curated seed metadata → zip-vs-state heuristic. The override
      // is what lets an admin change a provider's model without editing seed
      // code; it's null for every provider that has never been edited, so this
      // is a no-op for them.
      const overrideModel = (p as { coverageModel?: string | null }).coverageModel;
      const coverageModel: ProviderCoverageModel =
        (overrideModel as ProviderCoverageModel | undefined) ||
        metadata?.coverageModel ||
        inferProviderCoverageModel({ category: p.category, scope: p.scope, zipCodes });

      const geoCentroid = providerGeoCentroid(metadata);

      return {
        ...p,
        zipCodes,
        coverageModel,
        coverageNote: metadata?.note || null,
        coverageSourceUrl: metadata?.officialUrl || null,
        geoLatitude: geoCentroid?.latitude ?? null,
        geoLongitude: geoCentroid?.longitude ?? null,
        coverages: "coverages" in p && Array.isArray((p as { coverages?: unknown }).coverages)
          ? (p as unknown as { coverages: { state: string | null; zipPrefix: string | null; zipExact: string | null }[] }).coverages
          : [],
      };
    });

    const tiered = tierProvidersFromDb(withCoverages, {
      state: fallbackState,
      zip: fallbackZip,
      latitude: fallbackLatitude,
      longitude: fallbackLongitude,
    });

    const currentPhase = movingPlan?.moveDate
      ? getCurrentRelocationPhase(
          Math.floor((Date.now() - new Date(movingPlan.moveDate).getTime()) / (24 * 60 * 60 * 1000)),
        )
      : 0;

    // Days until the move (positive = upcoming, negative = past). Drives the
    // proximity scoring signal so time-sensitive setups rank higher as the move
    // nears. Undefined when there's no active move date.
    const daysUntilMove = movingPlan?.moveDate
      ? Math.ceil((new Date(movingPlan.moveDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : undefined;

    // A MILITARY/PCS move implies military affiliation even if the explicit
    // isMilitary flag wasn't toggled — fold both onboarding signals together so
    // VA / military benefits surface for either.
    const isMilitary = Boolean(profile?.isMilitary) || profile?.moveType === "MILITARY";

    // Addresses persist ownership as OWNER/RENTER/FAMILY/OTHER, but the scoring
    // engine's ownership gates compare against OWN/RENT. Normalize here so the
    // renters-vs-homeowners steering actually fires (it was previously a no-op
    // because "RENTER" never matched "RENT").
    const normalizeOwnership = (value?: string | null): string | undefined => {
      if (!value) return undefined;
      const upper = value.toUpperCase();
      if (upper === "OWNER" || upper === "OWN") return "OWN";
      if (upper === "RENTER" || upper === "RENT") return "RENT";
      return "OTHER";
    };

    const userProfile: UserProfile = {
      hasChildren: profile?.hasChildren || false,
      childrenCount: profile?.childrenCount || 0,
      hasPets: profile?.hasPets || false,
      hasSenior: profile?.hasSenior || false,
      carCount: profile?.carCount || 0,
      hasDisability: profile?.hasDisability || false,
      needsStorage: profile?.needsStorage || false,
      hasMotorcycle: profile?.hasMotorcycle || false,
      hasBoatRV: profile?.hasBoatRV || false,
      isMilitary,
      isImmigrant: profile?.isImmigrant || false,
      isBusinessOwner: profile?.isBusinessOwner || false,
      // Extended onboarding signals (audit: collected but previously ignored by
      // scoring — engine block 4d). petTypes persists as a JSON string ("[]"
      // default), so parse defensively with safeJsonArray; the rest pass
      // through as-is and the engine treats blank/absent values as no-signal.
      familyStatus: profile?.familyStatus || undefined,
      ageRange: profile?.ageRange || undefined,
      petTypes: safeJsonArray(profile?.petTypes),
      businessType: profile?.businessType || undefined,
      immigrationStatus: profile?.immigrationStatus || undefined,
      moveType: profile?.moveType || undefined,
      currentPhase,
      daysUntilMove,
      ownership: normalizeOwnership(primaryAddr?.ownership),
      // Destination coordinates drive true geo-local provider ranking in the
      // shared engine (nearer geo-bearing providers rank higher). Undefined
      // coordinates simply skip the geo component, so this is safe when the
      // address has no lat/lng.
      latitude: fallbackLatitude,
      longitude: fallbackLongitude,
    };

    const parsedProviders: Provider[] = tiered.providers.map((p) => {
      const zipCodes = Array.isArray((p as { zipCodes?: unknown }).zipCodes)
        ? (p as { zipCodes: string[] }).zipCodes
        : safeJsonArray(p.zipCodes);
      const coverageModel =
        p.coverageModel || inferProviderCoverageModel({ category: p.category, scope: p.scope, zipCodes });

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
        states: safeJsonArray(p.states),
        zipCodes,
        tags: safeJsonArray(p.tags),
        popularityScore: p.popularityScore || 0,
        displayOrder: p.displayOrder || 0,
        userCount: p.userCount || 0,
        affiliateActive: Boolean((p as { affiliateActive?: boolean }).affiliateActive),
        coverageModel,
        coverageMatchLevel: getProviderMatchLevelFromDb(p, {
          state: fallbackState,
          zip: fallbackZip,
          latitude: fallbackLatitude,
          longitude: fallbackLongitude,
        }),
        coverageNote: ("coverageNote" in p ? (p as { coverageNote?: string | null }).coverageNote : null) || null,
        coverageSourceUrl: ("coverageSourceUrl" in p ? (p as { coverageSourceUrl?: string | null }).coverageSourceUrl : null) || null,
        // Representative geo coordinates (service-area polygon centroid) for
        // geo-bearing local providers. Null for federal/national/zip-only catalog
        // providers — the engine then skips the geo component for them.
        latitude: ("geoLatitude" in p ? (p as { geoLatitude?: number | null }).geoLatitude : null) ?? null,
        longitude: ("geoLongitude" in p ? (p as { geoLongitude?: number | null }).geoLongitude : null) ?? null,
        requiresAddressCheck: coverageModel === "live_address",
        requiresPolygonCheck: coverageModel === "polygon",
      };
    });

    const canUseDataChecked = await requestHasPlanFeature(request, userId, "addressValidation");
    const serviceability = canUseDataChecked
      ? await enrichProviderServiceability(parsedProviders, {
          latitude: fallbackLatitude,
          longitude: fallbackLongitude,
        })
      : providerServiceabilityGatedMeta(parsedProviders);

    const existingNames = new Set(services.map((s) => (s.providerName || "").toLowerCase()));
    const completedCategories = [...new Set(services.map((s) => s.category).filter(Boolean))];

    const stateRule = effectiveState
      ? await prisma.stateRule.findUnique({ where: { stateCode: effectiveState } }).catch(() => null)
      : null;

    const scoringWeights = await getScoringWeightOverrides();

    const communityPopular = await getCommunityPopularity(effectiveState);

    const scored = scoreProviders(
      parsedProviders,
      userProfile,
      effectiveState || "",
      communityPopular,
      existingNames,
      {
        stateRule: stateRule ? {
          dmvRules: stateRule.dmvRules,
          voterRegistration: stateRule.voterRegistration,
          taxInfo: stateRule.taxInfo,
        } : null,
        weights: scoringWeights,
      }
    );
    const result = buildRecommendationClusters(scored, completedCategories, dismissedProviderIds);

    // ── #3a: region-grouped top picks ────────────────────────────
    // The user's own city is on their address, so we can head the recommendations
    // with their region and show the top FEW region-relevant providers PER category
    // (the scored list is coverage-ranked, so local providers float up) instead of
    // a single best-per-category or an undifferentiated dump. Focus on pending
    // CRITICAL + IMPORTANT categories — "present region-based, don't recommend
    // everything." Lower tiers stay in the normal clusters/full directory below.
    const REGION_GROUP_PER_CATEGORY = 3;
    const REGION_GROUP_TIERS = new Set<UrgencyTier>(["CRITICAL", "IMPORTANT"]);
    const TIER_RANK: Record<string, number> = { CRITICAL: 0, IMPORTANT: 1 };
    const regionCompletedSet = new Set(completedCategories.map((c) => (c || "").toUpperCase()));
    const regionByCategory = new Map<string, typeof scored>();
    for (const p of scored) {
      if (dismissedProviderIds.has(p.id)) continue;
      const cat = (p.category || "").toUpperCase();
      if (!cat || regionCompletedSet.has(cat) || !REGION_GROUP_TIERS.has(p.urgencyTier)) continue;
      const arr = regionByCategory.get(cat) ?? [];
      arr.push(p);
      regionByCategory.set(cat, arr);
    }
    const regionGroups = [...regionByCategory.entries()]
      .map(([category, providers]) => {
        const top = [...providers]
          .sort((a, b) => b.recommendationScore - a.recommendationScore)
          .slice(0, REGION_GROUP_PER_CATEGORY);
        return {
          category,
          label: getMergedDisplayCategoryLabel(category),
          tier: top[0]?.urgencyTier ?? ("IMPORTANT" as UrgencyTier),
          providers: top,
        };
      })
      .sort((a, b) => {
        const t = (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9);
        return t !== 0 ? t : getMergedDisplayCategoryOrder(a.category) - getMergedDisplayCategoryOrder(b.category);
      });

    const regionCity = primaryAddr?.city?.trim() || null;
    const regionState = (primaryAddr?.state?.trim().toUpperCase() || effectiveState) || null;
    const region = {
      city: regionCity,
      state: regionState,
      label: regionCity && regionState ? `${regionCity}, ${regionState}` : regionState || null,
    };

    // Fire-and-forget integration telemetry (synchronous in-process buffer —
    // never throws, never adds latency). Mirrors the fcc/electric statuses
    // reported in `meta` below so per-day IntegrationDailyStat counters track
    // how often each lookup is ok / not_configured / skipped / erroring.
    recordIntegrationOutcomes({
      fcc: serviceability.fcc.status,
      electric: serviceability.electric.status,
    });

    return NextResponse.json({
      ...result,
      region,
      regionGroups,
      meta: {
        state: effectiveState,
        requestedState: requestedState || null,
        requestedZip: requestedZip || null,
        zipMatchLevel: tiered.zipMatchLevel,
        addressCoordinatesUsed: fallbackLatitude !== null && fallbackLongitude !== null,
        coverageModels: {
          polygon: parsedProviders.filter((provider) => provider.coverageModel === "polygon").length,
          liveAddress: parsedProviders.filter((provider) => provider.coverageModel === "live_address").length,
          zipPrefix: parsedProviders.filter((provider) => provider.coverageModel === "zip_prefix").length,
        },
        // FCC ISP serviceability telemetry. `status` is one of the
        // FccLookupStatus values; "not_configured" is the default until the
        // owner sets FCC_BDC_ENABLED + FCC_BDC_API_KEY (see lib/fcc-isp.ts).
        // `confirmedCount` is how many internet providers FCC confirmed at the
        // address. Never user-facing copy — for dashboards / debugging only.
        fcc: serviceability.fcc,
        // Electric-utility serviceability telemetry, mirroring `fcc` above.
        // `status` is one of the ElectricLookupStatus values; "not_configured"
        // is the default until the owner sets ELECTRIC_LOOKUP_ENABLED +
        // OPENEI_API_KEY (see lib/electric-utility.ts). `confirmedCount` is how
        // many electric providers were confirmed at the address. Never
        // user-facing copy — for dashboards / debugging only.
        electric: serviceability.electric,
        addressId: primaryAddr?.id || null,
        currentPhase,
        totalServices: services.length,
        completedCategories,
        moveDate: movingPlan?.moveDate || null,
        stateRule: stateRule ? {
          stateCode: stateRule.stateCode,
          stateName: stateRule.stateName,
          dmvRules: stateRule.dmvRules,
          voterRegistration: stateRule.voterRegistration,
          taxInfo: stateRule.taxInfo,
        } : null,
      },
    });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to generate recommendations:", error);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}

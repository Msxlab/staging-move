import { NextRequest, NextResponse } from "next/server";
import { getProviderCoverageMetadata, type ProviderCoverageModel } from "@locateflow/db";
import { CANCELED_MOVING_PLAN_STATUSES, getCurrentRelocationPhase } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import {
  scoreProviders,
  buildRecommendationClusters,
  type UserProfile,
  type Provider,
} from "@/lib/recommendation-engine";
import { getProviderMatchLevelFromDb, resolveEffectiveState, safeJsonArray, tierProvidersFromDb } from "@/lib/provider-matching";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { getScoringWeightOverrides } from "@/lib/recommendation-weights";
import { getCommunityPopularity } from "@/lib/community-popularity";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";
import { lookupFccIsps, isIspServiceable, type FccLookupResult } from "@/lib/fcc-isp";

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

    const [profile, addresses, services, movingPlan] = await Promise.all([
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
    ]);

    const selectedAddress = addresses.find((a) => a.id === requestedAddressId);
    const primaryAddr = selectedAddress || addresses.find((a) => a.isPrimary) || addresses[0];
    const fallbackState = requestedState || primaryAddr?.state || "";
    const fallbackZip = requestedZip || primaryAddr?.zip || "";

    const effectiveState = resolveEffectiveState(fallbackState, fallbackZip);
    const fallbackLatitude = queryLatitude ?? primaryAddr?.latitude ?? null;
    const fallbackLongitude = queryLongitude ?? primaryAddr?.longitude ?? null;

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
      moveType: profile?.moveType || undefined,
      currentPhase,
      ownership: normalizeOwnership(primaryAddr?.ownership),
    };

    const parsedProviders: Provider[] = tiered.providers.map((p) => ({
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
      zipCodes: Array.isArray((p as { zipCodes?: unknown }).zipCodes) ? ((p as { zipCodes: string[] }).zipCodes) : safeJsonArray(p.zipCodes),
      tags: safeJsonArray(p.tags),
      popularityScore: p.popularityScore || 0,
      displayOrder: p.displayOrder || 0,
      userCount: p.userCount || 0,
      affiliateActive: Boolean((p as { affiliateActive?: boolean }).affiliateActive),
      coverageModel: p.coverageModel || "state",
      coverageMatchLevel: getProviderMatchLevelFromDb(p, {
        state: fallbackState,
        zip: fallbackZip,
        latitude: fallbackLatitude,
        longitude: fallbackLongitude,
      }),
      coverageNote: ("coverageNote" in p ? (p as { coverageNote?: string | null }).coverageNote : null) || null,
      coverageSourceUrl: ("coverageSourceUrl" in p ? (p as { coverageSourceUrl?: string | null }).coverageSourceUrl : null) || null,
      requiresAddressCheck: p.coverageModel === "live_address",
      requiresPolygonCheck: p.coverageModel === "polygon",
    }));

    // ── FCC ISP serviceability enrichment (internet providers) ───────────────
    // Internet providers are `live_address` coverage, so the catalog can only
    // ever say "check availability". When the FCC National Broadband Map is
    // configured (see apps/web/src/lib/fcc-isp.ts) and we have address
    // coordinates, confirm which ISPs actually serve this address and flag them
    // `fccServiceable` so the recommendation engine surfaces them with an
    // "available at your address" confidence instead of "check availability".
    //
    // GRACEFUL DEGRADATION: a single lookup is attempted only if there is at
    // least one internet provider in the candidate set. Any non-"ok" status
    // (FCC unconfigured / no coordinates / network error) leaves every provider
    // untouched, so recommendations behave exactly as before — no crash.
    let fccLookup: FccLookupResult | null = null;
    const hasInternetCandidates = parsedProviders.some((p) => p.category === "UTILITY_INTERNET");
    if (hasInternetCandidates) {
      try {
        fccLookup = await lookupFccIsps({
          latitude: fallbackLatitude,
          longitude: fallbackLongitude,
        });
        if (fccLookup.status === "ok") {
          for (const provider of parsedProviders) {
            if (provider.category !== "UTILITY_INTERNET") continue;
            if (isIspServiceable(fccLookup, provider.name)) {
              provider.fccServiceable = true;
            }
          }
        }
      } catch {
        // Defensive: lookupFccIsps already swallows FCC/network errors, but make
        // the route bullet-proof so a malformed response can never break recs.
        fccLookup = null;
      }
    }

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
    const result = buildRecommendationClusters(scored, completedCategories);

    return NextResponse.json({
      ...result,
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
        fcc: {
          status: fccLookup?.status || (hasInternetCandidates ? "not_configured" : "skipped"),
          confirmedCount: parsedProviders.filter((p) => p.fccServiceable === true).length,
          blockGeoid: fccLookup?.blockGeoid || null,
        },
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

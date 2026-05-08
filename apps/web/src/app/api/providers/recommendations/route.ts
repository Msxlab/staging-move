import { NextRequest, NextResponse } from "next/server";
import { getProviderCoverageMetadata, type ProviderCoverageModel } from "@locateflow/db";
import { CANCELED_MOVING_PLAN_STATUSES } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import {
  scoreProviders,
  buildRecommendationClusters,
  type UserProfile,
  type Provider,
} from "@/lib/recommendation-engine";
import { getProviderMatchLevelFromDb, resolveEffectiveState, safeJsonArray, tierProvidersFromDb } from "@/lib/provider-matching";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";

// GET /api/providers/recommendations — personalized, completion-aware recommendations
// Returns tiered clusters with "next critical actions" based on what user already has
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

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

    const [profile, addresses, services, movingPlan] = await Promise.all([
      prisma.profile.findUnique({ where: { userId } }).catch(() => null),
      prisma.address.findMany({ where: { userId } }),
      prisma.service.findMany({ where: { userId, isActive: true }, select: { providerName: true, category: true, providerId: true } }),
      prisma.movingPlan.findFirst({
        where: { userId, status: { notIn: [...CANCELED_MOVING_PLAN_STATUSES] } },
        orderBy: { moveDate: "asc" },
      }),
    ]);

    const selectedAddress = addresses.find((a) => a.id === requestedAddressId);
    const primaryAddr = selectedAddress || addresses.find((a) => a.isPrimary) || addresses[0];
    const fallbackState = requestedState || primaryAddr?.state || "";
    const fallbackZip = requestedZip || primaryAddr?.zip || "";

    const effectiveState = resolveEffectiveState(fallbackState, fallbackZip);
    const fallbackLatitude = primaryAddr?.latitude ?? null;
    const fallbackLongitude = primaryAddr?.longitude ?? null;

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

    let currentPhase = 0;
    if (movingPlan?.moveDate) {
      const daysFromMove = Math.floor((Date.now() - new Date(movingPlan.moveDate).getTime()) / (24 * 60 * 60 * 1000));
      if (daysFromMove < -7) currentPhase = 0;
      else if (daysFromMove <= 3) currentPhase = 1;
      else if (daysFromMove <= 10) currentPhase = 2;
      else if (daysFromMove <= 30) currentPhase = 3;
      else if (daysFromMove <= 60) currentPhase = 4;
      else currentPhase = 5;
    }

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
      currentPhase,
      ownership: primaryAddr?.ownership || undefined,
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

    const existingNames = new Set(services.map((s) => (s.providerName || "").toLowerCase()));
    const completedCategories = [...new Set(services.map((s) => s.category).filter(Boolean))];

    const stateRule = effectiveState
      ? await prisma.stateRule.findUnique({ where: { stateCode: effectiveState } }).catch(() => null)
      : null;

    let communityPopular: Record<string, number> | undefined;
    if (effectiveState) {
      try {
        const stateAddresses = await prisma.address.findMany({
          where: { state: effectiveState },
          select: { userId: true },
        });
        const stateUserIds = [...new Set(stateAddresses.map((a) => a.userId))];
        if (stateUserIds.length > 5) {
          const stateServices = await prisma.service.findMany({
            where: { userId: { in: stateUserIds }, isActive: true, providerId: { not: null } },
            select: { providerId: true },
          });
          const counts: Record<string, number> = {};
          for (const s of stateServices) {
            if (s.providerId) counts[s.providerId] = (counts[s.providerId] || 0) + 1;
          }
          const maxCount = Math.max(1, ...Object.values(counts));
          communityPopular = {};
          for (const [id, count] of Object.entries(counts)) {
            communityPopular[id] = Math.round((count / maxCount) * 20);
          }
        }
      } catch {
        // Non-blocking
      }
    }

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
    console.error("Failed to generate recommendations:", error);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}

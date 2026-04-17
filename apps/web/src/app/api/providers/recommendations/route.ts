import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import {
  scoreProviders,
  buildRecommendationClusters,
  type UserProfile,
  type Provider,
} from "@/lib/recommendation-engine";
import { resolveEffectiveState, safeJsonArray, tierProvidersFromDb } from "@/lib/provider-matching";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

// GET /api/providers/recommendations — personalized, completion-aware recommendations
// Returns tiered clusters with "next critical actions" based on what user already has
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    const rl = await rateLimit(getRateLimitKey(request, `recommendations:${userId}`), { limit: 30, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } }
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
      prisma.movingPlan.findFirst({ where: { userId, status: { not: "CANCELLED" } }, orderBy: { moveDate: "asc" } }),
    ]);

    const selectedAddress = addresses.find((a) => a.id === requestedAddressId);
    const primaryAddr = selectedAddress || addresses.find((a) => a.isPrimary) || addresses[0];
    const fallbackState = requestedState || primaryAddr?.state || "";
    const fallbackZip = requestedZip || primaryAddr?.zip || "";

    const effectiveState = resolveEffectiveState(fallbackState, fallbackZip);

    const providers = await prisma.serviceProvider.findMany({
      where: {
        isActive: true,
        ...(effectiveState
          ? { OR: [{ scope: "FEDERAL" }, { coverages: { some: { state: effectiveState } } }] }
          : {}),
      },
      include: {
        coverages: effectiveState ? { where: { state: effectiveState } } : false,
      },
    });

    const withCoverages = providers.map((p) => ({
      ...p,
      coverages: "coverages" in p && Array.isArray((p as { coverages?: unknown }).coverages)
        ? (p as unknown as { coverages: { state: string | null; zipPrefix: string | null; zipExact: string | null }[] }).coverages
        : [],
    }));

    const tiered = tierProvidersFromDb(withCoverages, { state: fallbackState, zip: fallbackZip });

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
      scope: p.scope,
      states: safeJsonArray(p.states),
      zipCodes: safeJsonArray(p.zipCodes),
      tags: safeJsonArray(p.tags),
      popularityScore: p.popularityScore || 0,
      displayOrder: p.displayOrder || 0,
      avgRating: p.avgRating,
      reviewCount: p.reviewCount || 0,
      userCount: p.userCount || 0,
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

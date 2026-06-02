import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { getProviderCoverageMetadata, type ProviderCoverageModel } from "@locateflow/db";
import {
  classifyMoveServiceTransition,
  providerNameMentionsOtherState,
  safeJsonArray,
  type MoveTransitionProviderInput,
} from "@locateflow/shared";
import {
  getProviderCoverageConfidenceFromDb,
  resolveEffectiveState,
} from "@/lib/provider-matching";
import {
  analyzeMigration,
  type ServiceWithProvider,
  type ProviderForMigration,
  type UserChecklistProfile,
} from "@/lib/shared-relocation";

// GET /api/moving/migration?planId={id}
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const rl = await rateLimit(getRateLimitKey(request, "moving:migration"), {
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    // Fetch moving plan with addresses
    const plan = await prisma.movingPlan.findFirst({
      where: { id: planId, deletedAt: null },
      include: {
        fromAddress: true,
        toAddress: true,
      },
    });

    if (!plan || plan.userId !== userId) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }

    const fromState = (plan as any).fromAddress?.state || "";
    const toState = (plan as any).toAddress?.state || "";
    const fromZip = (plan as any).fromAddress?.zip || "";
    const toZip = (plan as any).toAddress?.zip || "";
    const effectiveToState = resolveEffectiveState(toState, toZip);

    if (!fromState || !effectiveToState) {
      return NextResponse.json({ error: "Plan addresses must have state info" }, { status: 400 });
    }

    // Fetch user's existing services at fromAddress with provider info
    const existingServices = await prisma.service.findMany({
      where: {
        userId,
        addressId: plan.fromAddressId,
        isActive: true,
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            slug: true,
            scope: true,
            states: true,
            category: true,
          },
        },
      },
    });

    // Parse provider states from JSON string
    const servicesWithParsedStates: ServiceWithProvider[] = existingServices.map((s: any) => ({
      id: s.id,
      category: s.category,
      providerName: s.providerName,
      providerId: s.providerId,
      isActive: s.isActive,
      monthlyCost: s.monthlyCost,
      migrationAction: s.migrationAction ?? null,
      provider: s.provider
        ? {
            id: s.provider.id,
            name: s.provider.name,
            slug: s.provider.slug,
            scope: s.provider.scope,
            states: safeParseJSON(s.provider.states, []),
            category: s.provider.category,
          }
        : null,
    }));

    // Fetch providers available in the destination state through the indexed
    // coverage table. Federal providers remain broad candidates, but the
    // classifier treats them as weaker confidence for address-sensitive work.
    const destinationProviders = await prisma.serviceProvider.findMany({
      where: {
        isActive: true,
        OR: [
          { scope: "FEDERAL" },
          { coverages: { some: { state: effectiveToState } } },
        ],
      },
      include: {
        coverages: { where: { state: effectiveToState } },
      },
      // Safety bound: a single destination state should never legitimately
      // exceed this many active providers, so ordering by popularity first
      // keeps the most relevant candidates if the catalog ever balloons,
      // while capping the per-request memory and O(services × providers)
      // classification cost. Not a functional limit on normal data.
      orderBy: { popularityScore: "desc" },
      take: 1000,
    });

    // Drop catalog rows whose display name embeds a US state token that
    // does not match the destination. These almost always indicate dirty
    // coverage data (e.g. "Spectrum Maine" tagged with CA) and would be
    // misleading if surfaced as a recommendation. We do this once at the
    // route boundary so both the per-service classifier and the broader
    // `analyzeMigration` flow see a clean candidate set.
    const cleanedDestinationProviders = destinationProviders.filter((p: any) => {
      if (p.scope === "FEDERAL") return true;
      return !providerNameMentionsOtherState(String(p.name || ""), effectiveToState);
    });

    const destinationProviderInputs: MoveTransitionProviderInput[] = cleanedDestinationProviders.map((p: any) => {
      const metadata = getProviderCoverageMetadata(p.slug);
      const zipCodes = safeJsonArray(p.zipCodes);
      const coverageModel: ProviderCoverageModel =
        metadata?.coverageModel || (zipCodes.length > 0 ? "zip_prefix" : "state");
      const coverageConfidence = getProviderCoverageConfidenceFromDb(
        {
          id: p.id,
          slug: p.slug,
          scope: p.scope,
          coverageModel,
          coverages: p.coverages || [],
        },
        {
          state: effectiveToState,
          zip: toZip,
          latitude: (plan as any).toAddress?.latitude ?? null,
          longitude: (plan as any).toAddress?.longitude ?? null,
        },
      );

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        scope: p.scope,
        states: safeJsonArray(p.states),
        coverageConfidence,
        coverageModel,
        coverageMatchLevel: null,
        requiresAddressCheck: coverageModel === "live_address",
        requiresPolygonCheck: coverageModel === "polygon",
        popularityScore: p.popularityScore || 0,
      };
    });

    const providersForMigration: ProviderForMigration[] = cleanedDestinationProviders
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        scope: p.scope,
        states: safeParseJSON(p.states, []),
        popularityScore: p.popularityScore || 0,
      }))
      .filter((p: ProviderForMigration) => {
        if (p.scope === "FEDERAL") return true;
        return p.states.includes(effectiveToState);
      });

    // Build user profile for condition checking
    const profile = await prisma.profile.findUnique({ where: { userId } });
    const checklistProfile: UserChecklistProfile = {
      hasChildren: (profile as any)?.hasChildren ?? false,
      childrenCount: (profile as any)?.childrenCount ?? 0,
      hasPets: (profile as any)?.hasPets ?? false,
      hasSenior: (profile as any)?.hasSenior ?? false,
      carCount: (profile as any)?.carCount ?? 0,
      hasDisability: (profile as any)?.hasDisability ?? false,
      needsStorage: (profile as any)?.needsStorage ?? false,
      hasMotorcycle: (profile as any)?.hasMotorcycle ?? false,
      hasBoatRV: (profile as any)?.hasBoatRV ?? false,
      isImmigrant: (profile as any)?.isImmigrant ?? false,
      isBusinessOwner: (profile as any)?.isBusinessOwner ?? false,
      moveType: ((profile as any)?.moveType as "PERSONAL" | "BUSINESS" | "VACATION" | "MILITARY") || "PERSONAL",
    };

    const analysis = analyzeMigration(
      servicesWithParsedStates,
      fromState,
      effectiveToState,
      providersForMigration,
      checklistProfile,
    );

    // The classifier returns generic guidance per service. The UI needs to
    // tell two same-category items apart (e.g. "Forward mail for IRS" vs
    // "Forward mail for USPS account"), so we attach service identity to
    // each plan here. Adding it server-side keeps the contract stable for
    // older mobile builds that just ignore the new fields.
    const transitionPlans = servicesWithParsedStates.map((service) => {
      const plan = classifyMoveServiceTransition({
        service,
        currentProvider: service.provider
          ? {
              id: service.provider.id,
              name: service.provider.name,
              category: service.provider.category,
              scope: service.provider.scope,
              states: service.provider.states,
            }
          : null,
        originAddress: { state: fromState, zip: fromZip },
        destinationAddress: { state: effectiveToState, zip: toZip },
        destinationProviderCandidates: destinationProviderInputs,
      });
      return {
        ...plan,
        serviceProviderName: service.providerName,
        serviceCategoryLabel:
          (service.provider?.category as string | undefined) || service.category,
      };
    });

    const transitionSummary = transitionPlans.reduce<Record<string, number>>((acc, plan) => {
      acc[plan.actionType] = (acc[plan.actionType] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      analysis: {
        ...analysis,
        transitionPlans,
        transitionSummary,
      },
      transitionPlans,
      transitionSummary,
      meta: {
        fromState,
        toState: effectiveToState,
        toZip,
        guidanceOnly: true,
        manualTrackingOnly: true,
      },
    });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to analyze migration:", error);
    return NextResponse.json({ error: "Failed to analyze migration" }, { status: 500 });
  }
}

function safeParseJSON(value: any, fallback: any): any {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return fallback;
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
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
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    // Fetch moving plan with addresses
    const plan = await prisma.movingPlan.findUnique({
      where: { id: planId },
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

    if (!fromState || !toState) {
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
            scope: s.provider.scope,
            states: safeParseJSON(s.provider.states, []),
            category: s.provider.category,
          }
        : null,
    }));

    // Fetch all providers available in destination state
    const allProviders = await prisma.serviceProvider.findMany({
      where: { isActive: true },
    });

    const providersForMigration: ProviderForMigration[] = allProviders
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        scope: p.scope,
        states: safeParseJSON(p.states, []),
        popularityScore: p.popularityScore || 0,
        avgRating: p.avgRating,
        reviewCount: p.reviewCount || 0,
      }))
      .filter((p: ProviderForMigration) => {
        if (p.scope === "FEDERAL") return true;
        return p.states.includes(toState);
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
      moveType: ((profile as any)?.moveType as "PERSONAL" | "BUSINESS" | "VACATION") || "PERSONAL",
    };

    const analysis = analyzeMigration(
      servicesWithParsedStates,
      fromState,
      toState,
      providersForMigration,
      checklistProfile,
    );

    return NextResponse.json({ analysis });
  } catch (error) {
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

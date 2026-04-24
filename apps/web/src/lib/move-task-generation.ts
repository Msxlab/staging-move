import { getProviderCoverageMetadata, type ProviderCoverageModel } from "@locateflow/db";
import {
  classifyMoveServiceTransition,
  safeJsonArray,
  type MoveServiceTransitionPlan,
  type MoveTransitionProviderInput,
} from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getProviderCoverageConfidenceFromDb, resolveEffectiveState } from "@/lib/provider-matching";

function safeParseJSON(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export interface MoveTransitionContext {
  movingPlan: any;
  transitionPlans: MoveServiceTransitionPlan[];
  fromState: string;
  toState: string;
  toZip: string;
}

export async function buildMoveTransitionContext(
  userId: string,
  movingPlanId: string,
): Promise<MoveTransitionContext> {
  const plan = await prisma.movingPlan.findUnique({
    where: { id: movingPlanId },
    include: {
      fromAddress: true,
      toAddress: true,
    },
  });

  if (!plan || plan.userId !== userId || plan.deletedAt) {
    throw new Error("Moving plan not found");
  }

  const fromState = (plan as any).fromAddress?.state || "";
  const toState = (plan as any).toAddress?.state || "";
  const fromZip = (plan as any).fromAddress?.zip || "";
  const toZip = (plan as any).toAddress?.zip || "";
  const effectiveToState = resolveEffectiveState(toState, toZip);

  if (!fromState || !effectiveToState) {
    throw new Error("Plan addresses must have state info");
  }

  const existingServices = await prisma.service.findMany({
    where: {
      userId,
      addressId: plan.fromAddressId,
      isActive: true,
      deletedAt: null,
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
      customProvider: {
        select: {
          id: true,
          name: true,
          category: true,
          providerType: true,
          trustStatus: true,
        },
      },
    },
  });

  const destinationProviders = await prisma.serviceProvider.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { scope: "FEDERAL" },
        { coverages: { some: { state: effectiveToState } } },
      ],
    },
    include: {
      coverages: { where: { state: effectiveToState } },
    },
  });

  const destinationProviderInputs: MoveTransitionProviderInput[] = destinationProviders.map((p: any) => {
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

  const transitionPlans = existingServices.map((service: any) =>
    classifyMoveServiceTransition({
      service: {
        id: service.id,
        category: service.category,
        providerName: service.providerName,
        providerId: service.providerId,
        customProviderId: service.customProviderId,
        customProviderType: service.customProvider?.providerType || null,
      },
      currentProvider: service.customProvider
        ? {
            id: service.customProvider.id,
            name: service.customProvider.name,
            category: service.customProvider.category,
            trustStatus: service.customProvider.trustStatus,
            providerType: service.customProvider.providerType,
          }
        : service.provider
          ? {
              id: service.provider.id,
              name: service.provider.name,
              category: service.provider.category,
              scope: service.provider.scope,
              states: safeParseJSON(service.provider.states, []),
            }
          : null,
      originAddress: { state: fromState, zip: fromZip },
      destinationAddress: { state: effectiveToState, zip: toZip },
      destinationProviderCandidates: destinationProviderInputs,
    }),
  );

  return {
    movingPlan: plan,
    transitionPlans,
    fromState,
    toState: effectiveToState,
    toZip,
  };
}

function buildTaskTitle(plan: MoveServiceTransitionPlan): string {
  return `${plan.actionLabel}: ${plan.serviceCategory.replace(/_/g, " ").toLowerCase()}`;
}

function buildIdempotencyKey(movingPlanId: string, plan: MoveServiceTransitionPlan): string {
  const providerPart =
    plan.actionType === "START_SERVICE" || plan.actionType === "VERIFY_AVAILABILITY"
      ? plan.destinationProviderCandidates[0]?.id || "no-provider"
      : "no-provider";
  return [
    "move-task",
    movingPlanId,
    plan.serviceId || "general",
    plan.actionType,
    providerPart,
  ].join(":");
}

export async function syncSuggestedMoveTasks(userId: string, movingPlanId: string) {
  const context = await buildMoveTransitionContext(userId, movingPlanId);
  const generated = [];
  const skipped = [];

  for (const plan of context.transitionPlans) {
    if (plan.actionType === "NO_ACTION") continue;
    const idempotencyKey = buildIdempotencyKey(movingPlanId, plan);
    const existing = await prisma.moveTask.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    const now = new Date();
    const data = {
      userId,
      movingPlanId,
      serviceId: plan.serviceId || null,
      originAddressId: context.movingPlan.fromAddressId,
      destinationAddressId: context.movingPlan.toAddressId,
      destinationProviderId:
        plan.actionType === "START_SERVICE" || plan.actionType === "VERIFY_AVAILABILITY"
          ? plan.destinationProviderCandidates[0]?.id || null
          : null,
      actionType: plan.actionType,
      source: "CLASSIFIER",
      title: buildTaskTitle(plan),
      description: plan.userFacingCopy,
      reason: plan.primaryReason,
      caveats: plan.caveats,
      confidence: plan.confidence,
      localEffect: {
        effectType: plan.taskEffectType,
        addressContext: plan.addressContext,
        localOnly: true,
      },
      metadata: {
        transitionPlan: plan,
        fromState: context.fromState,
        toState: context.toState,
        toZip: context.toZip,
        manualGuidanceOnly: true,
      },
      idempotencyKey,
      lastStatusChangedAt: now,
    };

    if (existing && ["COMPLETED", "DISMISSED"].includes(existing.status)) {
      skipped.push(existing);
      continue;
    }

    const task = existing
      ? await prisma.moveTask.update({
          where: { id: existing.id },
          data: {
            ...data,
            status: existing.status,
            lastStatusChangedAt: existing.lastStatusChangedAt,
          },
        })
      : await prisma.moveTask.create({ data });

    generated.push(task);
  }

  return {
    ...context,
    generated,
    skipped,
  };
}

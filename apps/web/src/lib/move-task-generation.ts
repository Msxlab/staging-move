import { getProviderCoverageMetadata, type Prisma, type ProviderCoverageModel } from "@locateflow/db";
import {
  classifyMoveServiceTransition,
  safeJsonArray,
  type MoveServiceTransitionPlan,
  type MoveTransitionProviderInput,
} from "@locateflow/shared";
import { resolveChecklistTemplateId } from "@/lib/checklist-template-map";
import { prisma } from "@/lib/db";
import { getProviderCoverageConfidenceFromDb, resolveEffectiveState } from "@/lib/provider-matching";
import { canGenerateMoveTasks } from "@/lib/plan-limits";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";

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
      workspace: { select: { ownerUserId: true } },
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
    where: activeTrackedServiceWhereForScope(
      { userId, workspaceId: plan.workspaceId },
      { addressId: plan.fromAddressId },
    ),
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
    // Most-popular-first so the classifier's default candidate[0] (used for
    // START_SERVICE / VERIFY_AVAILABILITY tasks) is the most popular provider
    // rather than an arbitrary DB order, plus a safety bound on the catalog scan.
    orderBy: { popularityScore: "desc" },
    take: 1000,
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
  const subject =
    plan.serviceProviderName ||
    plan.destinationProviderCandidates[0]?.name ||
    plan.serviceCategory.replace(/_/g, " ").toLowerCase();
  return `${plan.actionLabel}: ${subject}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const MOVE_TASK_DUE_DAY_OFFSETS: Partial<Record<MoveServiceTransitionPlan["actionType"], number>> = {
  STOP_SERVICE: -7,
  START_SERVICE: -14,
  TRANSFER_SERVICE: -14,
  VERIFY_AVAILABILITY: -21,
  SHOP_PROVIDER: -21,
  FIND_REPLACEMENT: -21,
  CANCEL_OR_CLOSE: -7,
  UPDATE_ADDRESS: -7,
  INSURANCE_REQUOTE: -14,
  MAIL_FORWARDING: -14,
  GOVERNMENT_UPDATE: 10,
};

function atLocalNoon(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  return new Date(atLocalNoon(date).getTime() + days * DAY_MS);
}

export function buildMoveTaskDueDate(
  moveDateInput: Date | string | null | undefined,
  actionType: MoveServiceTransitionPlan["actionType"],
  now: Date = new Date(),
): Date | null {
  if (!moveDateInput || actionType === "NO_ACTION") return null;
  const moveDate = moveDateInput instanceof Date ? moveDateInput : new Date(moveDateInput);
  if (Number.isNaN(moveDate.getTime())) return null;

  const offsetDays = MOVE_TASK_DUE_DAY_OFFSETS[actionType] ?? -7;
  const dueDate = addDays(moveDate, offsetDays);
  const today = atLocalNoon(now);
  const moveDay = atLocalNoon(moveDate);

  // If the user creates a near-term plan, don't bury pre-move tasks in the past.
  if (dueDate < today && moveDay >= today) return today;
  return dueDate;
}

function normalizeKeyState(value: string): string {
  return (value || "unknown").trim().toUpperCase() || "unknown";
}

function buildLegacyIdempotencyKey(movingPlanId: string, plan: MoveServiceTransitionPlan): string {
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

export function buildMoveTaskIdempotencyKey(
  movingPlanId: string,
  plan: MoveServiceTransitionPlan,
  context: { fromState: string; toState: string },
): string {
  const legacy = buildLegacyIdempotencyKey(movingPlanId, plan);
  return [
    legacy,
    normalizeKeyState(context.fromState),
    normalizeKeyState(context.toState),
  ].join(":");
}

export async function syncSuggestedMoveTasks(userId: string, movingPlanId: string) {
  const context = await buildMoveTransitionContext(userId, movingPlanId);
  const entitlement = await canGenerateMoveTasks(userId, {
    workspaceId: context.movingPlan.workspaceId,
    planOwnerUserId: context.movingPlan.workspace?.ownerUserId,
  });
  if (!entitlement.allowed) {
    throw new Error("MOVE_TASK_GENERATION_NOT_ENTITLED");
  }
  const generated = [];
  const skipped = [];

  for (const plan of context.transitionPlans) {
    if (plan.actionType === "NO_ACTION") continue;
    const idempotencyKey = buildMoveTaskIdempotencyKey(movingPlanId, plan, context);
    const legacyIdempotencyKey = buildLegacyIdempotencyKey(movingPlanId, plan);
    let existing = await prisma.moveTask.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (!existing) {
      existing = await prisma.moveTask.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: legacyIdempotencyKey } },
      });
    }
    if (!existing && plan.serviceId) {
      existing = await prisma.moveTask.findFirst({
        where: {
          userId,
          movingPlanId,
          serviceId: plan.serviceId,
          source: "CLASSIFIER",
          deletedAt: null,
          status: { notIn: ["COMPLETED", "DISMISSED"] },
        },
        orderBy: { createdAt: "desc" },
      });
    }
    const now = new Date();
    const data = {
      userId,
      movingPlanId,
      serviceId: plan.serviceId || null,
      originAddressId: context.movingPlan.fromAddressId,
      destinationAddressId: context.movingPlan.toAddressId,
      providerId: plan.serviceProviderId || null,
      destinationProviderId:
        plan.actionType === "START_SERVICE" || plan.actionType === "VERIFY_AVAILABILITY"
          ? plan.destinationProviderCandidates[0]?.id || null
          : null,
      actionType: plan.actionType,
      source: "CLASSIFIER",
      // Link back to the relocation-checklist template item (e.g. "P1_ELECTRIC")
      // so a COMPLETED task can mark that checklist item DONE. Null when the
      // service category has no corresponding checklist item — graceful no-op.
      templateId: resolveChecklistTemplateId(plan.serviceCategory),
      title: buildTaskTitle(plan),
      description: plan.userFacingCopy,
      reason: plan.primaryReason,
      caveats: plan.caveats,
      confidence: plan.confidence,
      dueDate: buildMoveTaskDueDate(context.movingPlan.moveDate, plan.actionType),
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
      } as unknown as Prisma.InputJsonObject,
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

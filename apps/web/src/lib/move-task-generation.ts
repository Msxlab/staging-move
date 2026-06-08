import { getProviderCoverageMetadata, type Prisma, type ProviderCoverageModel } from "@locateflow/db";
import {
  classifyMoveServiceTransition,
  safeJsonArray,
  buildChecklistTaskTemplates,
  composeChecklistTaskDescription,
  type MoveServiceTransitionPlan,
  type MoveTransitionProviderInput,
  type UserChecklistProfile,
  type ChecklistStateRuleContext,
  type ChecklistTaskTemplate,
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
      (p.coverageModel as ProviderCoverageModel | null | undefined) ||
      metadata?.coverageModel ||
      (zipCodes.length > 0 ? "zip_prefix" : "state");
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

// ── Checklist-task persistence ──────────────────────────────────────────────
// The rich relocation checklist (USPS, IRS 8822, USCIS AR-11, DMV, school,
// utilities, PCS) used to be client-display only and never persisted, so a
// mover who skipped the optional services step got ZERO reminders even for
// legally-required tasks. We now persist those checklist items as real MoveTask
// rows (source = "CHECKLIST"), keyed by a STABLE templateId-based idempotency
// key so re-syncs never duplicate and never clobber user edits / completion.

const CHECKLIST_TASK_SOURCE = "CHECKLIST";
// A generic, side-effect-free action type. The local-effects completer only
// mutates services for the classifier action types (STOP/START/TRANSFER/...),
// so a checklist task simply completes with no service side effects.
const CHECKLIST_TASK_ACTION_TYPE = "CHECKLIST_ITEM";

/** Stable idempotency key for a persisted checklist task — anchored on the
 *  checklist template id (NOT a service/provider), so it survives re-syncs and
 *  is unique per (plan, destination state, template item). */
export function buildChecklistTaskIdempotencyKey(
  movingPlanId: string,
  templateId: string,
  context: { fromState: string; toState: string },
): string {
  return [
    "checklist-task",
    movingPlanId,
    templateId,
    normalizeKeyState(context.fromState),
    normalizeKeyState(context.toState),
  ].join(":");
}

interface ChecklistProfileSource {
  hasChildren?: boolean | null;
  childrenCount?: number | null;
  hasPets?: boolean | null;
  hasSenior?: boolean | null;
  carCount?: number | null;
  hasDisability?: boolean | null;
  needsStorage?: boolean | null;
  hasMotorcycle?: boolean | null;
  hasBoatRV?: boolean | null;
  isImmigrant?: boolean | null;
  isBusinessOwner?: boolean | null;
  isMilitary?: boolean | null;
  moveType?: string | null;
}

/** Map a stored Profile row to the shared UserChecklistProfile. A `isMilitary`
 *  flag promotes the move type to MILITARY (PCS) so PCS-only items appear, even
 *  if `moveType` itself was left as PERSONAL. */
export function buildChecklistProfile(profile: ChecklistProfileSource | null): UserChecklistProfile {
  const rawMoveType = (profile?.moveType || "").toUpperCase();
  const moveType: UserChecklistProfile["moveType"] =
    profile?.isMilitary
      ? "MILITARY"
      : rawMoveType === "BUSINESS" || rawMoveType === "VACATION" || rawMoveType === "MILITARY"
        ? (rawMoveType as UserChecklistProfile["moveType"])
        : "PERSONAL";
  return {
    hasChildren: profile?.hasChildren ?? false,
    childrenCount: profile?.childrenCount ?? 0,
    hasPets: profile?.hasPets ?? false,
    hasSenior: profile?.hasSenior ?? false,
    carCount: profile?.carCount ?? 0,
    hasDisability: profile?.hasDisability ?? false,
    needsStorage: profile?.needsStorage ?? false,
    hasMotorcycle: profile?.hasMotorcycle ?? false,
    hasBoatRV: profile?.hasBoatRV ?? false,
    isImmigrant: profile?.isImmigrant ?? false,
    isBusinessOwner: profile?.isBusinessOwner ?? false,
    moveType,
  };
}

const CHECKLIST_PRIORITY_TO_CONFIDENCE: Record<ChecklistTaskTemplate["priority"], string> = {
  URGENT: "HIGH",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

/** Clamp a checklist task's due date so a back-dated move plan doesn't bury
 *  every reminder in the past (mirrors buildMoveTaskDueDate's behavior). */
function clampChecklistDueDate(dueDate: Date, now: Date): Date {
  const due = atLocalNoon(dueDate);
  const today = atLocalNoon(now);
  return due < today ? today : due;
}

/**
 * Persist the personalized relocation checklist as MoveTask rows. IDEMPOTENT:
 *  - keyed by a stable templateId-based idempotency key (no dup on re-sync),
 *  - skips template ids already covered by a service-derived CLASSIFIER task,
 *  - never clobbers COMPLETED/DISMISSED tasks or user-edited status/notes,
 *  - QUICK-WIN fallback: if the user tracks ZERO services, the full checklist is
 *    still persisted so the reminder pipeline is never empty.
 */
async function persistChecklistTasks(
  userId: string,
  movingPlanId: string,
  context: MoveTransitionContext,
  serviceCoveredTemplateIds: Set<string>,
): Promise<{ generated: any[]; skipped: any[] }> {
  const generated: any[] = [];
  const skipped: any[] = [];

  const moveDate = context.movingPlan.moveDate;
  if (!moveDate) return { generated, skipped };

  const [profileRow, stateRuleRow] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    context.toState
      ? prisma.stateRule.findUnique({ where: { stateCode: context.toState } })
      : Promise.resolve(null),
  ]);

  const profile = buildChecklistProfile(profileRow as ChecklistProfileSource | null);
  const stateRule: ChecklistStateRuleContext | null = stateRuleRow
    ? {
        dmvRules: stateRuleRow.dmvRules ?? null,
        voterRegistration: stateRuleRow.voterRegistration ?? null,
        taxInfo: stateRuleRow.taxInfo ?? null,
      }
    : null;

  const templates = buildChecklistTaskTemplates(
    profile,
    moveDate instanceof Date ? moveDate : new Date(moveDate),
    context.toState,
    stateRule,
  );

  for (const template of templates) {
    // Don't duplicate a checklist item that a tracked service already produced.
    if (serviceCoveredTemplateIds.has(template.templateId)) continue;

    const idempotencyKey = buildChecklistTaskIdempotencyKey(movingPlanId, template.templateId, context);
    const now = new Date();

    // Find any prior row for this template item in this plan: first by the
    // stable idempotency key, then by (templateId, source) as a backstop so a
    // re-key never spawns a second copy.
    let existing = await prisma.moveTask.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (!existing) {
      existing = await prisma.moveTask.findFirst({
        where: {
          userId,
          movingPlanId,
          templateId: template.templateId,
          source: CHECKLIST_TASK_SOURCE,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const dueDate = clampChecklistDueDate(
      template.dueDate instanceof Date ? template.dueDate : new Date(template.dueDate),
      now,
    );

    const data = {
      userId,
      movingPlanId,
      serviceId: null,
      originAddressId: context.movingPlan.fromAddressId,
      destinationAddressId: context.movingPlan.toAddressId,
      providerId: null,
      destinationProviderId: null,
      actionType: CHECKLIST_TASK_ACTION_TYPE,
      source: CHECKLIST_TASK_SOURCE,
      templateId: template.templateId,
      title: `${template.icon} ${template.title}`,
      description: composeChecklistTaskDescription(template),
      reason: template.isRequired
        ? "Required relocation checklist item personalized to your move."
        : "Recommended relocation checklist item personalized to your move.",
      caveats: [
        "Manual guidance only. LocateFlow does not update provider accounts or execute address changes.",
      ] as unknown as Prisma.InputJsonArray,
      confidence: CHECKLIST_PRIORITY_TO_CONFIDENCE[template.priority],
      dueDate,
      localEffect: {
        effectType: "NO_LOCAL_STATE_CHANGE",
        addressContext: "GENERAL",
        localOnly: true,
      } as unknown as Prisma.InputJsonObject,
      metadata: {
        checklistTemplateId: template.templateId,
        category: template.category,
        priority: template.priority,
        phase: template.phase,
        isRequired: template.isRequired,
        deadlineDays: template.deadlineDays,
        deadlineDate: template.deadlineDate ? template.deadlineDate.toISOString() : null,
        stateNote: template.stateNote,
        fromState: context.fromState,
        toState: context.toState,
        manualGuidanceOnly: true,
      } as unknown as Prisma.InputJsonObject,
      idempotencyKey,
      lastStatusChangedAt: now,
    };

    // Never resurrect or rewrite a task the user already resolved.
    if (existing && ["COMPLETED", "DISMISSED"].includes(existing.status)) {
      skipped.push(existing);
      continue;
    }

    const task = existing
      ? await prisma.moveTask.update({
          where: { id: existing.id },
          data: {
            ...data,
            // Preserve user-driven lifecycle: don't reset status, completion
            // timestamps, notes, or the original status-change time on re-sync.
            status: existing.status,
            lastStatusChangedAt: existing.lastStatusChangedAt,
            notes: existing.notes ?? null,
          },
        })
      : await prisma.moveTask.create({ data });

    generated.push(task);
  }

  return { generated, skipped };
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
  // Template ids already represented by a service-derived (CLASSIFIER) task in
  // this sync. The checklist-persistence pass below skips these so we never
  // create a duplicate row for the same checklist item (e.g. a tracked electric
  // service already yields a P1_ELECTRIC-linked task).
  const serviceCoveredTemplateIds = new Set<string>();

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
    // Link back to the relocation-checklist template item (e.g. "P1_ELECTRIC")
    // so a COMPLETED task can mark that checklist item DONE. Null when the
    // service category has no corresponding checklist item — graceful no-op.
    const classifierTemplateId = resolveChecklistTemplateId(plan.serviceCategory);
    if (classifierTemplateId) serviceCoveredTemplateIds.add(classifierTemplateId);
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
      templateId: classifierTemplateId,
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

  // Persist the rich, personalized relocation checklist as MoveTask rows so the
  // reminder crons see it — including for movers who track zero services.
  const checklistResult = await persistChecklistTasks(
    userId,
    movingPlanId,
    context,
    serviceCoveredTemplateIds,
  );
  generated.push(...checklistResult.generated);
  skipped.push(...checklistResult.skipped);

  return {
    ...context,
    generated,
    skipped,
  };
}

import { prisma } from "@/lib/db";
import { syncSuggestedMoveTasks } from "@/lib/move-task-generation";
import { CANCELED_MOVING_PLAN_STATUSES } from "@locateflow/shared";

export interface MoveTaskSyncSummary {
  attemptedPlans: number;
  generatedCount: number;
  skippedCount: number;
  failedPlanIds: string[];
}

const EMPTY_MOVE_TASK_SYNC: MoveTaskSyncSummary = {
  attemptedPlans: 0,
  generatedCount: 0,
  skippedCount: 0,
  failedPlanIds: [],
};

export async function syncMoveTasksForPlans(
  userId: string,
  movingPlanIds: string[],
  options: { workspaceId?: string | null } = {},
): Promise<MoveTaskSyncSummary> {
  const uniquePlanIds = [...new Set(movingPlanIds.filter(Boolean))];
  if (uniquePlanIds.length === 0) return EMPTY_MOVE_TASK_SYNC;

  const plans = await prisma.movingPlan.findMany({
    where: {
      id: { in: uniquePlanIds },
      deletedAt: null,
      ...(options.workspaceId ? { workspaceId: options.workspaceId } : { userId }),
    },
    select: { id: true, userId: true },
  });
  if (plans.length === 0) return EMPTY_MOVE_TASK_SYNC;

  const summary: MoveTaskSyncSummary = {
    attemptedPlans: plans.length,
    generatedCount: 0,
    skippedCount: 0,
    failedPlanIds: [],
  };

  for (const plan of plans) {
    try {
      const result = await syncSuggestedMoveTasks(plan.userId, plan.id);
      summary.generatedCount += result.generated.length;
      summary.skippedCount += result.skipped.length;
    } catch (error) {
      summary.failedPlanIds.push(plan.id);
      console.error("Move task sync failed:", { movingPlanId: plan.id, error });
    }
  }

  return summary;
}

export async function syncMoveTasksForAddress(
  userId: string,
  addressId: string,
  options: { workspaceId?: string | null } = {},
): Promise<MoveTaskSyncSummary> {
  const plans = await prisma.movingPlan.findMany({
    where: {
      ...(options.workspaceId ? { workspaceId: options.workspaceId } : { userId }),
      deletedAt: null,
      status: { notIn: ["COMPLETED", ...CANCELED_MOVING_PLAN_STATUSES] },
      OR: [{ fromAddressId: addressId }, { toAddressId: addressId }],
    },
    select: { id: true },
    take: 20,
  });

  return syncMoveTasksForPlans(
    userId,
    plans.map((plan) => plan.id),
    options,
  );
}

export async function safeSyncMoveTasksForAddress(
  userId: string,
  addressId: string,
  options: { workspaceId?: string | null } = {},
): Promise<MoveTaskSyncSummary & { syncFailed?: boolean }> {
  try {
    return await syncMoveTasksForAddress(userId, addressId, options);
  } catch (error) {
    console.error("Move task address sync failed:", { addressId, error });
    return { ...EMPTY_MOVE_TASK_SYNC, syncFailed: true };
  }
}

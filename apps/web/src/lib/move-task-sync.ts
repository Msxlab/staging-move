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
): Promise<MoveTaskSyncSummary> {
  const uniquePlanIds = [...new Set(movingPlanIds.filter(Boolean))];
  if (uniquePlanIds.length === 0) return EMPTY_MOVE_TASK_SYNC;

  const summary: MoveTaskSyncSummary = {
    attemptedPlans: uniquePlanIds.length,
    generatedCount: 0,
    skippedCount: 0,
    failedPlanIds: [],
  };

  for (const movingPlanId of uniquePlanIds) {
    try {
      const result = await syncSuggestedMoveTasks(userId, movingPlanId);
      summary.generatedCount += result.generated.length;
      summary.skippedCount += result.skipped.length;
    } catch (error) {
      summary.failedPlanIds.push(movingPlanId);
      console.error("Move task sync failed:", { movingPlanId, error });
    }
  }

  return summary;
}

export async function syncMoveTasksForAddress(
  userId: string,
  addressId: string,
): Promise<MoveTaskSyncSummary> {
  const plans = await prisma.movingPlan.findMany({
    where: {
      userId,
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
  );
}

export async function safeSyncMoveTasksForAddress(
  userId: string,
  addressId: string,
): Promise<MoveTaskSyncSummary & { syncFailed?: boolean }> {
  try {
    return await syncMoveTasksForAddress(userId, addressId);
  } catch (error) {
    console.error("Move task address sync failed:", { addressId, error });
    return { ...EMPTY_MOVE_TASK_SYNC, syncFailed: true };
  }
}

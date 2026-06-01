import type { MoveTaskStatus } from "./provider-move-domain";

export const MOVE_TASK_LIFECYCLE_EVENTS = [
  "ACCEPT",
  "START",
  "COMPLETE",
  "DISMISS",
  "REOPEN",
] as const;

export type MoveTaskLifecycleEvent =
  (typeof MOVE_TASK_LIFECYCLE_EVENTS)[number];

export interface MoveTaskLifecycleState {
  status: MoveTaskStatus;
  acceptedAt?: Date | string | null;
  completedAt?: Date | string | null;
  dismissedAt?: Date | string | null;
  reopenedAt?: Date | string | null;
}

export interface MoveTaskLifecyclePatch {
  status: MoveTaskStatus;
  acceptedAt?: Date;
  completedAt?: Date | null;
  dismissedAt?: Date | null;
  reopenedAt?: Date;
  lastStatusChangedAt: Date;
}

const ALLOWED_MOVE_TASK_TRANSITIONS: Record<
  MoveTaskStatus,
  ReadonlySet<MoveTaskLifecycleEvent>
> = {
  SUGGESTED: new Set(["ACCEPT", "START", "COMPLETE", "DISMISS"]),
  ACCEPTED: new Set(["START", "COMPLETE", "DISMISS"]),
  IN_PROGRESS: new Set(["COMPLETE", "DISMISS"]),
  COMPLETED: new Set(["REOPEN"]),
  DISMISSED: new Set(["REOPEN"]),
  REOPENED: new Set(["ACCEPT", "START", "COMPLETE", "DISMISS"]),
};

export function canTransitionMoveTaskStatus(
  current: MoveTaskStatus,
  event: MoveTaskLifecycleEvent,
): boolean {
  return ALLOWED_MOVE_TASK_TRANSITIONS[current]?.has(event) ?? false;
}

export function getNextMoveTaskStatus(
  current: MoveTaskStatus,
  event: MoveTaskLifecycleEvent,
): MoveTaskStatus {
  if (!canTransitionMoveTaskStatus(current, event)) {
    throw new Error("INVALID_MOVE_TASK_STATUS_TRANSITION");
  }
  if (event === "ACCEPT") return "ACCEPTED";
  if (event === "START") return "IN_PROGRESS";
  if (event === "COMPLETE") return "COMPLETED";
  if (event === "DISMISS") return "DISMISSED";
  if (event === "REOPEN") return "REOPENED";
  return current;
}

export function buildMoveTaskLifecyclePatch(
  state: MoveTaskLifecycleState,
  event: MoveTaskLifecycleEvent,
  now = new Date(),
): MoveTaskLifecyclePatch {
  const status = getNextMoveTaskStatus(state.status, event);
  const patch: MoveTaskLifecyclePatch = {
    status,
    lastStatusChangedAt: now,
  };

  if (event === "ACCEPT") patch.acceptedAt = now;
  if (event === "COMPLETE") patch.completedAt = now;
  if (event === "DISMISS") patch.dismissedAt = now;
  if (event === "REOPEN") {
    patch.reopenedAt = now;
    // Clear the prior terminal timestamps when a task is reopened. Otherwise a
    // completed-then-reopened task keeps its stale completedAt — which the monthly
    // report counts as "completed this period" and the GDPR export shows alongside
    // the reopen, both contradictory. A later COMPLETE/DISMISS re-stamps them.
    patch.completedAt = null;
    patch.dismissedAt = null;
  }

  return patch;
}

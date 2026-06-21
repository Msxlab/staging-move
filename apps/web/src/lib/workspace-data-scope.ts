import {
  can,
  type WorkspaceAction,
  type WorkspaceMemberStatus,
  type WorkspaceRole,
} from "@locateflow/shared";
import { ApiGateError } from "@/lib/api-gates";
import type { PlanLimitScope } from "@/lib/plan-limits";
import {
  isWorkspaceModelEnabled,
  requireWorkspaceContext,
  WorkspaceContextError,
} from "@/lib/workspace-context";

export interface WorkspaceDataScope {
  actorUserId: string;
  ownerUserId: string;
  workspaceId: string | null;
  workspaceMode: boolean;
  memberRole: WorkspaceRole | null;
  memberStatus: WorkspaceMemberStatus | null;
}

export function legacyDataScope(userId: string): WorkspaceDataScope {
  return {
    actorUserId: userId,
    ownerUserId: userId,
    workspaceId: null,
    workspaceMode: false,
    memberRole: null,
    memberStatus: null,
  };
}

async function safeWorkspaceModelEnabled(): Promise<boolean> {
  try {
    return await isWorkspaceModelEnabled();
  } catch {
    return false;
  }
}

export async function resolveWorkspaceDataScope(request: Request, userId: string): Promise<WorkspaceDataScope> {
  if (!(await safeWorkspaceModelEnabled())) return legacyDataScope(userId);

  try {
    const context = await requireWorkspaceContext(request);
    if (context.userId !== userId) {
      throw new ApiGateError("FORBIDDEN", "No permission to access this workspace.");
    }
    return {
      actorUserId: userId,
      ownerUserId: context.ownerUserId,
      workspaceId: context.workspaceId,
      workspaceMode: true,
      memberRole: context.memberRole,
      memberStatus: context.memberStatus,
    };
  } catch (error) {
    if (error instanceof WorkspaceContextError) {
      if (error.code === "UNAUTHENTICATED") {
        throw new ApiGateError("UNAUTHORIZED", error.message);
      }
      if (error.code === "WORKSPACE_NOT_FOUND") {
        throw new ApiGateError("NOT_FOUND", error.message);
      }
      if (error.code === "STALE_WORKSPACE_SELECTION") {
        throw new ApiGateError("STALE_WORKSPACE_SELECTION", error.message);
      }
      throw new ApiGateError("FORBIDDEN", error.message);
    }
    throw error;
  }
}

export function planLimitScopeForDataScope(scope: WorkspaceDataScope): PlanLimitScope {
  return scope.workspaceId
    ? { workspaceId: scope.workspaceId, planOwnerUserId: scope.ownerUserId }
    : {};
}

export function scopedRecordWhere(
  scope: WorkspaceDataScope,
  extra: Record<string, unknown> = {},
  options: { childSelfOnly?: boolean } = {},
) {
  const childSelfOnly = options.childSelfOnly && scope.memberRole === "CHILD";
  const base = scope.workspaceId && !childSelfOnly
    ? { workspaceId: scope.workspaceId }
    : {
        userId: scope.actorUserId,
        ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
      };
  return { ...base, ...extra };
}

export function recordBelongsToScope(
  record: { userId?: string | null; workspaceId?: string | null },
  scope: WorkspaceDataScope,
): boolean {
  if (scope.workspaceId) return record.workspaceId === scope.workspaceId;
  return record.userId === scope.actorUserId;
}

export function assertWorkspaceAction(
  scope: WorkspaceDataScope,
  action: WorkspaceAction,
  options: { resourceUserId?: string | null; message?: string } = {},
) {
  if (!scope.workspaceMode || !scope.memberRole) return;
  const allowed = can(scope.memberRole, action, {
    status: scope.memberStatus || undefined,
    isSelf: options.resourceUserId === scope.actorUserId,
  });
  if (!allowed) {
    throw new ApiGateError("FORBIDDEN", options.message || "You do not have permission to perform this action.");
  }
}

export function assertScopedRecordAction(
  record: { userId?: string | null; workspaceId?: string | null },
  scope: WorkspaceDataScope,
  action: WorkspaceAction,
  options: { notFoundMessage?: string; forbiddenMessage?: string } = {},
) {
  if (!recordBelongsToScope(record, scope)) {
    throw new ApiGateError("NOT_FOUND", options.notFoundMessage || "Not found.");
  }
  assertWorkspaceAction(scope, action, {
    resourceUserId: record.userId,
    message: options.forbiddenMessage,
  });
}

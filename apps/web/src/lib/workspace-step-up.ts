import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { verifyUserStepUp, type UserStepUpResult } from "@/lib/user-step-up";

export type WorkspaceSensitiveOperation =
  | "workspace_delete"
  | "workspace_restore"
  | "workspace_transfer";

export interface WorkspaceStepUpSuccess {
  ok: true;
  method: Extract<UserStepUpResult, { ok: true }>["method"];
}

export interface WorkspaceStepUpFailure {
  ok: false;
  response: Response;
}

const OPERATION_LABEL: Record<WorkspaceSensitiveOperation, string> = {
  workspace_delete: "deleting this workspace",
  workspace_restore: "restoring this workspace",
  workspace_transfer: "transferring workspace ownership",
};

function stepUpStatus(code: string): number {
  return code === "STEP_UP_REQUIRED" ? 403 : 401;
}

export async function requireWorkspaceStepUp(input: {
  request: Request;
  userId: string;
  workspaceId: string;
  body: Record<string, unknown>;
  operation: WorkspaceSensitiveOperation;
}): Promise<WorkspaceStepUpSuccess | WorkspaceStepUpFailure> {
  const { request, userId, workspaceId, body, operation } = input;
  const meta = extractRequestMeta(request);
  const hasMfaAttempt =
    typeof body?.mfaCode === "string" || typeof body?.backupCode === "string";

  if (hasMfaAttempt) {
    const rl = await enforceRateLimitPolicy(request, "mfa_verify", {
      userId,
      routeId: typeof body?.backupCode === "string"
        ? `${operation}_backup_code`
        : `${operation}_totp`,
    });
    if (!rl.success) {
      await createAuditLog({
        userId,
        action: "WORKSPACE_STEP_FAIL",
        entityType: "Workspace",
        entityId: workspaceId,
        changes: { operation, code: rl.policy.userFacingErrorCode },
        ...meta,
      });
      return {
        ok: false,
        response: Response.json(
          {
            code: rl.policy.userFacingErrorCode,
            error: "Too many verification attempts. Please wait and try again.",
          },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
        ),
      };
    }
  }

  const stepUp = await verifyUserStepUp({
    userId,
    confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : null,
    mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : null,
    backupCode: typeof body?.backupCode === "string" ? body.backupCode : null,
    operationLabel: OPERATION_LABEL[operation],
  });

  if (!stepUp.ok) {
    await createAuditLog({
      userId,
      action: "WORKSPACE_STEP_FAIL",
      entityType: "Workspace",
      entityId: workspaceId,
      changes: { operation, code: stepUp.code },
      ...meta,
    });
    return {
      ok: false,
      response: Response.json(
        { error: stepUp.message, code: stepUp.code, requiresStepUp: true },
        { status: stepUpStatus(stepUp.code) },
      ),
    };
  }

  return { ok: true, method: stepUp.method };
}

export async function auditWorkspaceSensitiveAction(input: {
  request: Request;
  userId: string;
  workspaceId: string;
  action: "WORKSPACE_DELETE" | "WORKSPACE_RESTORE" | "WORKSPACE_TRANSFER";
  stepUpMethod: WorkspaceStepUpSuccess["method"];
  changes?: Record<string, unknown>;
}): Promise<void> {
  await createAuditLog({
    userId: input.userId,
    action: input.action,
    entityType: "Workspace",
    entityId: input.workspaceId,
    changes: {
      ...(input.changes ?? {}),
      stepUpMethod: input.stepUpMethod,
    },
    ...extractRequestMeta(input.request),
  });
}

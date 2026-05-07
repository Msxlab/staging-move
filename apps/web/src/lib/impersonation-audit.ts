import { prisma } from "@/lib/db";
import type { UserSessionClaims } from "@/lib/user-auth";

/**
 * Writes an AdminAuditLog row when a mutating action is performed during
 * a SUPER_ADMIN impersonation session. No-op for normal user sessions.
 *
 * Call this from inside POST/PUT/PATCH/DELETE route handlers right before
 * (or right after) the mutation runs. Keep payloads small — the audit log
 * is for forensic attribution, not for replaying the request.
 *
 * Per-request audit logging in middleware would also catch GETs and asset
 * fetches; that is intentionally not implemented here. See
 * docs/audits/system/system_correctness_fix_report.md for the rollout plan.
 */
export async function recordImpersonatedMutation(input: {
  session: Pick<UserSessionClaims, "userId" | "sessionId" | "impersonatedByAdminId">;
  action: string;
  entityType: string;
  entityId: string;
  route?: string;
  ipAddress?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (!input.session.impersonatedByAdminId) return;
  const changes = {
    actor: "impersonation",
    targetUserId: input.session.userId,
    sessionId: input.session.sessionId ?? null,
    route: input.route ?? null,
    ...(input.details ?? {}),
  };
  await prisma.adminAuditLog
    .create({
      data: {
        adminUserId: input.session.impersonatedByAdminId,
        action: input.action.slice(0, 20),
        entityType: input.entityType.slice(0, 50),
        entityId: input.entityId.slice(0, 30),
        changes: JSON.stringify(changes),
        ipAddress: input.ipAddress ?? null,
      },
    })
    .catch(() => null);
}

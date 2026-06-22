import { prisma } from "@/lib/db";
import type { UserSessionClaims } from "@/lib/user-auth";
import { getUserSession } from "@/lib/user-auth";
import { resolveClientIP } from "@/lib/rate-limit";
import { redactAuditPayload } from "@locateflow/shared";

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
        changes: JSON.stringify(redactAuditPayload(changes)),
        ipAddress: input.ipAddress ?? null,
      },
    })
    .catch(() => null);
}

/**
 * Convenience wrapper for POST/PUT/PATCH/DELETE handlers: resolves the current
 * user session + client IP and records an impersonated-mutation audit entry.
 * No-op for normal (non-impersonated) sessions, best-effort (never throws, never
 * blocks the mutation). Call AFTER auth, around the state change.
 *
 * Rollout: wired into the highest-risk consumer mutations first (account
 * deletion, profile, data export); the remaining mutating routes should add the
 * same one-line call. See admin-impersonation-02 in docs/audit.
 */
export async function auditImpersonatedMutation(
  request: Request,
  input: { action: string; entityType: string; entityId: string; route?: string; details?: Record<string, unknown> },
): Promise<void> {
  try {
    const session = await getUserSession();
    if (!session?.impersonatedByAdminId) return;
    await recordImpersonatedMutation({
      session,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      route: input.route,
      ipAddress: resolveClientIP(request),
      details: input.details,
    });
  } catch {
    // Forensic logging is best-effort; never block or fail the mutation.
  }
}

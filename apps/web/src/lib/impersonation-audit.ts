import { NextResponse } from "next/server";
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

/**
 * Hard guard for account-control / billing mutations: when the current session
 * is a SUPER_ADMIN IMPERSONATING a user, REFUSE the action (HTTP 403) instead of
 * merely logging it. Forensic attribution alone cannot prevent account takeover
 * (password/MFA/session changes) or silent billing manipulation, so these
 * specific routes must block — an admin assisting a user has no legitimate need
 * to change that user's credentials, second factor, sessions, or paid plan.
 *
 * Returns a 403 NextResponse to return immediately, or null when the request is
 * NOT impersonated (the genuine user) — call right AFTER auth, BEFORE any state
 * change:
 *   const blocked = await blockIfImpersonating(request, { action: "PASSWORD_CHANGE", route: "/api/auth/password/change" });
 *   if (blocked) return blocked;
 *
 * The blocked attempt is itself recorded (best-effort) for forensics.
 */
export async function blockIfImpersonating(
  request: Request,
  context: { action: string; entityType?: string; entityId?: string; route?: string },
): Promise<NextResponse | null> {
  let session: Awaited<ReturnType<typeof getUserSession>> | null = null;
  try {
    session = await getUserSession();
  } catch {
    session = null;
  }
  if (!session?.impersonatedByAdminId) return null;

  await recordImpersonatedMutation({
    session,
    action: ("BLOCK_" + context.action).slice(0, 20),
    entityType: context.entityType ?? "User",
    entityId: context.entityId ?? session.userId,
    route: context.route,
    ipAddress: resolveClientIP(request),
    details: { blocked: true, reason: "impersonation_forbidden" },
  }).catch(() => null);

  return NextResponse.json(
    {
      error: "This action can't be performed while an administrator is assisting your account.",
      code: "IMPERSONATION_FORBIDDEN",
    },
    { status: 403 },
  );
}

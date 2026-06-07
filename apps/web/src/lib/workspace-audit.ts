/**
 * Audit + owner-notification helpers for the USER-facing workspace membership
 * and invitation routes (/api/workspaces/* and /api/invitations/*).
 *
 * These routes are driven by a normal USER session (getUserSession), not an
 * admin session — so the admin-app `writeAdminAudit` (which inserts an
 * AdminAuditLog row keyed to an admin actor) does not fit. The web actor is a
 * user, and the user-scoped `AuditLog` model already records `userId` as the
 * actor (see apps/web/src/lib/audit.ts). This module wraps `createAuditLog` so
 * every membership/invitation mutation lands in `AuditLog` with the workspace,
 * actor, and (masked) target captured in `changes`.
 *
 * IMPORTANT — AuditLog.action is `@db.VarChar(20)`. Action codes MUST stay
 * within 20 characters, so we use the short `WS_*` codes below rather than the
 * longer semantic names (e.g. WORKSPACE_INVITATION_ACCEPTED) which would be
 * rejected/truncated by the column. The semantic name is documented alongside
 * each code for traceability.
 */

import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { maskEmail } from "@/lib/workspace-routes";
import { prisma } from "@/lib/db";
import { createInAppNotification } from "@/lib/in-app-notifications";

/**
 * Audit action codes (≤ 20 chars to satisfy AuditLog.action VarChar(20)).
 * Semantic intent in comments mirrors the admin-app action vocabulary.
 */
export const WORKSPACE_AUDIT_ACTIONS = {
  /** WORKSPACE_INVITATION_ACCEPTED — an invitee joined via an invite token. */
  INVITATION_ACCEPTED: "WS_INV_ACCEPTED",
  /** WORKSPACE_INVITATION_REVOKED — a pending invite was revoked. */
  INVITATION_REVOKED: "WS_INV_REVOKED",
  /** WORKSPACE_MEMBER_ROLE_CHANGED — a member's role was changed. */
  MEMBER_ROLE_CHANGED: "WS_MEMBER_ROLE",
  /** WORKSPACE_MEMBER_REMOVED — a member was removed by another member. */
  MEMBER_REMOVED: "WS_MEMBER_REMOVED",
  /** WORKSPACE_MEMBER_LEFT — a member removed themselves. */
  MEMBER_LEFT: "WS_MEMBER_LEFT",
  /** WORKSPACE_MEMBER_SUSPENDED — a member's access was suspended (read-only). */
  MEMBER_SUSPENDED: "WS_MEMBER_SUSPEND",
  /** WORKSPACE_MEMBER_REACTIVATED — a suspended member was reactivated. */
  MEMBER_REACTIVATED: "WS_MEMBER_REACTIV",
} as const;

export type WorkspaceAuditAction =
  (typeof WORKSPACE_AUDIT_ACTIONS)[keyof typeof WORKSPACE_AUDIT_ACTIONS];

interface WorkspaceAuditInput {
  /** The mutating route's incoming request, for ip/user-agent capture. */
  request: Request;
  /** The acting user (session.userId). */
  actorUserId: string;
  action: WorkspaceAuditAction;
  workspaceId: string;
  /**
   * The entity the action targets — a workspace member id or invitation id.
   * Falls back to the workspaceId when there's no narrower target.
   */
  entityType: "workspace_member" | "workspace_invitation";
  entityId: string;
  /** Action-specific detail merged into `changes` (e.g. before/after role). */
  metadata?: Record<string, unknown>;
}

/**
 * Mask a target email for inclusion in the audit `changes` payload. Returns
 * `undefined` when there's no email so the key is simply omitted.
 */
export function maskTargetEmail(email: string | null | undefined): string | undefined {
  return email ? maskEmail(email) : undefined;
}

/**
 * Write a user-actor audit row for a workspace membership/invitation mutation.
 * Best-effort by construction — `createAuditLog` swallows its own errors so a
 * logging failure never breaks the mutation.
 */
export async function writeWorkspaceAudit(input: WorkspaceAuditInput): Promise<void> {
  await createAuditLog({
    userId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    changes: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      ...(input.metadata ?? {}),
    },
    ...extractRequestMeta(input.request),
  });
}

interface OwnerNotificationInput {
  workspaceId: string;
  /** The user who performed the action — suppresses self-notification. */
  actorUserId: string;
  title: string;
  body: string;
  /**
   * Stable dedupe suffix so retries/races don't double-notify the owner.
   * Combined with the workspace id into the final key.
   */
  dedupeSuffix?: string;
}

/**
 * Notify the workspace OWNER of a roster change they did NOT perform.
 *
 * Mirrors the multi-party notification pattern in the ownership-transfer route:
 * resolves the owner from `Workspace.ownerUserId`, suppresses delivery when the
 * owner is the actor (no point telling someone about their own action), and is
 * best-effort — a notification failure never breaks the mutation. The workspace
 * name is folded into the caller-provided body, so callers pass a finished
 * sentence.
 */
export async function notifyWorkspaceOwnerOfRosterChange(
  input: OwnerNotificationInput,
): Promise<void> {
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { ownerUserId: true },
    });
    if (!ws?.ownerUserId) return;
    // Suppress when the owner is the one who acted.
    if (ws.ownerUserId === input.actorUserId) return;

    await createInAppNotification({
      userId: ws.ownerUserId,
      type: "WORKSPACE_MEMBERSHIP",
      title: input.title,
      body: input.body,
      href: "/settings/workspace",
      dedupeKey: input.dedupeSuffix ? `ws-owner-roster:${input.workspaceId}:${input.dedupeSuffix}` : undefined,
    }).catch(() => {});
  } catch {
    // best-effort — never fail the mutation on a notification error
  }
}

/** Resolve a workspace's display name, falling back to a friendly default. */
export async function workspaceDisplayName(workspaceId: string): Promise<string> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  return ws?.name || "your workspace";
}

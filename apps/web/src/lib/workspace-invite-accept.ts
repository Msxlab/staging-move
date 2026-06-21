/**
 * Shared "accept a workspace invitation" core, extracted from the token route
 * (apps/web/src/app/api/invitations/[token]/accept/route.ts) so it can be driven
 * by BOTH the token route and the id-based in-app pending-invite routes.
 *
 * Contract: the CALLER is responsible for resolving the invitation row and for
 * authorizing the actor (session email == invite.invitedEmail, invite is
 * PENDING and non-expired). This helper takes an already-validated invite + the
 * acting user id and performs everything from there: the seat re-check (members
 * + still-outstanding pending invites, excluding THIS invite), the idempotent
 * member create + resource backfill ("cascade"), the invitation status flip to
 * ACCEPTED, the join audit, the inviter + owner notifications, and returns the
 * { workspaceId, role } the routes serialize back to the client.
 *
 * Errors surface as thrown AcceptInviteError instances with a stable `code` so
 * each route can map them to the SAME HTTP status the token route used.
 */

import { Prisma, type WorkspaceInvitation } from "@locateflow/db";
import { prisma } from "@/lib/db";
import { resolveConsumerEntitlement } from "@/lib/consumer-entitlement";
import { seatLimitForPlan } from "@/lib/workspace-invitations";
import { createInAppNotification } from "@/lib/in-app-notifications";
import {
  WORKSPACE_AUDIT_ACTIONS,
  maskTargetEmail,
  notifyWorkspaceOwnerOfRosterChange,
  workspaceDisplayName,
  writeWorkspaceAudit,
} from "@/lib/workspace-audit";

/** Stable failure codes so callers can map to the historical HTTP statuses. */
export type AcceptInviteErrorCode =
  | "WORKSPACE_NOT_FOUND" // 404 — the workspace behind the invite vanished
  | "SEAT_FULL" // 409 — at the seat ceiling
  | "RETRY" // 409 — serializable write-conflict (P2034); loser should retry
  | "ALREADY_MEMBER"; // 409 — unique-constraint race (P2002)

export class AcceptInviteError extends Error {
  readonly code: AcceptInviteErrorCode;
  constructor(code: AcceptInviteErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AcceptInviteError";
    this.code = code;
  }
}

export interface AcceptWorkspaceInvitationInput {
  /**
   * The already-resolved, already-authorized invitation row. The caller MUST
   * have verified it is PENDING, non-expired, and addressed to `userId`'s email.
   */
  invite: WorkspaceInvitation;
  /** The acting user (the invitee) joining the workspace. */
  userId: string;
  /** The incoming request, for audit ip/user-agent capture. */
  request: Request;
}

export interface AcceptWorkspaceInvitationResult {
  workspaceId: string;
  role: string;
}

/**
 * Apply an authorized workspace-invitation acceptance. See the file header for
 * the caller contract. Mirrors the token route's behavior 1:1.
 */
export async function acceptWorkspaceInvitation({
  invite,
  userId,
  request,
}: AcceptWorkspaceInvitationInput): Promise<AcceptWorkspaceInvitationResult> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: invite.workspaceId },
    select: { id: true, ownerUserId: true },
  });
  if (!workspace) throw new AcceptInviteError("WORKSPACE_NOT_FOUND");

  const ownerSub = await prisma.subscription.findUnique({ where: { userId: workspace.ownerUserId } });
  // Consumer seat gate → consumer-free override (audit P1-2).
  const seatLimit = seatLimitForPlan(
    String((await resolveConsumerEntitlement(ownerSub)).entitlement.effectivePlan),
  );

  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.workspaceMember.findFirst({
          where: { workspaceId: invite.workspaceId, userId },
        });
        if (!existing) {
          // Match countUsedSeats(): a used seat is a non-suspended member OR a
          // still-outstanding (non-expired) PENDING invite. Exclude the invite
          // being accepted right now — it's about to become a member, so counting
          // it here would double-charge the household for this single join.
          const now = new Date();
          const [memberCount, pendingCount] = await Promise.all([
            tx.workspaceMember.count({
              where: { workspaceId: invite.workspaceId, status: { not: "SUSPENDED" } },
            }),
            tx.workspaceInvitation.count({
              where: {
                workspaceId: invite.workspaceId,
                status: "PENDING",
                expiresAt: { gte: now },
                id: { not: invite.id },
              },
            }),
          ]);
          if (memberCount + pendingCount >= seatLimit) throw new Error("SEAT_FULL");
          await tx.workspaceMember.create({
            data: {
              workspaceId: invite.workspaceId,
              userId,
              role: invite.role,
              status: "ACTIVE",
              invitedByUserId: invite.invitedByUserId,
              invitationId: invite.id,
            },
          });
          // Stamp the joining member's existing shared resources into the
          // workspace so they don't vanish from scoped reads and they count toward
          // the pooled limit. Budgets are intentionally NOT merged — a member's
          // personal budget stays private; the household uses the owner-keyed one.
          const backfill = { userId, workspaceId: null };
          await Promise.all([
            tx.address.updateMany({ where: backfill, data: { workspaceId: invite.workspaceId } }),
            tx.service.updateMany({ where: backfill, data: { workspaceId: invite.workspaceId } }),
            tx.movingPlan.updateMany({ where: backfill, data: { workspaceId: invite.workspaceId } }),
          ]);
        }
        await tx.workspaceInvitation.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByUserId: userId },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "SEAT_FULL") {
      throw new AcceptInviteError("SEAT_FULL");
    }
    // Serializable write-conflict (P2034): two accepts raced for the last seat.
    // Ask the loser to retry — the re-check then sees the seat is taken, so the
    // member count can never exceed the limit under concurrency.
    if ((e as { code?: string })?.code === "P2034") {
      throw new AcceptInviteError("RETRY");
    }
    if ((e as { code?: string })?.code === "P2002") {
      throw new AcceptInviteError("ALREADY_MEMBER");
    }
    throw e;
  }

  // Audit the join (user-actor: the joining member). Best-effort.
  await writeWorkspaceAudit({
    request,
    actorUserId: userId,
    action: WORKSPACE_AUDIT_ACTIONS.INVITATION_ACCEPTED,
    workspaceId: invite.workspaceId,
    entityType: "workspace_invitation",
    entityId: invite.id,
    metadata: {
      invitationId: invite.id,
      role: invite.role,
      invitedByUserId: invite.invitedByUserId ?? undefined,
      targetEmail: maskTargetEmail(invite.invitedEmail),
    },
  });

  // Notify the inviter that their invite was accepted (best-effort, deduped).
  if (invite.invitedByUserId) {
    const ws = await prisma.workspace.findUnique({ where: { id: invite.workspaceId }, select: { name: true } });
    await createInAppNotification({
      userId: invite.invitedByUserId,
      type: "WORKSPACE_MEMBERSHIP",
      title: "Invitation accepted",
      body: `${invite.invitedEmail} joined ${ws?.name ?? "your workspace"}.`,
      href: "/settings/workspace",
      dedupeKey: `ws-invite-accepted:${invite.id}`,
    }).catch(() => {});
  }

  // Notify the OWNER that a new member joined (suppressed when the owner is the
  // one joining, or when the owner was the inviter — they're already covered by
  // the inviter notice above). Mirrors the transfer route's owner-aware notice.
  if (invite.invitedByUserId !== workspace.ownerUserId) {
    const wsName = await workspaceDisplayName(invite.workspaceId);
    await notifyWorkspaceOwnerOfRosterChange({
      workspaceId: invite.workspaceId,
      actorUserId: userId,
      title: "A new member joined",
      body: `${maskTargetEmail(invite.invitedEmail) ?? "A new member"} joined ${wsName}.`,
      dedupeSuffix: `joined:${invite.id}`,
    });
  }

  return { workspaceId: invite.workspaceId, role: invite.role };
}

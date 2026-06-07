import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import {
  WORKSPACE_AUDIT_ACTIONS,
  maskTargetEmail,
  writeWorkspaceAudit,
} from "@/lib/workspace-audit";

export const runtime = "nodejs";

/**
 * POST /api/invitations/pending/[id]/decline — decline an invitation in-app, by
 * its id.
 *
 * The email match is the authorization boundary: the invite is only declined if
 * its `invitedEmail` matches the CALLER's account email (case-insensitive). If
 * the invite doesn't exist OR is addressed to someone else, we return 404 so we
 * never confirm the existence of another user's invitation.
 *
 * The schema has no dedicated DECLINED status (status is a free String with
 * documented values PENDING|ACCEPTED|REVOKED|EXPIRED), so a decline is recorded
 * as REVOKED — the terminal "no longer actionable" state — stamped with the
 * declining user. Idempotent: declining an already non-PENDING invite returns
 * ok without a second write.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    const email = user.email.trim().toLowerCase();

    const invite = await prisma.workspaceInvitation.findUnique({ where: { id } });
    // 404 (not 403) when the invite is missing OR addressed to a different
    // email — never confirm the existence of someone else's invitation.
    if (!invite || invite.invitedEmail.toLowerCase() !== email) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    // Only a still-PENDING invite transitions; anything else is already terminal
    // (accepted/revoked/expired) so the decline is a no-op.
    if (invite.status === "PENDING") {
      await prisma.workspaceInvitation.update({
        where: { id: invite.id },
        data: { status: "REVOKED", revokedAt: new Date(), revokedByUserId: userId },
      });

      await writeWorkspaceAudit({
        request,
        actorUserId: userId,
        action: WORKSPACE_AUDIT_ACTIONS.INVITATION_REVOKED,
        workspaceId: invite.workspaceId,
        entityType: "workspace_invitation",
        entityId: invite.id,
        metadata: {
          invitationId: invite.id,
          role: invite.role,
          declinedByInvitee: true,
          targetEmail: maskTargetEmail(invite.invitedEmail),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to decline invitation:", error);
    return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceRole, type WorkspaceMemberStatus } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import {
  WORKSPACE_AUDIT_ACTIONS,
  maskTargetEmail,
  writeWorkspaceAudit,
} from "@/lib/workspace-audit";

export const runtime = "nodejs";

/** DELETE /api/workspaces/[id]/invitations/[invId] — revoke a pending invite. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; invId: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, invId } = await params;

  // 404 vs 403 (per-member invitation route):
  //  • Caller isn't a member of this workspace → 404. They may not even see the
  //    workspace, so never confirm the invitation's existence.
  //  • Caller is a member but lacks invite-management permission → 403. This is
  //    checked BEFORE the existence lookup on purpose: a non-manager gets the
  //    same 403 whether or not `invId` exists, so the blanket denial can't be
  //    used to probe which invitations exist.
  //  • Caller may manage invitations but this invId isn't in the workspace → 404.
  const caller = await prisma.workspaceMember.findFirst({
    where: { workspaceId: id, userId: session.userId, workspace: { deletedAt: null } },
  });
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(caller.role as WorkspaceRole, "member.invite", { status: caller.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "You can't manage invitations for this workspace." }, { status: 403 });
  }

  const inv = await prisma.workspaceInvitation.findFirst({ where: { id: invId, workspaceId: id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inv.status === "ACCEPTED") return NextResponse.json({ error: "Already accepted" }, { status: 409 });

  await prisma.workspaceInvitation.update({
    where: { id: invId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedByUserId: session.userId },
  });

  await writeWorkspaceAudit({
    request,
    actorUserId: session.userId,
    action: WORKSPACE_AUDIT_ACTIONS.INVITATION_REVOKED,
    workspaceId: id,
    entityType: "workspace_invitation",
    entityId: invId,
    metadata: {
      invitationId: invId,
      role: inv.role,
      targetEmail: maskTargetEmail(inv.invitedEmail),
    },
  });

  return NextResponse.json({ revoked: true });
}

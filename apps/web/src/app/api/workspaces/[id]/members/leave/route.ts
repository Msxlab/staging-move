import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceRole, type WorkspaceMemberStatus } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { reconcileWorkspaceSeats } from "@/lib/workspace-ownership";
import {
  WORKSPACE_AUDIT_ACTIONS,
  maskTargetEmail,
  notifyWorkspaceOwnerOfRosterChange,
  workspaceDisplayName,
  writeWorkspaceAudit,
} from "@/lib/workspace-audit";

export const runtime = "nodejs";

/** POST /api/workspaces/[id]/members/leave — the caller leaves the workspace. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const caller = await prisma.workspaceMember.findFirst({
    where: { workspaceId: id, userId: session.userId, workspace: { deletedAt: null } },
  });
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!can(caller.role as WorkspaceRole, "member.leave", { status: caller.status as WorkspaceMemberStatus })) {
    return NextResponse.json(
      {
        error:
          caller.role === "OWNER"
            ? "Transfer ownership before leaving."
            : "You can't leave this workspace.",
      },
      { status: 403 },
    );
  }

  const leaverRole = caller.role;
  const leaver = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  await prisma.workspaceMember.delete({ where: { id: caller.id } });

  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, { action: "WORKSPACE_MEMBER_LEAVE", entityType: "WorkspaceMember", entityId: caller.id, route: "/api/workspaces/[id]/members/leave" });

  await writeWorkspaceAudit({
    request,
    actorUserId: session.userId,
    action: WORKSPACE_AUDIT_ACTIONS.MEMBER_LEFT,
    workspaceId: id,
    entityType: "workspace_member",
    entityId: caller.id,
    metadata: {
      leftRole: leaverRole,
      targetEmail: maskTargetEmail(leaver?.email),
    },
  });

  // Notify the OWNER that a member left (suppressed when the owner is the actor —
  // owners can't leave without transferring first, but the guard is harmless).
  const wsName = await workspaceDisplayName(id);
  await notifyWorkspaceOwnerOfRosterChange({
    workspaceId: id,
    actorUserId: session.userId,
    title: "A member left",
    body: `${maskTargetEmail(leaver?.email) ?? "A member"} left ${wsName}.`,
    dedupeSuffix: `left:${session.userId}`,
  });

  // Freeing a seat may let an OVERFLOW (read-only) member regain full access.
  await reconcileWorkspaceSeats(id).catch(() => {});
  return NextResponse.json({ left: true });
}

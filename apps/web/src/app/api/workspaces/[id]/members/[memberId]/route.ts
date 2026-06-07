import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { sendWorkspaceMembershipEmail } from "@/lib/email-service";
import { reconcileWorkspaceSeats } from "@/lib/workspace-ownership";
import {
  WORKSPACE_AUDIT_ACTIONS,
  maskTargetEmail,
  notifyWorkspaceOwnerOfRosterChange,
  workspaceDisplayName,
  writeWorkspaceAudit,
} from "@/lib/workspace-audit";

export const runtime = "nodejs";

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Best-effort email mirroring the in-app role-change / removal notice. */
async function emailMembershipChange(
  kind: "role_changed" | "removed",
  workspaceId: string,
  targetUserId: string,
  roleLabel?: string,
): Promise<void> {
  try {
    const [user, ws] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true, firstName: true, preferredLocale: true } }),
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    ]);
    if (!user?.email) return;
    await sendWorkspaceMembershipEmail({
      kind,
      userEmail: user.email,
      userName: user.firstName,
      workspaceName: ws?.name || "your workspace",
      roleLabel,
      manageUrl: `${appBaseUrl()}/settings/workspace`,
      locale: user.preferredLocale,
      dedupeKey: kind === "role_changed" ? `ws-role:${workspaceId}:${targetUserId}:${roleLabel}` : `ws-removed:${workspaceId}:${targetUserId}`,
      metadata: { workspaceId },
    });
  } catch {
    // best-effort — never fail the mutation on a notification error
  }
}

const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER", "CHILD", "VIEW_ONLY"]; // OWNER goes through transfer, not role change

async function resolvePair(workspaceId: string, memberId: string, callerUserId: string) {
  const [caller, target] = await Promise.all([
    prisma.workspaceMember.findFirst({ where: { workspaceId, userId: callerUserId } }),
    prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } }),
  ]);
  return { caller, target };
}

/** PATCH /api/workspaces/[id]/members/[memberId] — change a member's role. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, memberId } = await params;

  const { caller, target } = await resolvePair(id, memberId, session.userId);
  if (!caller || !target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.userId === session.userId) {
    return NextResponse.json({ error: "You can't change your own role." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const newRole = typeof body?.role === "string" ? body.role : "";
  if (!ASSIGNABLE_ROLES.includes(newRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 422 });
  }
  // Promoting to ADMIN is OWNER-only; all role changes are gated on the target's current role.
  if (newRole === "ADMIN" && !can(caller.role as WorkspaceRole, "member.promoteAdmin", { status: caller.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "Only the owner can grant the Admin role." }, { status: 403 });
  }
  if (!can(caller.role as WorkspaceRole, "member.changeRole", { targetRole: target.role as WorkspaceRole, status: caller.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "You can't change this member's role." }, { status: 403 });
  }

  const fromRole = target.role;
  const updated = await prisma.workspaceMember.update({ where: { id: memberId }, data: { role: newRole } });
  await createInAppNotification({
    userId: target.userId,
    type: "WORKSPACE_MEMBERSHIP",
    title: "Your role changed",
    body: `Your role in this workspace is now ${updated.role}.`,
    href: "/settings/workspace",
  }).catch(() => {});
  await emailMembershipChange("role_changed", id, target.userId, updated.role);

  const targetUser = await prisma.user.findUnique({ where: { id: target.userId }, select: { email: true } });
  await writeWorkspaceAudit({
    request,
    actorUserId: session.userId,
    action: WORKSPACE_AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
    workspaceId: id,
    entityType: "workspace_member",
    entityId: memberId,
    metadata: {
      targetUserId: target.userId,
      targetEmail: maskTargetEmail(targetUser?.email),
      fromRole,
      toRole: updated.role,
    },
  });

  // Notify the OWNER of the role change (suppressed when the owner performed it).
  const wsName = await workspaceDisplayName(id);
  await notifyWorkspaceOwnerOfRosterChange({
    workspaceId: id,
    actorUserId: session.userId,
    title: "A member's role changed",
    body: `${maskTargetEmail(targetUser?.email) ?? "A member"}'s role in ${wsName} changed from ${fromRole} to ${updated.role}.`,
    dedupeSuffix: `role:${memberId}:${updated.role}`,
  });

  return NextResponse.json({ id: updated.id, role: updated.role });
}

/** DELETE /api/workspaces/[id]/members/[memberId] — remove a member. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, memberId } = await params;

  const { caller, target } = await resolvePair(id, memberId, session.userId);
  if (!caller || !target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.userId === session.userId) {
    return NextResponse.json({ error: "Use leave to remove yourself." }, { status: 409 });
  }
  if (!can(caller.role as WorkspaceRole, "member.remove", { targetRole: target.role as WorkspaceRole, status: caller.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "You can't remove this member." }, { status: 403 });
  }

  // Removing the member deletes only the membership row. Their domain data
  // (Address/Service carrying this workspaceId) stays with the workspace, and
  // their personal connector consents are user-scoped — untouched by design.
  const removedUserId = target.userId;
  const removedRole = target.role;
  const removedUser = await prisma.user.findUnique({ where: { id: removedUserId }, select: { email: true } });
  await prisma.workspaceMember.delete({ where: { id: memberId } });
  await createInAppNotification({
    userId: removedUserId,
    type: "WORKSPACE_MEMBERSHIP",
    title: "Removed from workspace",
    body: "You were removed from a shared workspace.",
    href: "/settings/workspace",
  }).catch(() => {});
  await emailMembershipChange("removed", id, removedUserId);

  await writeWorkspaceAudit({
    request,
    actorUserId: session.userId,
    action: WORKSPACE_AUDIT_ACTIONS.MEMBER_REMOVED,
    workspaceId: id,
    entityType: "workspace_member",
    entityId: memberId,
    metadata: {
      targetUserId: removedUserId,
      targetEmail: maskTargetEmail(removedUser?.email),
      removedRole,
    },
  });

  // Notify the OWNER that a member was removed (suppressed when the owner did it).
  const wsName = await workspaceDisplayName(id);
  await notifyWorkspaceOwnerOfRosterChange({
    workspaceId: id,
    actorUserId: session.userId,
    title: "A member was removed",
    body: `${maskTargetEmail(removedUser?.email) ?? "A member"} was removed from ${wsName}.`,
    dedupeSuffix: `removed:${removedUserId}`,
  });

  // Removing a member frees a seat — restore an OVERFLOW member if one is waiting.
  await reconcileWorkspaceSeats(id).catch(() => {});
  return NextResponse.json({ removed: true });
}

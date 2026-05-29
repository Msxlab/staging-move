import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

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

  const updated = await prisma.workspaceMember.update({ where: { id: memberId }, data: { role: newRole } });
  return NextResponse.json({ id: updated.id, role: updated.role });
}

/** DELETE /api/workspaces/[id]/members/[memberId] — remove a member. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
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
  await prisma.workspaceMember.delete({ where: { id: memberId } });
  return NextResponse.json({ removed: true });
}

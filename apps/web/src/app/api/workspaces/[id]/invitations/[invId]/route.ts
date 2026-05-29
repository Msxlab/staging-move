import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/** DELETE /api/workspaces/[id]/invitations/[invId] — revoke a pending invite. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; invId: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, invId } = await params;

  const caller = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(caller.role as WorkspaceRole, "member.invite")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inv = await prisma.workspaceInvitation.findFirst({ where: { id: invId, workspaceId: id } });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (inv.status === "ACCEPTED") return NextResponse.json({ error: "Already accepted" }, { status: 409 });

  await prisma.workspaceInvitation.update({
    where: { id: invId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedByUserId: session.userId },
  });
  return NextResponse.json({ revoked: true });
}

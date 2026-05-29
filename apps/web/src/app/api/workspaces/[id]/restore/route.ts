import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/**
 * POST /api/workspaces/[id]/restore — owner-only undelete within the grace
 * window. Uses a conditional updateMany so a soft-deleted row (hidden from the
 * extended client's reads) is still restorable without the raw client.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(member.role as WorkspaceRole, "workspace.delete")) {
    return NextResponse.json({ error: "Only the owner can restore the workspace." }, { status: 403 });
  }

  const res = await prisma.workspace.updateMany({
    where: { id, deletedAt: { not: null }, deletionGraceUntil: { gt: new Date() } },
    data: { deletedAt: null, deletionGraceUntil: null },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Restore window expired or workspace not deleted." }, { status: 410 });
  }

  return NextResponse.json({ id, restored: true });
}

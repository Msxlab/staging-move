import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * POST /api/workspaces/[id]/delete — owner-only soft delete with a 7-day grace.
 * Type-to-confirm for now; the WorkspaceAuthChallenge step-up (doc 15/16) wraps
 * this later. Recoverable via /restore within the grace window.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(member.role as WorkspaceRole, "workspace.delete")) {
    return NextResponse.json({ error: "Only the owner can delete the workspace." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  const now = new Date();
  const deletionGraceUntil = new Date(now.getTime() + GRACE_MS);
  const res = await prisma.workspace.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: now, deletionGraceUntil },
  });
  if (res.count === 0) return NextResponse.json({ error: "Already deleted" }, { status: 409 });

  return NextResponse.json({ deletedAt: now, deletionGraceUntil });
}

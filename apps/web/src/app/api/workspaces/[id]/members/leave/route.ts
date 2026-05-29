import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/** POST /api/workspaces/[id]/members/leave — the caller leaves the workspace. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const caller = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!can(caller.role as WorkspaceRole, "member.leave")) {
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

  await prisma.workspaceMember.delete({ where: { id: caller.id } });
  return NextResponse.json({ left: true });
}

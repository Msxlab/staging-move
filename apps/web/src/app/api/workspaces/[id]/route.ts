import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { planLabelForOwner, workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/** GET /api/workspaces/[id] — detail for a workspace the caller belongs to. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(
    {
      id: workspace.id,
      name: workspace.name,
      ownerUserId: workspace.ownerUserId,
      role: member.role,
      memberCount: await prisma.workspaceMember.count({ where: { workspaceId: id } }),
      planLabel: await planLabelForOwner(workspace.ownerUserId),
      createdAt: workspace.createdAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

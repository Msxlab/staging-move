import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
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

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: id, userId: session.userId, workspace: { deletedAt: null } },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workspace = await prisma.workspace.findFirst({ where: { id, deletedAt: null } });
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

/**
 * PATCH /api/workspaces/[id] — rename the workspace (household name). OWNER-only
 * via the permission matrix (workspace.rename). Used by the Family/Pro household
 * setup step and by an owner renaming later. Additive; inert when the workspace
 * feature flag is off (the gate 404s before reaching here).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: id, userId: session.userId, workspace: { deletedAt: null } },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(member.role as WorkspaceRole, "workspace.rename", { status: member.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "Only the owner can rename this workspace." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60) {
    return NextResponse.json({ error: "Name must be between 1 and 60 characters." }, { status: 422 });
  }

  const updated = await prisma.workspace.updateMany({ where: { id, deletedAt: null }, data: { name } });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id, name });
}

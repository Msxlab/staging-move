import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/** PATCH /api/workspaces/[id]/rename — owner-only. */
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
    return NextResponse.json({ error: "Only the owner can rename the workspace." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 422 });

  const res = await prisma.workspace.updateMany({ where: { id, deletedAt: null }, data: { name } });
  if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, { action: "RENAME", entityType: "Workspace", entityId: id, route: "/api/workspaces/[id]/rename" });
  return NextResponse.json({ id, name });
}

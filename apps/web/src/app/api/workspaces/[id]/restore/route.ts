import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceRole, type WorkspaceMemberStatus } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { auditWorkspaceSensitiveAction, requireWorkspaceStepUp } from "@/lib/workspace-step-up";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";

export const runtime = "nodejs";

/**
 * POST /api/workspaces/[id]/restore — owner-only undelete within the grace
 * window. Uses a conditional updateMany so a soft-deleted row (hidden from the
 * extended client's reads) is still restorable without the raw client.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(member.role as WorkspaceRole, "workspace.delete", { status: member.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "Only the owner can restore the workspace." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const stepUp = await requireWorkspaceStepUp({
    request,
    userId: session.userId,
    workspaceId: id,
    body,
    operation: "workspace_restore",
  });
  if (!stepUp.ok) return stepUp.response;

  const res = await prisma.workspace.updateMany({
    where: { id, deletedAt: { not: null }, deletionGraceUntil: { gt: new Date() } },
    data: { deletedAt: null, deletionGraceUntil: null },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Restore window expired or workspace not deleted." }, { status: 410 });
  }

  await auditWorkspaceSensitiveAction({
    request,
    userId: session.userId,
    workspaceId: id,
    action: "WORKSPACE_RESTORE",
    stepUpMethod: stepUp.method,
  });

  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, { action: "WORKSPACE_RESTORE", entityType: "Workspace", entityId: id, route: "/api/workspaces/[id]/restore" });

  return NextResponse.json({ id, restored: true });
}

import { NextRequest, NextResponse } from "next/server";
import { resolveManagedSyncEnabled, statusAllowsMutation, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/**
 * GET / PUT /api/workspaces/[id]/managed-sync — the caller's OWN managed-sync
 * consent in this workspace: whether an owner/admin may push an address change
 * to the caller's connected partners on their behalf. CHILD defaults on
 * (guardian-managed); everyone else defaults off until they opt in. Each member
 * controls only their own record.
 */
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

  return NextResponse.json({
    enabled: resolveManagedSyncEnabled(member.role as WorkspaceRole, member.managedSyncEnabled),
    explicit: member.managedSyncEnabled,
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: id, userId: session.userId, workspace: { deletedAt: null } },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!statusAllowsMutation(member.status as WorkspaceMemberStatus)) {
    return NextResponse.json({ error: "Your workspace access is read-only right now." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 422 });
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: member.id },
    data: { managedSyncEnabled: body.enabled },
  });
  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, { action: "MANAGED_SYNC_CONSENT_UPDATE", entityType: "WorkspaceMember", entityId: member.id, route: "/api/workspaces/[id]/managed-sync" });
  return NextResponse.json({
    enabled: resolveManagedSyncEnabled(updated.role as WorkspaceRole, updated.managedSyncEnabled),
    explicit: updated.managedSyncEnabled,
  });
}

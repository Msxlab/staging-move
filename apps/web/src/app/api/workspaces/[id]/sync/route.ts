import { NextRequest, NextResponse } from "next/server";
import {
  can,
  resolveManagedSyncEnabled,
  type WorkspaceMemberStatus,
  type WorkspaceRole,
} from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { isApiConnectorsEnabled } from "@/lib/connector-oauth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { enqueueAddressChange } from "@/lib/connector-runtime";

export const runtime = "nodejs";

/**
 * POST /api/workspaces/[id]/sync — authorized entry point for "sync an address
 * to connected partners" within a workspace.
 *
 * Two modes, both gated by WORKSPACE_MODEL_ENABLED + FEATURE_API_CONNECTORS:
 *  - Self (default): the caller syncs their own move — can("addressChange.initiate").
 *  - On behalf of a member (body.onBehalfOfUserId): the caller pushes to ANOTHER
 *    member's partners — requires can("addressChange.manageForMembers") on the
 *    caller AND the target member's managed-sync consent
 *    (resolveManagedSyncEnabled; CHILD defaults on). Uses the target's own
 *    server-held tokens — the manager never sees partner credentials.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isApiConnectorsEnabled())) {
    return NextResponse.json({ error: "Connectors are not enabled." }, { status: 503 });
  }
  const { id } = await params;

  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const toAddressId = typeof body?.toAddressId === "string" ? body.toAddressId : "";
  const fromAddressId = typeof body?.fromAddressId === "string" ? body.fromAddressId : null;
  const onBehalfOfUserId =
    typeof body?.onBehalfOfUserId === "string" && body.onBehalfOfUserId ? body.onBehalfOfUserId : null;
  if (!toAddressId) return NextResponse.json({ error: "toAddressId is required" }, { status: 422 });

  // Subject = whose connected partners receive the push.
  const subjectUserId = onBehalfOfUserId ?? session.userId;
  const callerRole = member.role as WorkspaceRole;
  const callerStatus = member.status as WorkspaceMemberStatus;

  if (subjectUserId !== session.userId) {
    // On-behalf: manager authority + the target member's own consent.
    if (!can(callerRole, "addressChange.manageForMembers", { status: callerStatus })) {
      return NextResponse.json({ error: "You can't manage sync for other members." }, { status: 403 });
    }
    const target = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: subjectUserId } });
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!resolveManagedSyncEnabled(target.role as WorkspaceRole, target.managedSyncEnabled)) {
      return NextResponse.json({ error: "This member hasn't allowed managed sync." }, { status: 403 });
    }
  } else {
    // Self: the caller starts their own sync.
    if (!can(callerRole, "addressChange.initiate", { status: callerStatus })) {
      return NextResponse.json({ error: "You can't start a sync in this workspace." }, { status: 403 });
    }
  }

  // The destination address must belong to the subject.
  const address = await prisma.address.findFirst({ where: { id: toAddressId, userId: subjectUserId } });
  if (!address) return NextResponse.json({ error: "Address not found" }, { status: 404 });

  const result = await enqueueAddressChange({ userId: subjectUserId, toAddressId, fromAddressId });
  return NextResponse.json(result);
}

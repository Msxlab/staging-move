import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { isApiConnectorsEnabled } from "@/lib/connector-oauth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { enqueueAddressChange } from "@/lib/connector-runtime";

export const runtime = "nodejs";

/**
 * POST /api/workspaces/[id]/sync — the authorized entry point for "sync my
 * address to my connected partners" within a workspace.
 *
 * Gated by both flags (WORKSPACE_MODEL_ENABLED + FEATURE_API_CONNECTORS) and by
 * the permission matrix (can("addressChange.initiate") — OWNER/ADMIN/MEMBER;
 * not CHILD/VIEW_ONLY). Enqueues for the CALLING member using their own
 * consents (consents are personal). A workspace-wide fan-out across members
 * (OWNER scope) is a follow-up that needs per-member address mapping.
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
  if (
    !can(member.role as WorkspaceRole, "addressChange.initiate", { status: member.status as WorkspaceMemberStatus })
  ) {
    return NextResponse.json({ error: "You can't start a sync in this workspace." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const toAddressId = typeof body?.toAddressId === "string" ? body.toAddressId : "";
  const fromAddressId = typeof body?.fromAddressId === "string" ? body.fromAddressId : null;
  if (!toAddressId) return NextResponse.json({ error: "toAddressId is required" }, { status: 422 });

  // The destination address must belong to the caller.
  const address = await prisma.address.findFirst({ where: { id: toAddressId, userId: session.userId } });
  if (!address) return NextResponse.json({ error: "Address not found" }, { status: 404 });

  const result = await enqueueAddressChange({ userId: session.userId, toAddressId, fromAddressId });
  return NextResponse.json(result);
}

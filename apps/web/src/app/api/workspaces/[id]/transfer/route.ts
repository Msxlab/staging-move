import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { transferWorkspaceOwnership } from "@/lib/workspace-ownership";

export const runtime = "nodejs";

/**
 * POST /api/workspaces/[id]/transfer — the owner hands ownership to another
 * active member (the previous owner becomes ADMIN). Owner-only. This also moves
 * the billing/entitlement anchor to the new owner's subscription.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(member.role as WorkspaceRole, "member.transferOwner", { status: member.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "Only the owner can transfer ownership." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const toUserId = typeof body?.toUserId === "string" ? body.toUserId : "";
  if (!toUserId) return NextResponse.json({ error: "toUserId is required" }, { status: 422 });

  const result = await transferWorkspaceOwnership(id, session.userId, toUserId);
  if (!result.ok) return NextResponse.json({ error: result.error || "Transfer failed." }, { status: 409 });
  return NextResponse.json({ ok: true });
}

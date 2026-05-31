import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { transferWorkspaceOwnership } from "@/lib/workspace-ownership";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { sendWorkspaceOwnershipEmail } from "@/lib/email-service";

export const runtime = "nodejs";

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

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

  // Notify both parties — previously this transfer was completely silent.
  // Best-effort: a notification/email failure must not fail the transfer.
  try {
    const [newOwner, workspace] = await Promise.all([
      prisma.user.findUnique({ where: { id: toUserId }, select: { email: true, firstName: true, preferredLocale: true } }),
      prisma.workspace.findUnique({ where: { id }, select: { name: true } }),
    ]);
    const wsName = workspace?.name || "your workspace";
    await createInAppNotification({
      userId: toUserId,
      type: "WORKSPACE_MEMBERSHIP",
      title: "You're now the workspace owner",
      body: `Ownership of ${wsName} was transferred to you. You now manage its members, roles, and plan.`,
      href: "/settings/workspace",
      dedupeKey: `ws-owner:${id}:${toUserId}`,
    }).catch(() => {});
    await createInAppNotification({
      userId: session.userId,
      type: "WORKSPACE_MEMBERSHIP",
      title: "Ownership transferred",
      body: `You transferred ownership of ${wsName}. You're now an admin of it.`,
      href: "/settings/workspace",
      dedupeKey: `ws-owner-from:${id}:${session.userId}:${toUserId}`,
    }).catch(() => {});
    if (newOwner?.email) {
      await sendWorkspaceOwnershipEmail({
        newOwnerEmail: newOwner.email,
        newOwnerName: newOwner.firstName,
        workspaceName: wsName,
        manageUrl: `${appBaseUrl()}/settings/workspace`,
        reason: "transfer",
        locale: newOwner.preferredLocale,
        dedupeKey: `ws-owner-email:${id}:${toUserId}`,
        metadata: { workspaceId: id },
      }).catch(() => {});
    }
  } catch {
    // ignore — transfer already succeeded
  }

  return NextResponse.json({ ok: true });
}

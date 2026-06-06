import { NextRequest, NextResponse } from "next/server";
import { getEffectiveEntitlement } from "@locateflow/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { hashInvitationToken, seatLimitForPlan } from "@/lib/workspace-invitations";
import { createInAppNotification } from "@/lib/in-app-notifications";

export const runtime = "nodejs";

/**
 * POST /api/invitations/[token]/accept — accept an invite. Requires a session
 * whose email matches the invited email; joins the workspace (idempotent) and
 * marks the invite accepted in one transaction.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Sign in to accept." }, { status: 401 });
  const { token } = await params;

  const inv = await prisma.workspaceInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) } });
  if (!inv || inv.status !== "PENDING") return NextResponse.json({ error: "Invitation not available." }, { status: 410 });
  if (inv.expiresAt < new Date()) return NextResponse.json({ error: "This invitation expired." }, { status: 410 });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  if (!user || user.email.toLowerCase() !== inv.invitedEmail.toLowerCase()) {
    return NextResponse.json({ error: "This invitation is for a different email address." }, { status: 403 });
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: inv.workspaceId }, select: { id: true, ownerUserId: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  const ownerSub = await prisma.subscription.findUnique({ where: { userId: workspace.ownerUserId } });
  const seatLimit = seatLimitForPlan(String(getEffectiveEntitlement(ownerSub).effectivePlan));

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceMember.findFirst({ where: { workspaceId: inv.workspaceId, userId: session.userId } });
      if (!existing) {
        const memberCount = await tx.workspaceMember.count({
          where: { workspaceId: inv.workspaceId, status: { not: "SUSPENDED" } },
        });
        if (memberCount >= seatLimit) throw new Error("SEAT_FULL");
        await tx.workspaceMember.create({
          data: {
            workspaceId: inv.workspaceId,
            userId: session.userId,
            role: inv.role,
            status: "ACTIVE",
            invitedByUserId: inv.invitedByUserId,
            invitationId: inv.id,
          },
        });
      }
      await tx.workspaceInvitation.update({
        where: { id: inv.id },
        data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByUserId: session.userId },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (e instanceof Error && e.message === "SEAT_FULL") {
      return NextResponse.json({ error: "Workspace is at its seat limit." }, { status: 409 });
    }
    // Serializable write-conflict (P2034): two accepts raced for the last seat.
    // Ask the loser to retry — the re-check then sees the seat is taken, so the
    // member count can never exceed the limit under concurrency.
    if ((e as { code?: string })?.code === "P2034") {
      return NextResponse.json({ error: "Please try again." }, { status: 409 });
    }
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "You are already a member of this workspace." }, { status: 409 });
    }
    throw e;
  }

  // Notify the inviter that their invite was accepted (best-effort, deduped).
  if (inv.invitedByUserId) {
    const ws = await prisma.workspace.findUnique({ where: { id: inv.workspaceId }, select: { name: true } });
    await createInAppNotification({
      userId: inv.invitedByUserId,
      type: "WORKSPACE_MEMBERSHIP",
      title: "Invitation accepted",
      body: `${inv.invitedEmail} joined ${ws?.name ?? "your workspace"}.`,
      href: "/settings/workspace",
      dedupeKey: `ws-invite-accepted:${inv.id}`,
    }).catch(() => {});
  }

  const response = NextResponse.json({ workspaceId: inv.workspaceId, role: inv.role });
  response.cookies.set("lf_workspace_id", inv.workspaceId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

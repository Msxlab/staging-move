import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { hashInvitationToken } from "@/lib/workspace-invitations";
import { AcceptInviteError, acceptWorkspaceInvitation } from "@/lib/workspace-invite-accept";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/invitations/[token]/accept — accept an invite. Requires a session
 * whose email matches the invited email; joins the workspace (idempotent) and
 * marks the invite accepted in one transaction.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Sign in to accept." }, { status: 401 });

  // Throttle accept attempts per account so a held link can't be hammered.
  const rl = await rateLimit(`invite:accept:${session.userId}`, { limit: 10, windowSeconds: 60, failClosed: true });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }
  const { token } = await params;

  const inv = await prisma.workspaceInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) } });
  if (!inv || inv.status !== "PENDING") return NextResponse.json({ error: "Invitation not available." }, { status: 410 });
  if (inv.expiresAt < new Date()) return NextResponse.json({ error: "This invitation expired." }, { status: 410 });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, emailVerifiedAt: true } });
  if (!user || user.email.toLowerCase() !== inv.invitedEmail.toLowerCase()) {
    return NextResponse.json({ error: "This invitation is for a different email address." }, { status: 403 });
  }
  // Require a VERIFIED email before joining: the invite is addressed to an email,
  // so the accepting account must prove it controls that mailbox — otherwise an
  // attacker who signed up with (but never verified) the invited address could
  // claim the seat. Mirrors the app-wide email-verification gate.
  if (!user.emailVerifiedAt) {
    return NextResponse.json({ error: "Verify your email before accepting an invitation." }, { status: 403 });
  }

  let result: { workspaceId: string; role: string };
  try {
    result = await acceptWorkspaceInvitation({ invite: inv, userId: session.userId, request });
  } catch (e) {
    if (e instanceof AcceptInviteError) {
      switch (e.code) {
        case "WORKSPACE_NOT_FOUND":
          return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
        case "SEAT_FULL":
          return NextResponse.json({ error: "Workspace is at its seat limit." }, { status: 409 });
        case "RETRY":
          return NextResponse.json({ error: "Please try again." }, { status: 409 });
        case "ALREADY_MEMBER":
          return NextResponse.json({ error: "You are already a member of this workspace." }, { status: 409 });
      }
    }
    throw e;
  }

  const response = NextResponse.json({ workspaceId: result.workspaceId, role: result.role });
  response.cookies.set("lf_workspace_id", result.workspaceId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

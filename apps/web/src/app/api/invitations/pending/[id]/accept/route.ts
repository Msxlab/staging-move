import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { AcceptInviteError, acceptWorkspaceInvitation } from "@/lib/workspace-invite-accept";

export const runtime = "nodejs";

/**
 * POST /api/invitations/pending/[id]/accept — accept an invitation in-app, by
 * its id, without the raw email token.
 *
 * The email match is the authorization boundary: the invite is only accepted if
 * its `invitedEmail` matches the CALLER's account email (case-insensitive). If
 * the invite doesn't exist OR is addressed to someone else, we return 404 so we
 * never confirm the existence of another user's invitation. PENDING/expiry
 * checks reuse the token route's semantics; the join itself runs through the
 * shared acceptWorkspaceInvitation helper for identical behavior.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    const email = user.email.trim().toLowerCase();

    const invite = await prisma.workspaceInvitation.findUnique({ where: { id } });
    // 404 (not 403) when the invite is missing OR addressed to a different
    // email — never confirm the existence of someone else's invitation.
    if (!invite || invite.invitedEmail.toLowerCase() !== email) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }
    if (invite.status !== "PENDING") {
      return NextResponse.json({ error: "Invitation not available." }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invitation expired." }, { status: 410 });
    }

    let result: { workspaceId: string; role: string };
    try {
      result = await acceptWorkspaceInvitation({ invite, userId, request });
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
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to accept invitation:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}

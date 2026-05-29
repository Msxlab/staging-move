import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { hashInvitationToken } from "@/lib/workspace-invitations";

export const runtime = "nodejs";

/**
 * GET /api/invitations/[token] — validate an invite for the landing page.
 * `requiresSignup` tells the UI whether the invited email needs an account.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const { token } = await params;

  const inv = await prisma.workspaceInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) } });
  if (!inv) return NextResponse.json({ error: "Invalid invitation." }, { status: 404 });
  if (inv.status === "REVOKED") return NextResponse.json({ error: "This invitation was revoked." }, { status: 410 });
  if (inv.status === "ACCEPTED") return NextResponse.json({ error: "This invitation was already used." }, { status: 410 });
  if (inv.expiresAt < new Date()) return NextResponse.json({ error: "This invitation expired." }, { status: 410 });

  const [workspace, existingUser] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: inv.workspaceId }, select: { name: true } }),
    prisma.user.findUnique({ where: { email: inv.invitedEmail }, select: { id: true } }),
  ]);

  return NextResponse.json(
    {
      workspaceName: workspace?.name ?? null,
      invitedEmail: inv.invitedEmail,
      role: inv.role,
      expiresAt: inv.expiresAt,
      requiresSignup: !existingUser,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

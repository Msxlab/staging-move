import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/**
 * GET /api/invitations/pending — list the caller's actionable invitations.
 *
 * Returns PENDING, non-expired invitations whose `invitedEmail` matches the
 * caller's account email CASE-INSENSITIVELY. The email match is the
 * authorization boundary: a user must only ever see invitations addressed to
 * their OWN account email. REVOKED/ACCEPTED and expired invites are excluded.
 *
 * NEVER returns a token or tokenHash — the raw token is not stored and the hash
 * must never leave the server. The id is the handle the in-app accept/decline
 * routes use instead.
 */
export async function GET() {
  const off = await workspaceFeatureGate();
  if (off) return off;
  try {
    const userId = await requireDbUserId();

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return NextResponse.json([]);
    // invitedEmail is stored lowercased + trimmed; lowercase the caller's email
    // so the match is case-insensitive regardless of stored casing.
    const email = user.email.trim().toLowerCase();

    const now = new Date();
    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        invitedEmail: email,
        status: "PENDING",
        expiresAt: { gte: now },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        role: true,
        expiresAt: true,
        workspace: { select: { name: true } },
        invitedByUserId: true,
      },
    });

    // Resolve inviter display names in one batch.
    const inviterIds = Array.from(new Set(invitations.map((inv) => inv.invitedByUserId).filter(Boolean)));
    const inviters = inviterIds.length
      ? await prisma.user.findMany({
          where: { id: { in: inviterIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const inviterNameById = new Map(
      inviters.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || null] as const),
    );

    return NextResponse.json(
      invitations.map((inv) => ({
        id: inv.id,
        workspaceName: inv.workspace?.name ?? null,
        inviterName: inviterNameById.get(inv.invitedByUserId) ?? null,
        role: inv.role,
        expiresAt: inv.expiresAt,
      })),
    );
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to list pending invitations:", error);
    return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 });
  }
}

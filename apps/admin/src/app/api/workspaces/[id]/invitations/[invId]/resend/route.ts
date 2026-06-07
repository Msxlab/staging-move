import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";
import { sendWorkspaceInvitationEmail } from "@/lib/email";
import { maskEmail } from "@/lib/privacy";

export const runtime = "nodejs";

// Invitation token format is the single source of truth in
// apps/web/src/lib/workspace-invitations.ts: `wsi_` + base64url(32 bytes),
// stored only as sha256(token). The admin app is a separate build and can't
// import that helper, so the identical scheme is reproduced here. The web
// accept route hashes the plaintext from the URL the same way, so a token
// regenerated here is accepted there.
const TOKEN_PREFIX = "wsi_";
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
  CHILD: "Child",
  VIEW_ONLY: "View only",
};

function generateInvitationToken(): { token: string; tokenHash: string; tokenLast4: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash, tokenLast4: token.slice(-4) };
}

function appBaseUrl(configured: string | null): string {
  const base = configured || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

/**
 * POST /api/workspaces/:id/invitations/:invId/resend — resend a pending invite.
 *
 * Regenerates the invitation token + expiry (so the old link is invalidated and
 * a fresh 7-day window starts), then re-sends the invitation email. Only PENDING
 * invitations can be resent. users:canUpdate (ADMIN floor); step-up; audited.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invId: string }> },
) {
  try {
    const session = await requirePermission("users", "canUpdate", { minimumRole: "ADMIN" });
    const { id, invId } = await params;
    const requestMeta = getAuditRequestMeta(request);

    let confirmPassword: string | undefined;
    let mfaCode: string | undefined;
    let backupCode: string | undefined;
    try {
      const body = await request.json();
      confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined;
      mfaCode = typeof body?.mfaCode === "string" ? body.mfaCode : undefined;
      backupCode = typeof body?.backupCode === "string" ? body.backupCode : undefined;
    } catch {
      /* no body — confirm fails below */
    }

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "workspace_invitation_resend",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "WORKSPACE_INVITATION_RESEND_FAILED",
        entityType: "workspace_invitation",
        entityId: invId,
        metadata: {
          operation: "workspace_invitation_resend",
          status: "failed",
          reason: "step_up_failed",
          workspaceId: id,
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const inv = await prisma.workspaceInvitation.findFirst({
      where: { id: invId, workspaceId: id },
      select: {
        id: true,
        invitedEmail: true,
        role: true,
        status: true,
        workspace: { select: { name: true } },
      },
    });
    if (!inv) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    if (inv.status !== "PENDING") {
      return NextResponse.json({ error: "Only a pending invitation can be resent." }, { status: 409 });
    }

    const { token, tokenHash, tokenLast4 } = generateInvitationToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const updated = await prisma.workspaceInvitation.update({
      where: { id: invId },
      data: { tokenHash, tokenLast4, expiresAt },
      select: { id: true, invitedEmail: true, role: true, status: true, expiresAt: true, tokenLast4: true, createdAt: true },
    });

    const appUrl = appBaseUrl(await getAdminRuntimeConfigValue("NEXT_PUBLIC_APP_URL"));
    const acceptUrl = `${appUrl}/invitations/${token}`;
    // Localize the invite to the invited user's preferred language when they
    // already have an account; new invitees (no User row) fall back to EN.
    const invitedUser = await prisma.user.findUnique({
      where: { email: updated.invitedEmail },
      select: { preferredLocale: true },
    });
    const emailSent = await sendWorkspaceInvitationEmail({
      invitedEmail: updated.invitedEmail,
      workspaceName: inv.workspace?.name || "your workspace",
      roleLabel: ROLE_LABELS[updated.role] ?? updated.role,
      acceptUrl,
      expiresAt: updated.expiresAt,
      locale: invitedUser?.preferredLocale ?? null,
    }).catch(() => false);

    await writeAdminAudit(session, {
      action: "WORKSPACE_INVITATION_RESENT",
      entityType: "workspace_invitation",
      entityId: invId,
      metadata: {
        operation: "workspace_invitation_resend",
        status: "success",
        workspaceId: id,
        maskedEmail: maskEmail(updated.invitedEmail),
        emailSent,
        expiresAt: updated.expiresAt,
      },
      request: requestMeta,
    });

    return NextResponse.json({
      invitation: {
        id: updated.id,
        email: maskEmail(updated.invitedEmail),
        role: updated.role,
        status: updated.status,
        expiresAt: updated.expiresAt,
        createdAt: updated.createdAt,
      },
      emailSent,
      // In dev with no email provider configured the send logs as failed; surface
      // the regenerated link so an operator can still deliver it out of band.
      ...(process.env.NODE_ENV !== "production" && !emailSent ? { devInviteUrl: acceptUrl } : {}),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Workspace invitation resend failed:", error);
    return NextResponse.json({ error: "Failed to resend invitation" }, { status: 500 });
  }
}

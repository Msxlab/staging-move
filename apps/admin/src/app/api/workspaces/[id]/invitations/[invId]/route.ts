import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { maskEmail } from "@/lib/privacy";

export const runtime = "nodejs";

/**
 * DELETE /api/workspaces/:id/invitations/:invId — revoke a pending invitation.
 *
 * Admin mirror of the user-session web route. A PENDING invite transitions to
 * REVOKED; an already-ACCEPTED invite is rejected with 409 (the person is a
 * member now — remove them instead). `revokedByUserId` is left null because the
 * actor is an admin, not a workspace user (the column is a plain VarChar with no
 * FK, but storing an admin id there would be misleading); the acting admin is
 * captured in the audit log instead. users:canUpdate (ADMIN floor); step-up.
 */
export async function DELETE(
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
      operation: "workspace_invitation_revoke",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "WORKSPACE_INVITATION_REVOKE_FAILED",
        entityType: "workspace_invitation",
        entityId: invId,
        metadata: {
          operation: "workspace_invitation_revoke",
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
      select: { id: true, invitedEmail: true, role: true, status: true },
    });
    if (!inv) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    if (inv.status === "ACCEPTED") {
      return NextResponse.json({ error: "This invitation was already accepted." }, { status: 409 });
    }
    if (inv.status !== "PENDING") {
      return NextResponse.json({ error: "This invitation is no longer pending." }, { status: 409 });
    }

    await prisma.workspaceInvitation.update({
      where: { id: invId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    await writeAdminAudit(session, {
      action: "WORKSPACE_INVITATION_REVOKED",
      entityType: "workspace_invitation",
      entityId: invId,
      before: { status: inv.status, role: inv.role, maskedEmail: maskEmail(inv.invitedEmail) },
      metadata: {
        operation: "workspace_invitation_revoke",
        status: "success",
        workspaceId: id,
        maskedEmail: maskEmail(inv.invitedEmail),
      },
      request: requestMeta,
    });

    return NextResponse.json({ revoked: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Workspace invitation revoke failed:", error);
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
  }
}

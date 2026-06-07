import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { maskEmail } from "@/lib/privacy";
import { reconcileWorkspaceSeats } from "@/lib/workspace-seats";

export const runtime = "nodejs";

/**
 * POST /api/workspaces/:id/transfer-ownership — transfer ownership of a
 * workspace to one of its ACTIVE members.
 *
 * This is the admin repair path for orphaned-owner households: a workspace whose
 * OWNER is deleted/inactive (so the household can no longer be self-administered
 * by its members) can have ownership moved to a healthy member. It is the admin
 * analogue of the forced ownership transfer that hard-delete-user.ts performs
 * inline (pickOwnershipHeir / transferWorkspaceOwnership on rawPrisma), but here
 * the heir is CHOSEN by the operator rather than auto-picked.
 *
 * In a single transaction:
 *   1. demote the current OWNER membership → ADMIN (if a membership row exists),
 *   2. promote the chosen ACTIVE member → OWNER,
 *   3. repoint Workspace.ownerUserId to the chosen member's userId.
 * Then reconcile seats OUTSIDE the tx — the new owner is the billing anchor and
 * their plan may carry a different seat limit than the old owner's.
 *
 * Authority is the admin permission system (users:canUpdate, ADMIN floor) rather
 * than a caller's workspace membership. Step-up confirmed (password + MFA);
 * audited as WORKSPACE_OWNERSHIP_TRANSFERRED with before/after owner snapshots.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("users", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const requestMeta = getAuditRequestMeta(request);

    let confirmPassword: string | undefined;
    let mfaCode: string | undefined;
    let backupCode: string | undefined;
    let newOwnerMemberId = "";
    try {
      const body = await request.json();
      confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined;
      mfaCode = typeof body?.mfaCode === "string" ? body.mfaCode : undefined;
      backupCode = typeof body?.backupCode === "string" ? body.backupCode : undefined;
      newOwnerMemberId = typeof body?.memberId === "string" ? body.memberId : "";
    } catch {
      /* no body — confirm fails below */
    }

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "workspace_ownership_transfer",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "WORKSPACE_OWNERSHIP_TRANSFER_FAILED",
        entityType: "workspace",
        entityId: id,
        metadata: {
          operation: "workspace_ownership_transfer",
          status: "failed",
          reason: "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    if (!newOwnerMemberId) {
      return NextResponse.json({ error: "Choose a member to promote to owner." }, { status: 422 });
    }

    // Load the workspace + the chosen heir together. Soft-deleted workspaces
    // are excluded by the extended client; that is intentional — there is no
    // point transferring ownership of a deleted household.
    const ws = await prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        ownerUserId: true,
        owner: { select: { id: true, email: true } },
      },
    });
    if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const heir = await prisma.workspaceMember.findFirst({
      where: { id: newOwnerMemberId, workspaceId: id },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        user: { select: { email: true } },
      },
    });
    if (!heir) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (heir.role === "OWNER" || heir.userId === ws.ownerUserId) {
      return NextResponse.json({ error: "That member is already the owner." }, { status: 409 });
    }
    if (heir.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only an active member can be promoted to owner." },
        { status: 409 },
      );
    }

    // The current OWNER membership row, if one still exists (an orphaned-owner
    // workspace may have ownerUserId pointing at a user whose membership row is
    // already gone — in that case there is simply nothing to demote).
    const currentOwnerMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: id, role: "OWNER" },
      select: { id: true, userId: true },
    });

    await prisma.$transaction(async (tx) => {
      if (currentOwnerMember) {
        await tx.workspaceMember.update({
          where: { id: currentOwnerMember.id },
          data: { role: "ADMIN" },
        });
      }
      await tx.workspaceMember.update({
        where: { id: heir.id },
        data: { role: "OWNER" },
      });
      await tx.workspace.update({
        where: { id },
        data: { ownerUserId: heir.userId },
      });
    });

    // New owner is the billing anchor — their plan's seat limit may differ from
    // the old owner's, so reconcile overflow/restore. Best-effort; never fail
    // the (already-committed) transfer on a reconcile error.
    const reconciled = await reconcileWorkspaceSeats(id).catch(() => ({ overflowed: 0, restored: 0 }));

    await writeAdminAudit(session, {
      action: "WORKSPACE_OWNERSHIP_TRANSFERRED",
      entityType: "workspace",
      entityId: id,
      before: {
        ownerUserId: ws.ownerUserId,
        ownerMaskedEmail: ws.owner?.email ? maskEmail(ws.owner.email) : null,
      },
      after: {
        ownerUserId: heir.userId,
        ownerMaskedEmail: heir.user?.email ? maskEmail(heir.user.email) : null,
        previousRole: heir.role,
      },
      metadata: {
        operation: "workspace_ownership_transfer",
        status: "success",
        fromUserId: ws.ownerUserId,
        toUserId: heir.userId,
        toMemberId: heir.id,
        demotedPreviousOwner: Boolean(currentOwnerMember),
        seatsOverflowed: reconciled.overflowed,
        seatsRestored: reconciled.restored,
      },
      request: requestMeta,
    });

    return NextResponse.json({
      transferred: true,
      newOwnerUserId: heir.userId,
      newOwnerMemberId: heir.id,
      seatsOverflowed: reconciled.overflowed,
      seatsRestored: reconciled.restored,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Workspace ownership transfer failed:", error);
    return NextResponse.json({ error: "Failed to transfer ownership" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { maskEmail } from "@/lib/privacy";
import { reconcileWorkspaceSeats } from "@/lib/workspace-seats";

export const runtime = "nodejs";

// Mirrors apps/web .../members/[memberId] ASSIGNABLE_ROLES. OWNER is never an
// assignable target — ownership moves through transfer, not a role change, and
// the admin surface deliberately does not expose transfer (deferred).
const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER", "CHILD", "VIEW_ONLY"] as const;

/** Snapshot of a member row for the audit before/after diff. */
function memberSnapshot(
  m: { id: string; userId: string; role: string; status: string } | null,
  email: string | null | undefined,
) {
  if (!m) return null;
  return {
    memberId: m.id,
    userId: m.userId,
    role: m.role,
    status: m.status,
    maskedEmail: email ? maskEmail(email) : null,
  };
}

async function loadMember(workspaceId: string, memberId: string) {
  return prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      user: { select: { email: true } },
    },
  });
}

/**
 * PATCH /api/workspaces/:id/members/:memberId — change a member's role.
 *
 * Admin mirror of the user-session web route. Authority comes from the admin
 * permission system (users:canUpdate, ADMIN floor) rather than a caller's
 * workspace membership, so the per-role `can()` matrix is replaced by the two
 * invariants that always hold: target may never be OWNER, and the new role must
 * be one of the assignable (non-OWNER) roles. Step-up confirmed; audited.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const session = await requirePermission("users", "canUpdate", { minimumRole: "ADMIN" });
    const { id, memberId } = await params;
    const requestMeta = getAuditRequestMeta(request);

    let confirmPassword: string | undefined;
    let mfaCode: string | undefined;
    let backupCode: string | undefined;
    let newRole = "";
    try {
      const body = await request.json();
      confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined;
      mfaCode = typeof body?.mfaCode === "string" ? body.mfaCode : undefined;
      backupCode = typeof body?.backupCode === "string" ? body.backupCode : undefined;
      newRole = typeof body?.role === "string" ? body.role : "";
    } catch {
      /* no body — confirm fails below */
    }

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "workspace_member_role_change",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "WORKSPACE_MEMBER_ROLE_CHANGE_FAILED",
        entityType: "workspace_member",
        entityId: memberId,
        metadata: {
          operation: "workspace_member_role_change",
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

    if (!ASSIGNABLE_ROLES.includes(newRole as (typeof ASSIGNABLE_ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 422 });
    }

    const target = await loadMember(id, memberId);
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (target.role === "OWNER") {
      return NextResponse.json({ error: "The owner's role can't be changed here." }, { status: 409 });
    }
    if (target.role === newRole) {
      // No-op — return current state so the client can refresh without churn.
      return NextResponse.json({ id: target.id, role: target.role });
    }

    const before = memberSnapshot(target, target.user?.email);
    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: newRole },
      select: { id: true, userId: true, role: true, status: true },
    });

    await writeAdminAudit(session, {
      action: "WORKSPACE_MEMBER_ROLE_CHANGED",
      entityType: "workspace_member",
      entityId: memberId,
      before,
      after: memberSnapshot(updated, target.user?.email),
      metadata: {
        operation: "workspace_member_role_change",
        status: "success",
        workspaceId: id,
        fromRole: target.role,
        toRole: updated.role,
      },
      request: requestMeta,
    });

    return NextResponse.json({ id: updated.id, role: updated.role });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Workspace member role change failed:", error);
    return NextResponse.json({ error: "Failed to change member role" }, { status: 500 });
  }
}

/**
 * DELETE /api/workspaces/:id/members/:memberId — remove a member.
 *
 * Deletes the membership row only; the member's domain data (Address/Service
 * carrying this workspaceId) stays with the workspace, mirroring the web route.
 * Removing a non-suspended member frees a seat, so we reconcile overflow members
 * afterwards. OWNER can never be removed from this surface (use transfer first,
 * which is deferred for admin). Step-up confirmed; audited.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const session = await requirePermission("users", "canUpdate", { minimumRole: "ADMIN" });
    const { id, memberId } = await params;
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
      operation: "workspace_member_remove",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "WORKSPACE_MEMBER_REMOVE_FAILED",
        entityType: "workspace_member",
        entityId: memberId,
        metadata: {
          operation: "workspace_member_remove",
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

    const target = await loadMember(id, memberId);
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (target.role === "OWNER") {
      return NextResponse.json({ error: "The owner can't be removed. Transfer ownership first." }, { status: 409 });
    }

    const before = memberSnapshot(target, target.user?.email);
    await prisma.workspaceMember.delete({ where: { id: memberId } });

    // Removing a non-suspended member frees a seat — restore an OVERFLOW member
    // if one is waiting. Best-effort; never fail the removal on a reconcile error.
    const reconciled = await reconcileWorkspaceSeats(id).catch(() => ({ overflowed: 0, restored: 0 }));

    await writeAdminAudit(session, {
      action: "WORKSPACE_MEMBER_REMOVED",
      entityType: "workspace_member",
      entityId: memberId,
      before,
      metadata: {
        operation: "workspace_member_remove",
        status: "success",
        workspaceId: id,
        removedUserId: target.userId,
        seatsRestored: reconciled.restored,
      },
      request: requestMeta,
    });

    return NextResponse.json({ removed: true, seatsRestored: reconciled.restored });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Workspace member remove failed:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}

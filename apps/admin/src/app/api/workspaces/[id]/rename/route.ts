import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

export const runtime = "nodejs";

// Workspace.name is VarChar(120) in the schema; the web rename route caps at
// 120 too. Mirror that ceiling.
const MAX_NAME_LENGTH = 120;

/**
 * PATCH /api/workspaces/:id/rename — rename a workspace.
 *
 * Admin mirror of the user-session web route (which is owner-only). On the admin
 * surface the authority is the admin permission system (users:canUpdate, ADMIN
 * floor) rather than workspace ownership. Soft-deleted workspaces can't be
 * renamed. Step-up confirmed; audited with before/after names.
 */
export async function PATCH(
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
    let name = "";
    try {
      const body = await request.json();
      confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined;
      mfaCode = typeof body?.mfaCode === "string" ? body.mfaCode : undefined;
      backupCode = typeof body?.backupCode === "string" ? body.backupCode : undefined;
      name = typeof body?.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
    } catch {
      /* no body — confirm fails below */
    }

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "workspace_rename",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "WORKSPACE_RENAME_FAILED",
        entityType: "workspace",
        entityId: id,
        metadata: {
          operation: "workspace_rename",
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

    if (!name) return NextResponse.json({ error: "A workspace name is required." }, { status: 422 });

    const existing = await prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!existing) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    if (existing.name === name) {
      // No-op — return current state so the client can refresh without churn.
      return NextResponse.json({ id: existing.id, name: existing.name });
    }

    const res = await prisma.workspace.updateMany({
      where: { id, deletedAt: null },
      data: { name },
    });
    if (res.count === 0) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    await writeAdminAudit(session, {
      action: "WORKSPACE_RENAMED",
      entityType: "workspace",
      entityId: id,
      before: { name: existing.name },
      after: { name },
      metadata: { operation: "workspace_rename", status: "success" },
      request: requestMeta,
    });

    return NextResponse.json({ id, name });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Workspace rename failed:", error);
    return NextResponse.json({ error: "Failed to rename workspace" }, { status: 500 });
  }
}

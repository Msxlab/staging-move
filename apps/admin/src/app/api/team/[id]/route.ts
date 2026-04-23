import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin_users", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json();

    const admin = await prisma.adminUser.findUnique({ where: { id } });
    if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

    // Role/password/activation changes require SUPER_ADMIN
    const isSensitiveChange = body.role !== undefined || body.newPassword !== undefined || body.isActive !== undefined;
    if (isSensitiveChange && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only SUPER_ADMIN can change roles, passwords, or activation status" }, { status: 403 });
    }

    // Prevent self-promotion
    if (body.role !== undefined && id === session.adminId) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }

    // Prevent editing higher-role admins
    const roleHierarchy: Record<string, number> = { VIEWER: 0, MODERATOR: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    if ((roleHierarchy[admin.role] ?? 0) >= (roleHierarchy[session.role] ?? 0)) {
      return NextResponse.json({ error: "Cannot edit an admin with equal or higher role" }, { status: 403 });
    }

    const data: any = {};
    if (body.firstName !== undefined) data.firstName = body.firstName;
    if (body.lastName !== undefined) data.lastName = body.lastName;
    if (body.email !== undefined) data.email = body.email;
    if (body.role !== undefined) data.role = body.role;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.newPassword) data.password = await bcrypt.hash(body.newPassword, 12);

    const updated = await prisma.adminUser.update({ where: { id }, data });
    let revokedSessions = 0;
    if (isSensitiveChange) {
      const revokeResult = await prisma.adminSession.updateMany({
        where: { adminUserId: id, isActive: true },
        data: { isActive: false, lastActivity: new Date() },
      });
      revokedSessions = revokeResult.count;
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE_ADMIN",
        entityType: "AdminUser",
        entityId: id,
        changes: JSON.stringify({
          fields: Object.keys(data),
          revokedSessions,
          previousRole: admin.role,
          newRole: updated.role,
          previousActive: admin.isActive,
          newActive: updated.isActive,
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ admin: { id: updated.id, email: updated.email, firstName: updated.firstName, lastName: updated.lastName, role: updated.role, isActive: updated.isActive } });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED" || error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update admin" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin_users", "canDelete", { minimumRole: "SUPER_ADMIN" });
    const { id } = await params;

    if (id === session.adminId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    // Step-up auth: deleting a team member wipes their audit trail.
    let confirmPassword: string | undefined;
    try {
      const body = await request.json();
      confirmPassword = body?.confirmPassword;
    } catch {
      /* empty body — the 403 below triggers the password prompt */
    }
    const confirm = await requirePasswordConfirm(session, confirmPassword);
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true },
        { status: 403 },
      );
    }

    await prisma.adminPermission.deleteMany({ where: { adminUserId: id } });
    await prisma.adminAuditLog.deleteMany({ where: { adminUserId: id } });
    await prisma.adminUser.delete({ where: { id } });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "DELETE_ADMIN",
        entityType: "AdminUser",
        entityId: id,
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED" || error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to delete admin" }, { status: 500 });
  }
}

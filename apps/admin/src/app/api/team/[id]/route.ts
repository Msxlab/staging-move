import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import {
  ADMIN_RESOURCES,
  ADMIN_ROLE_VALUES,
  buildDefaultPermissionMatrix,
  isValidAdminRole,
} from "@/lib/admin-permissions";

// Strict update body. `permissions` is normalized after parsing so we
// can keep the existing matrix-shape validator. Unknown role strings get
// a 400 instead of being silently inserted into AdminUser.role.
const updateAdminSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().min(3).max(254).email().optional(),
    role: z.enum(ADMIN_ROLE_VALUES).optional(),
    isActive: z.boolean().optional(),
    newPassword: z.string().min(12).max(256).optional(),
    confirmPassword: z.string().max(256).optional(),
    permissions: z.array(z.unknown()).max(64).optional(),
  })
  .strict();

function normalizePermissionMatrix(input: unknown) {
  if (!Array.isArray(input)) return null;

  const normalized = input
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      resource:
        typeof row.resource === "string" &&
        (ADMIN_RESOURCES as readonly string[]).includes(row.resource)
          ? row.resource
          : null,
      canRead: Boolean(row.canRead),
      canCreate: Boolean(row.canCreate),
      canUpdate: Boolean(row.canUpdate),
      canDelete: Boolean(row.canDelete),
    }))
    .filter((row): row is {
      resource: string;
      canRead: boolean;
      canCreate: boolean;
      canUpdate: boolean;
      canDelete: boolean;
    } => Boolean(row.resource));

  if (normalized.length !== ADMIN_RESOURCES.length) return null;
  return normalized;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin_users", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const raw = await request.json().catch(() => null);
    const parsed = updateAdminSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join(".") || "body";
      if (field === "role") {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${ADMIN_ROLE_VALUES.join(", ")}` },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: `Invalid request: ${issue?.message || "validation failed"}` },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const admin = await prisma.adminUser.findUnique({ where: { id } });
    if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

    // Role/password/activation changes require SUPER_ADMIN
    const isSensitiveChange =
      body.role !== undefined ||
      body.newPassword !== undefined ||
      body.isActive !== undefined ||
      body.permissions !== undefined;
    if (isSensitiveChange && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only SUPER_ADMIN can change roles, passwords, activation status, or permissions" }, { status: 403 });
    }
    if (isSensitiveChange) {
      const confirm = await requirePasswordConfirm(
        session,
        typeof body.confirmPassword === "string" ? body.confirmPassword : undefined,
        { operation: "admin_user_sensitive_update" },
      );
      if (!confirm.confirmed) {
        return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
      }
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

    let permissionMode: "unchanged" | "default_reset" | "custom" = "unchanged";
    let nextPermissions = normalizePermissionMatrix(body.permissions);
    if (body.permissions !== undefined && !nextPermissions) {
      return NextResponse.json({ error: "Invalid permission matrix" }, { status: 400 });
    }
    if (body.role !== undefined && !nextPermissions) {
      nextPermissions = buildDefaultPermissionMatrix(body.role);
      permissionMode = "default_reset";
    } else if (nextPermissions) {
      permissionMode = "custom";
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const adminUser = await tx.adminUser.update({ where: { id }, data });
      if (nextPermissions) {
        await tx.adminPermission.deleteMany({ where: { adminUserId: id } });
        await tx.adminPermission.createMany({
          data: nextPermissions.map((permission) => ({
            adminUserId: id,
            resource: permission.resource,
            canRead: permission.canRead,
            canCreate: permission.canCreate,
            canUpdate: permission.canUpdate,
            canDelete: permission.canDelete,
          })),
        });
      }
      return adminUser;
    });
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
          permissionMode,
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

    const admin = await prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const roleHierarchy: Record<string, number> = {
      VIEWER: 0,
      MODERATOR: 1,
      ADMIN: 2,
      SUPER_ADMIN: 3,
    };
    if ((roleHierarchy[admin.role] ?? 0) >= (roleHierarchy[session.role] ?? 0)) {
      return NextResponse.json({ error: "Cannot archive an admin with equal or higher role" }, { status: 403 });
    }

    // Step-up auth: archival is destructive and revokes every active session.
    let confirmPassword: string | undefined;
    try {
      const body = await request.json();
      confirmPassword = body?.confirmPassword;
    } catch {
      /* empty body — the 403 below triggers the password prompt */
    }
    const confirm = await requirePasswordConfirm(session, confirmPassword, { operation: "admin_user_delete" });
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true },
        { status: 403 },
      );
    }

    const archivedEmail = `archived+${Date.now()}+${id}@invalid.locateflow`;
    const archivedPassword = await bcrypt.hash(
      randomBytes(32).toString("hex"),
      12,
    );

    await prisma.$transaction(async (tx: any) => {
      await tx.adminPermission.deleteMany({ where: { adminUserId: id } });
      await tx.adminSession.updateMany({
        where: { adminUserId: id, isActive: true },
        data: { isActive: false, lastActivity: new Date() },
      });
      await tx.adminUser.update({
        where: { id },
        data: {
          email: archivedEmail,
          firstName: "Archived",
          lastName: "Admin",
          password: archivedPassword,
          role: "VIEWER",
          isActive: false,
          mfaEnabled: false,
          mfaSecret: null,
          mfaVerifiedAt: null,
          mfaBackupCodes: null,
        },
      });
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "ARCHIVE_ADMIN",
        entityType: "AdminUser",
        entityId: id,
        changes: JSON.stringify({
          previousEmail: admin.email,
          archivedEmail,
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true, archived: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED" || error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to delete admin" }, { status: 500 });
  }
}

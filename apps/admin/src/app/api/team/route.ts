import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { buildDefaultPermissionMatrix } from "@/lib/admin-permissions";

export async function GET() {
  try {
    await requirePermission("admin_users", "canRead", { minimumRole: "ADMIN" });

    const admins = await prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        permissions: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ admins });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED" || error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("admin_users", "canCreate", { minimumRole: "SUPER_ADMIN" });
    const body = await request.json();

    if (!body.email || !body.password || !body.firstName || !body.lastName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // SEC-009: Strong password policy for new admin accounts
    if (body.password.length < 12) {
      return NextResponse.json({ error: "Password must be at least 12 characters" }, { status: 400 });
    }
    if (!/[A-Z]/.test(body.password) || !/[a-z]/.test(body.password) || !/[0-9]/.test(body.password)) {
      return NextResponse.json({ error: "Password must contain uppercase, lowercase, and a number" }, { status: 400 });
    }

    const existing = await prisma.adminUser.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);

    const admin = await prisma.adminUser.create({
      data: {
        email: body.email,
        password: hashedPassword,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role || "MODERATOR",
        isActive: true,
        createdBy: session.adminId,
      },
    });

    // Persist the role's default permission matrix. Shared helper is
    // the single source of truth — see apps/admin/src/lib/admin-permissions.ts.
    const matrix = buildDefaultPermissionMatrix(admin.role);
    await prisma.adminPermission.createMany({
      data: matrix.map((row) => ({
        adminUserId: admin.id,
        resource: row.resource,
        canRead: row.canRead,
        canCreate: row.canCreate,
        canUpdate: row.canUpdate,
        canDelete: row.canDelete,
      })),
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE_ADMIN",
        entityType: "AdminUser",
        entityId: admin.id,
        changes: JSON.stringify({ email: admin.email, role: admin.role }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({
      admin: { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName, role: admin.role },
    }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED" || error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Failed to create admin:", error);
    return NextResponse.json({ error: "Failed to create admin" }, { status: 500 });
  }
}

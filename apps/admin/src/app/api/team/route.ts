import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import {
  ADMIN_ROLE_VALUES,
  buildDefaultPermissionMatrix,
} from "@/lib/admin-permissions";

// Strict body shape for admin creation. Role is a closed enum — unknown
// strings (typos, deprecated roles, attacker-supplied junk) get a 400
// instead of being silently coerced into a permission matrix that may
// not have a valid hierarchy entry.
const createAdminSchema = z
  .object({
    email: z.string().trim().min(3).max(254).email(),
    password: z.string().min(12).max(256),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    role: z.enum(ADMIN_ROLE_VALUES).default("MODERATOR"),
    // confirmPassword is optional at the schema layer — the missing
    // case is what triggers the 403 step-up prompt, not a 400 from zod.
    confirmPassword: z.string().max(256).optional(),
  })
  .strict();

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
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        permissions: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const [activeSessions, recentLoginStats] = await Promise.all([
      prisma.adminSession.groupBy({
        by: ["adminUserId"],
        where: {
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        _count: { _all: true },
      }),
      prisma.adminLoginLog.groupBy({
        by: ["adminUserId", "success"],
        where: {
          adminUserId: { not: null },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        _count: { _all: true },
      }),
    ]);

    const activeSessionMap = new Map(
      activeSessions.map((row: any) => [row.adminUserId, row._count._all]),
    );
    const loginStatMap = new Map<
      string,
      { recentSuccessfulLogins: number; recentFailedLogins: number }
    >();
    for (const row of recentLoginStats) {
      if (!row.adminUserId) continue;
      const current = loginStatMap.get(row.adminUserId) || {
        recentSuccessfulLogins: 0,
        recentFailedLogins: 0,
      };
      if (row.success) {
        current.recentSuccessfulLogins = row._count._all;
      } else {
        current.recentFailedLogins = row._count._all;
      }
      loginStatMap.set(row.adminUserId, current);
    }

    return NextResponse.json({
      admins: admins.map((admin: any) => ({
        ...admin,
        activeSessionCount: activeSessionMap.get(admin.id) || 0,
        recentSuccessfulLogins:
          loginStatMap.get(admin.id)?.recentSuccessfulLogins || 0,
        recentFailedLogins:
          loginStatMap.get(admin.id)?.recentFailedLogins || 0,
      })),
    });
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
    const raw = await request.json().catch(() => null);
    const parsed = createAdminSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join(".") || "body";
      // Friendly errors for the most common validation failures.
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

    const confirm = await requirePasswordConfirm(session, body.confirmPassword, {
      operation: "admin_user_create",
    });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    // SEC-009: complexity requirement is separate from zod min(12) so we
    // can surface it as a discrete error.
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
        role: body.role,
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

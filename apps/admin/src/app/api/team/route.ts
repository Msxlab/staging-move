import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { issueSetPasswordToken } from "@/lib/admin-invite";
import { sendAdminInviteEmail } from "@/lib/email";
import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";
import {
  ADMIN_ROLE_VALUES,
  buildDefaultPermissionMatrix,
} from "@/lib/admin-permissions";

// Strict body shape for admin creation. Role is a closed enum — unknown
// strings (typos, deprecated roles, attacker-supplied junk) get a 400
// instead of being silently coerced into a permission matrix that may
// not have a valid hierarchy entry.
//
// `password` is now OPTIONAL: when omitted the route runs the INVITE flow
// (account seeded in a must-change-password state + emailed a single-use
// set-password link), so a SUPER_ADMIN never has to know the new admin's
// permanent password. When provided, the legacy explicit-password path is
// preserved for back-compat (e.g. scripted seeding).
const createAdminSchema = z
  .object({
    email: z.string().trim().min(3).max(254).email(),
    password: z.string().min(12).max(256).optional(),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    role: z.enum(ADMIN_ROLE_VALUES).default("MODERATOR"),
    // confirmPassword is optional at the schema layer — the missing
    // case is what triggers the 403 step-up prompt, not a 400 from zod.
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  VIEWER: "Viewer",
};

async function resolveAdminAppUrl(): Promise<string> {
  const values = await getAdminRuntimeConfigValues(["ADMIN_APP_URL", "NEXT_PUBLIC_ADMIN_URL"]);
  const configured =
    values.ADMIN_APP_URL ||
    values.NEXT_PUBLIC_ADMIN_URL ||
    process.env.ADMIN_APP_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    "";
  const trimmed = configured.trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  return process.env.NODE_ENV === "production" ? "https://admin.locateflow.com" : "http://localhost:3001";
}

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
    const requestMeta = getAuditRequestMeta(request);

    const confirm = await requirePasswordConfirm(session, body.confirmPassword, {
      operation: "admin_user_create",
      requireMfa: true,
      mfaCode: body.mfaCode,
      backupCode: body.backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "ADMIN_CREATE_FAILED",
        entityType: "AdminUser",
        entityId: "new",
        metadata: {
          operation: "admin_user_create",
          status: "failed",
          reason: "step_up_failed",
          targetRole: body.role,
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json({ error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined }, { status: 403 });
    }

    // INVITE flow when no explicit password is supplied: seed an unguessable
    // random password the operator never learns, flag the account so the
    // login route + page-guard force a password set on first sign-in, and
    // email a single-use set-password link. Explicit-password path (legacy)
    // is preserved when `password` is present.
    const isInvite = !body.password;

    // SEC-009: complexity requirement is separate from zod min(12) so we
    // can surface it as a discrete error. Only enforced on the explicit
    // path — invites generate their own high-entropy seed password.
    if (!isInvite) {
      const pw = body.password as string;
      if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
        return NextResponse.json({ error: "Password must contain uppercase, lowercase, and a number" }, { status: 400 });
      }
    }

    const existing = await prisma.adminUser.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // For invites, the seed password is a random 48-byte secret that is
    // immediately bcrypt-hashed and never returned anywhere — the account is
    // effectively un-loginable until the invitee redeems their token.
    const plaintextPassword = isInvite
      ? randomBytes(48).toString("base64url")
      : (body.password as string);
    const hashedPassword = await bcrypt.hash(plaintextPassword, 12);

    const admin = await prisma.adminUser.create({
      data: {
        email: body.email,
        password: hashedPassword,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        isActive: true,
        mustChangePassword: isInvite,
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

    // Issue + email the single-use set-password link for invited admins.
    let inviteEmailSent: boolean | undefined;
    let inviteExpiresAt: Date | undefined;
    let inviteSetPasswordUrl: string | undefined;
    if (isInvite) {
      const { token, expiresAt } = await issueSetPasswordToken({
        adminUserId: admin.id,
        purpose: "INVITE",
        createdBy: session.adminId,
      });
      inviteExpiresAt = expiresAt;
      const appUrl = await resolveAdminAppUrl();
      const setPasswordUrl = `${appUrl}/set-password?token=${encodeURIComponent(token)}`;
      inviteEmailSent = await sendAdminInviteEmail({
        to: admin.email,
        inviterName: `${session.email}`,
        roleLabel: ROLE_LABELS[admin.role] || admin.role,
        setPasswordUrl,
        expiresAt,
      });
      // In non-production runtimes where email is unconfigured, surface the
      // link so a developer can complete the flow locally. NEVER returned in
      // production (real invitees get the email).
      if (process.env.NODE_ENV !== "production") {
        inviteSetPasswordUrl = setPasswordUrl;
      }
    }

    await writeAdminAudit(session, {
      action: isInvite ? "ADMIN_INVITED" : "ADMIN_CREATED",
      entityType: "AdminUser",
      entityId: admin.id,
      metadata: {
        operation: isInvite ? "admin_user_invite" : "admin_user_create",
        status: "success",
        method: isInvite ? "invite" : "explicit_password",
        targetRole: admin.role,
        emailDomain: admin.email.split("@")[1] || null,
        ...(isInvite
          ? {
              inviteEmailDispatched: inviteEmailSent,
              inviteExpiresAt: inviteExpiresAt?.toISOString() || null,
            }
          : {}),
      },
      request: requestMeta,
    });

    return NextResponse.json({
      admin: { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName, role: admin.role },
      invited: isInvite,
      ...(isInvite
        ? {
            inviteEmailSent: Boolean(inviteEmailSent),
            inviteExpiresAt: inviteExpiresAt?.toISOString(),
            ...(inviteSetPasswordUrl ? { setPasswordUrl: inviteSetPasswordUrl } : {}),
          }
        : {}),
    }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED" || error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Failed to create admin:", error);
    return NextResponse.json({ error: "Failed to create admin" }, { status: 500 });
  }
}

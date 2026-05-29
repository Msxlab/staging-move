import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { expireAdminSessionCookies, requireAdmin, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { currentPassword, newPassword, mfaCode, backupCode } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Both current and new passwords are required" }, { status: 400 });
    }

    // SEC-009: Strong password policy. Validate request shape BEFORE the
    // step-up so a weak new password is rejected without consuming a
    // confirmation / MFA backup code.
    if (newPassword.length < 12) {
      return NextResponse.json({ error: "New password must be at least 12 characters" }, { status: 400 });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json({ error: "Password must contain uppercase, lowercase, and a number" }, { status: 400 });
    }

    // Step-up confirmation: verifies the current password AND, for
    // MFA-enrolled admins, a second factor — the same gate every other
    // sensitive admin mutation uses (requireMfa is a no-op for admins
    // without MFA enrolled, so password-only accounts are unaffected).
    const requestMeta = getAuditRequestMeta(request);
    const confirm = await requirePasswordConfirm(session, currentPassword, {
      operation: "admin_password_change",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      return NextResponse.json(
        {
          error: confirm.error || "Password confirmation required.",
          requiresPassword: true,
          requiresMfa: confirm.requiresMfa || undefined,
          retryAfterSec: confirm.retryAfterSec,
        },
        { status: confirm.rateLimited ? 429 : 403 },
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.adminUser.update({
      where: { id: session.adminId },
      data: { password: hashedPassword },
    });
    await prisma.adminSession.updateMany({
      where: { adminUserId: session.adminId, isActive: true },
      data: { isActive: false, lastActivity: new Date() },
    });

    await writeAdminAudit(session, {
      action: "PASSWORD_CHANGED",
      entityType: "AdminUser",
      entityId: session.adminId,
      metadata: {
        operation: "admin_password_change",
        sessionsRevoked: true,
        mfaUsed: Boolean(mfaCode || backupCode),
      },
      request: requestMeta,
    });

    const response = NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
    return expireAdminSessionCookies(response, request.headers.get("host"));
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Password change failed:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}

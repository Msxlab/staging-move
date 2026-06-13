import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expireAdminSessionCookies, requireAdmin, requirePasswordConfirm } from "@/lib/auth";
import { expireAdminMfaTrustCookie, revokeAdminMfaTrustedDevices } from "@/lib/admin-mfa-trusted-device";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

// POST /api/auth/mfa/disable — disable MFA for current admin
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    // An empty / malformed body must not 500 — treat it as "no credentials
    // supplied" so requirePasswordConfirm returns the 403 step-up prompt
    // (the front-end opens the password/MFA modal on that response) instead
    // of an opaque server error.
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);

    const confirm = await requirePasswordConfirm(session, body.confirmPassword, {
      operation: "admin_mfa_disable",
      requireMfa: true,
      mfaCode: body.mfaCode,
      backupCode: body.backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      return NextResponse.json(
        {
          error: confirm.error,
          requiresPassword: true,
          requiresMfa: confirm.requiresMfa || undefined,
        },
        { status: confirm.rateLimited ? 429 : 403 },
      );
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: { mfaEnabled: true },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (!admin.mfaEnabled) {
      return NextResponse.json({ error: "MFA is not enabled." }, { status: 400 });
    }

    await prisma.adminUser.update({
      where: { id: session.adminId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
        mfaVerifiedAt: null,
      },
    });
    await prisma.adminSession.updateMany({
      where: { adminUserId: session.adminId, isActive: true },
      data: { isActive: false, lastActivity: new Date() },
    });
    await revokeAdminMfaTrustedDevices(session.adminId);

    await writeAdminAudit(session, {
      action: "MFA_DISABLED",
      entityType: "AdminUser",
      entityId: session.adminId,
      metadata: { operation: "admin_mfa_disable", sessionsRevoked: true },
      request: requestMeta,
    });

    const response = NextResponse.json(
      { success: true, message: "MFA has been disabled. Please sign in again." },
      {
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
    expireAdminMfaTrustCookie(response, request.headers.get("host"));
    return expireAdminSessionCookies(response, request.headers.get("host"));
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("MFA disable failed:", error);
    return NextResponse.json({ error: "Failed to disable MFA" }, { status: 500 });
  }
}

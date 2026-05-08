import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requirePasswordConfirm } from "@/lib/auth";

// POST /api/auth/mfa/disable — disable MFA for current admin
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();

    const confirm = await requirePasswordConfirm(session, body.confirmPassword, { operation: "admin_mfa_disable" });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
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

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "MFA_DISABLED",
        entityType: "AdminUser",
        entityId: session.adminId,
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true, message: "MFA has been disabled." });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("MFA disable failed:", error);
    return NextResponse.json({ error: "Failed to disable MFA" }, { status: 500 });
  }
}

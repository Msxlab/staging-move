import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { verifyTOTP } from "@/lib/totp";
import { decrypt } from "@/lib/shared-encryption";

// POST /api/auth/mfa/verify — verify TOTP code to complete MFA setup
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { code } = await request.json();

    if (!code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json({ error: "A valid 6-digit code is required" }, { status: 400 });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!admin || !admin.mfaSecret) {
      return NextResponse.json({ error: "MFA setup not initiated. Call /api/auth/mfa/setup first." }, { status: 400 });
    }

    if (admin.mfaEnabled) {
      return NextResponse.json({ error: "MFA is already enabled." }, { status: 400 });
    }

    // Decrypt the stored secret and verify the code
    const secret = decrypt(admin.mfaSecret);
    if (!secret) {
      return NextResponse.json({ error: "Failed to decrypt MFA secret. Check encryption key." }, { status: 500 });
    }

    const valid = verifyTOTP(secret, code);
    if (!valid) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    // Enable MFA
    await prisma.adminUser.update({
      where: { id: session.adminId },
      data: {
        mfaEnabled: true,
        mfaVerifiedAt: new Date(),
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "MFA_ENABLED",
        entityType: "AdminUser",
        entityId: session.adminId,
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true, message: "MFA has been enabled successfully." });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("MFA verify failed:", error);
    return NextResponse.json({ error: "MFA verification failed" }, { status: 500 });
  }
}

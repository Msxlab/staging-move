import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireAdmin, requirePasswordConfirm } from "@/lib/auth";
import { generateSecret, generateProvisioningURI, generateBackupCodes } from "@/lib/totp";
import { encrypt } from "@/lib/shared-encryption";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

// POST /api/auth/mfa/setup — initiate MFA setup (returns QR URI + backup codes)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();

    // Require password confirmation to set up MFA
    const requestMeta = getAuditRequestMeta(request);
    const confirm = await requirePasswordConfirm(session, body.confirmPassword, {
      operation: "admin_mfa_setup",
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: { email: true, mfaEnabled: true },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (admin.mfaEnabled) {
      return NextResponse.json({ error: "MFA is already enabled. Disable it first to reconfigure." }, { status: 400 });
    }

    // Generate TOTP secret and backup codes
    const secret = generateSecret();
    const provisioningURI = generateProvisioningURI(secret, admin.email);
    const { codes: backupCodes, hashes: backupHashes } = await generateBackupCodes();

    // Render QR server-side as a data URL — avoids leaking the TOTP secret
    // to any third-party QR rendering service and keeps the admin CSP
    // (img-src 'self' data: blob:) intact without a host exception.
    const qrDataUrl = await QRCode.toDataURL(provisioningURI, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    });

    // Store encrypted secret temporarily (not yet enabled — needs verify step)
    const encryptedSecret = encrypt(secret);
    await prisma.adminUser.update({
      where: { id: session.adminId },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: JSON.stringify(backupHashes),
        // mfaEnabled stays false until verify step
      },
    });

    await writeAdminAudit(session, {
      action: "MFA_SETUP_STARTED",
      entityType: "AdminUser",
      entityId: session.adminId,
      metadata: { operation: "admin_mfa_setup" },
      request: requestMeta,
    });

    return NextResponse.json({
      success: true,
      provisioningURI,
      qrDataUrl,
      secret, // Show once for manual entry
      backupCodes, // Show once — user must save these
      message: "Scan the QR code with your authenticator app, then verify with a code to enable MFA.",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("MFA setup failed:", error);
    return NextResponse.json({ error: "MFA setup failed" }, { status: 500 });
  }
}

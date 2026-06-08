import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { prisma, prismaUnsafe } from "@/lib/db";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { sendHardDeleteOtpEmail } from "@/lib/email";
import { maskEmail } from "@/lib/privacy";
import { hashAdminActionOtpCode } from "@/lib/admin-action-otp";

export const dynamic = "force-dynamic";

const OTP_OPERATION = "user_hard_delete";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * STEP 1 of the irreversible HARD DELETE flow.
 *
 * Authorization boundary (defense in depth, all required):
 *   - requirePermission('users','canDelete',{ minimumRole: 'SUPER_ADMIN' })
 *   - requirePasswordConfirm(..., { requireMfa: true }) — admin password + MFA.
 *
 * Only after BOTH pass do we mint a 6-digit code, store ONLY HMAC(code) in a
 * fresh AdminActionOtp row bound to (acting admin, operation, target user), and
 * email the plaintext code to the ACTING ADMIN's OWN address (never the target).
 * Prior unconsumed codes for the same (admin, operation, target) are superseded
 * (marked consumed) so only the newest code can ever be redeemed. The code is
 * NEVER returned to the client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("users", "canDelete", { minimumRole: "SUPER_ADMIN" });
    const { id } = await params;
    const requestMeta = getAuditRequestMeta(request);

    let confirmPassword: string | undefined;
    let mfaCode: string | undefined;
    let backupCode: string | undefined;
    try {
      const body = await request.json();
      confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined;
      mfaCode = typeof body?.mfaCode === "string" ? body.mfaCode : undefined;
      backupCode = typeof body?.backupCode === "string" ? body.backupCode : undefined;
    } catch {
      /* no body — password will be required */
    }

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: OTP_OPERATION,
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "USER_HARD_DELETE_FAILED",
        entityType: "User",
        entityId: id,
        metadata: {
          operation: OTP_OPERATION,
          status: "failed",
          phase: "otp_request",
          reason: confirm.rateLimited ? "rate_limited" : "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        {
          error: confirm.error,
          requiresPassword: true,
          requiresMfa: confirm.requiresMfa || undefined,
          retryAfterSec: confirm.retryAfterSec || undefined,
        },
        { status: confirm.rateLimited ? 429 : 403 },
      );
    }

    // Target lookup via the raw client so a previously soft-deleted user can
    // still be hard-deleted. We need the target's email only to MASK it in the
    // operator's confirmation email.
    const target = await prismaUnsafe.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // The OTP is emailed to the ACTING ADMIN's own address, NOT the target.
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: { email: true, isActive: true },
    });
    if (!admin || !admin.isActive || !admin.email) {
      return NextResponse.json({ error: "Admin account not found or inactive" }, { status: 403 });
    }

    // 6-digit numeric code, cryptographically random, zero-padded.
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = hashAdminActionOtpCode(code, {
      adminUserId: session.adminId,
      operation: OTP_OPERATION,
      targetId: id,
    });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    // Supersede any prior unconsumed codes for this exact target so only the
    // newest can be redeemed (single live code per admin+operation+target).
    await prisma.adminActionOtp.updateMany({
      where: { adminUserId: session.adminId, operation: OTP_OPERATION, targetId: id, consumedAt: null },
      data: { consumedAt: now },
    });

    await prisma.adminActionOtp.create({
      data: {
        adminUserId: session.adminId,
        operation: OTP_OPERATION,
        targetId: id,
        codeHash,
        attempts: 0,
        expiresAt,
      },
    });

    const targetMaskedEmail = maskEmail(target.email);
    const sent = await sendHardDeleteOtpEmail({
      to: admin.email,
      code,
      targetMaskedEmail,
    });

    await writeAdminAudit(session, {
      action: "USER_HARD_DELETE_OTP_SENT",
      entityType: "User",
      entityId: id,
      metadata: {
        operation: OTP_OPERATION,
        status: "success",
        phase: "otp_request",
        targetMaskedEmail,
        recipientMaskedEmail: maskEmail(admin.email),
        emailDispatched: sent,
        expiresAt: expiresAt.toISOString(),
      },
      request: requestMeta,
    });

    // Never return the code. `otpSent` is true even if the mail provider was
    // unconfigured in dev (sendEmail returns true and logs the code there).
    return NextResponse.json({ otpSent: true, recipientMaskedEmail: maskEmail(admin.email) });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to send hard-delete OTP:", { code: error?.code || null });
    return NextResponse.json({ error: "Failed to send confirmation code" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { hardDeleteUser } from "@/lib/hard-delete-user";
import { verifyAdminActionOtpCode } from "@/lib/admin-action-otp";
import { dispatchAlert } from "@/lib/alert-dispatcher";

export const dynamic = "force-dynamic";

const OTP_OPERATION = "user_hard_delete";
const OTP_MAX_ATTEMPTS = 5;

/**
 * STEP 2 of the irreversible HARD DELETE flow — the actual erasure.
 *
 * Authorization boundary (all required, re-checked here so step 2 can't be
 * called without step 1's privileges still holding):
 *   - requirePermission('users','canDelete',{ minimumRole: 'SUPER_ADMIN' })
 *   - requirePasswordConfirm(..., { requireMfa: true }) — admin password + MFA.
 *   - A valid single-use, target-bound email OTP (issued by the /otp endpoint
 *     to the acting admin's own inbox).
 *
 * OTP verification properties:
 *   - target-bound: row is selected by (acting admin, operation, THIS target id).
 *   - single-use: rejected if consumedAt is set; set consumedAt on success.
 *   - time-limited: rejected if expiresAt has passed.
 *   - attempt-limited: rejected once attempts >= 5; a wrong code atomically
 *     increments attempts (so brute force burns the budget and is then locked).
 *   - constant-time: HMAC(submitted) vs stored codeHash via timingSafeEqual.
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
    let otpCode: string | undefined;
    // Operator override: proceed with the erasure even if the Stripe cancel
    // fails. The operator must explicitly opt in (the UI only sets this after
    // showing the STRIPE_CANCEL_FAILED block and an acknowledgement).
    let force = false;
    try {
      const body = await request.json();
      confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined;
      mfaCode = typeof body?.mfaCode === "string" ? body.mfaCode : undefined;
      backupCode = typeof body?.backupCode === "string" ? body.backupCode : undefined;
      otpCode = typeof body?.otpCode === "string" ? body.otpCode.trim() : undefined;
      force = body?.force === true;
    } catch {
      /* no body — password + otp will be required */
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
          phase: "delete",
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

    if (!otpCode || !/^\d{6}$/.test(otpCode)) {
      await writeAdminAudit(session, {
        action: "USER_HARD_DELETE_FAILED",
        entityType: "User",
        entityId: id,
        metadata: { operation: OTP_OPERATION, status: "failed", phase: "delete", reason: "invalid_otp", detail: "missing_or_malformed" },
        request: requestMeta,
      });
      return NextResponse.json({ error: "Enter the 6-digit code we emailed to your admin address.", reason: "invalid_otp" }, { status: 403 });
    }

    // Load the latest OTP for (acting admin, operation, THIS target). Bound to
    // the target id so a code minted for one user can't erase another.
    const otp = await prisma.adminActionOtp.findFirst({
      where: { adminUserId: session.adminId, operation: OTP_OPERATION, targetId: id },
      orderBy: { createdAt: "desc" },
    });

    const nowMs = Date.now();
    const otpInvalidReason =
      !otp
        ? "no_otp"
        : otp.consumedAt
          ? "already_consumed"
          : otp.expiresAt.getTime() <= nowMs
            ? "expired"
            : otp.attempts >= OTP_MAX_ATTEMPTS
              ? "too_many_attempts"
              : null;

    if (otpInvalidReason) {
      await writeAdminAudit(session, {
        action: "USER_HARD_DELETE_FAILED",
        entityType: "User",
        entityId: id,
        metadata: { operation: OTP_OPERATION, status: "failed", phase: "delete", reason: "invalid_otp", detail: otpInvalidReason },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "That confirmation code is no longer valid. Start the hard delete again to get a new code.", reason: "invalid_otp" },
        { status: 403 },
      );
    }

    // Constant-time compare of HMAC(submitted) against the stored hash.
    const match = verifyAdminActionOtpCode(otpCode!, otp!.codeHash, {
      adminUserId: session.adminId,
      operation: OTP_OPERATION,
      targetId: id,
    });
    if (!match) {
      // Atomic increment-on-mismatch, guarded by the current attempts value so
      // concurrent wrong guesses can't both think they were "attempt N".
      await prisma.adminActionOtp.updateMany({
        where: { id: otp!.id, consumedAt: null, attempts: otp!.attempts },
        data: { attempts: otp!.attempts + 1 },
      });
      const attemptsNow = otp!.attempts + 1;
      const exhausted = attemptsNow >= OTP_MAX_ATTEMPTS;
      await writeAdminAudit(session, {
        action: "USER_HARD_DELETE_FAILED",
        entityType: "User",
        entityId: id,
        metadata: {
          operation: OTP_OPERATION,
          status: "failed",
          phase: "delete",
          reason: "invalid_otp",
          detail: "code_mismatch",
          attempts: attemptsNow,
          locked: exhausted,
        },
        request: requestMeta,
      });
      return NextResponse.json(
        {
          error: exhausted
            ? "Too many incorrect codes. Start the hard delete again to get a new code."
            : "Incorrect confirmation code.",
          reason: "invalid_otp",
        },
        { status: 403 },
      );
    }

    // Success: consume the OTP atomically (single-use) BEFORE running the
    // cascade, so a retry / double-submit can't redeem the same code twice.
    const consumed = await prisma.adminActionOtp.updateMany({
      where: { id: otp!.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      // Lost the race — another request already consumed it.
      await writeAdminAudit(session, {
        action: "USER_HARD_DELETE_FAILED",
        entityType: "User",
        entityId: id,
        metadata: { operation: OTP_OPERATION, status: "failed", phase: "delete", reason: "invalid_otp", detail: "consume_race" },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "That confirmation code was already used. Start the hard delete again.", reason: "invalid_otp" },
        { status: 403 },
      );
    }

    // Irreversible cascade. The OTP is already consumed; if the erasure throws,
    // the operator must restart from step 1 (a fresh code) — we never re-open a
    // consumed code.
    let result;
    try {
      result = await hardDeleteUser(id, { force });
    } catch (cascadeError: any) {
      if (cascadeError?.message === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      await writeAdminAudit(session, {
        action: "USER_HARD_DELETE_FAILED",
        entityType: "User",
        entityId: id,
        metadata: { operation: OTP_OPERATION, status: "failed", phase: "cascade", reason: "cascade_error" },
        request: requestMeta,
      });
      console.error("Hard delete cascade failed:", { code: cascadeError?.code || null });
      return NextResponse.json({ error: "Hard delete failed. The user was not erased." }, { status: 500 });
    }

    // Blocked: a live Stripe subscription could NOT be canceled and the operator
    // did not force. NOTHING was deleted. Record an audit row + fire a security
    // alert (a paying account would otherwise keep billing after a "delete"),
    // and return an actionable 409 so the operator resolves Stripe or forces.
    if (result.success === false) {
      await writeAdminAudit(session, {
        action: "USER_HARD_DELETE_BLOCKED",
        entityType: "User",
        entityId: id,
        metadata: {
          operation: OTP_OPERATION,
          status: "blocked",
          phase: "stripe_cancel",
          reason: result.code,
          maskedEmail: result.maskedEmail,
        },
        request: requestMeta,
      });
      // Best-effort alert (never throws). HIGH severity so it actually dispatches.
      await dispatchAlert(
        "USER_HARD_DELETE_STRIPE_CANCEL_FAILED",
        "HIGH",
        requestMeta.ipAddress || "unknown",
        `Hard delete of ${result.maskedEmail} (user ${id}) was BLOCKED: Stripe subscription ${result.stripeSubscriptionId} could not be canceled. The user was NOT erased. Cancel the subscription in Stripe, then retry — or re-run with force after accepting manual billing reconciliation.`,
        session.adminId,
      ).catch(() => {});
      return NextResponse.json(
        {
          error:
            "Stripe subscription could not be canceled, so the user was NOT deleted. Cancel the subscription in Stripe and try again, or force the deletion and reconcile billing manually.",
          reason: result.code,
          blocked: true,
          stripeSubscriptionId: result.stripeSubscriptionId,
          canForce: true,
        },
        { status: 409 },
      );
    }

    // AdminAuditLog survives the erasure (no FK to User) — this is the
    // legally-required record that the deletion happened.
    await writeAdminAudit(session, {
      action: "USER_HARD_DELETED",
      entityType: "User",
      entityId: id,
      metadata: {
        operation: OTP_OPERATION,
        status: "success",
        maskedEmail: result.maskedEmail,
        stripeCanceled: result.stripeCanceled,
        ownedWorkspacesTransferred: result.ownedWorkspacesTransferred,
        ownedWorkspacesDeleted: result.ownedWorkspacesDeleted,
        gdprRequestsPurged: result.gdprRequestsPurged,
      },
      request: requestMeta,
    });

    return NextResponse.json({ success: true, hardDeleted: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to hard delete user:", { code: error?.code || null });
    return NextResponse.json({ error: "Failed to hard delete user" }, { status: 500 });
  }
}

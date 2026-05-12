import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { emitSecurityEvent } from "@/lib/security-events";
import { createAccountDeletionRequest, getActiveAccountDeletionRequest, processAccountDeletionRequest } from "@/lib/account-deletion";
import { sendSecurityNoticeEmail } from "@/lib/email-service";
import { verifyUserStepUp } from "@/lib/user-step-up";

// POST /api/account/delete — GDPR right to erasure
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId({ distinguishDeleted: true });
    emitSecurityEvent({
      type: "ACCOUNT_DELETE_ATTEMPT",
      severity: "warn",
      group: "account_delete",
      context: { userId },
    });

    const meta = extractRequestMeta(request);
    // Always emit the attempt — independent of whether the limit fires
    // or step-up succeeds. This is the audit trail an investigator
    // needs if a stranger walks up to a left-open laptop.
    emitSecurityEvent({
      type: "ACCOUNT_DELETE_ATTEMPT",
      severity: "warn",
      group: "account_delete",
      context: { userId },
    });
    const rl = await enforceRateLimitPolicy(request, "account_delete", {
      userId,
      routeId: "account_delete",
    });
    if (!rl.success) {
      await createAuditLog({
        userId,
        action: "DELETE_LIMIT",
        entityType: "User",
        entityId: userId,
        changes: { code: rl.policy.userFacingErrorCode },
        ...meta,
      });
      return NextResponse.json(
        { code: rl.policy.userFacingErrorCode, error: "Too many requests. Please wait." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body: any = await request.json().catch(() => ({}));
    const hasMfaAttempt =
      typeof body?.mfaCode === "string" || typeof body?.backupCode === "string";
    if (hasMfaAttempt) {
      const mfaRl = await enforceRateLimitPolicy(request, "mfa_verify", {
        userId,
        routeId: typeof body?.backupCode === "string" ? "delete_backup_code" : "delete_totp",
      });
      if (!mfaRl.success) {
        await createAuditLog({
          userId,
          action: "MFA_LIMIT",
          entityType: "User",
          entityId: userId,
          changes: { operation: "account_delete", code: mfaRl.policy.userFacingErrorCode },
          ...meta,
        });
        return NextResponse.json(
          {
            code: mfaRl.policy.userFacingErrorCode,
            error: "Too many verification attempts. Please wait and try again.",
          },
          { status: 429, headers: { "Retry-After": String(mfaRl.retryAfterSeconds) } },
        );
      }
    }

    const stepUp = await verifyUserStepUp({
      userId,
      confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : null,
      mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : null,
      backupCode: typeof body?.backupCode === "string" ? body.backupCode : null,
      // OAuth-only mobile/web clients pass this boolean when the user has
      // no password set. The step-up helper only honors it if the account
      // truly has no password AND no MFA, so this cannot weaken security
      // for accounts that have either factor configured.
      confirmAccountDeletion: body?.confirmAccountDeletion === true,
    });
    if (!stepUp.ok) {
      await createAuditLog({
        userId,
        action: "STEP_UP_FAIL",
        entityType: "User",
        entityId: userId,
        changes: { operation: "account_delete", code: stepUp.code },
        ...meta,
      });
      return NextResponse.json(
        { error: stepUp.message, code: stepUp.code },
        { status: stepUp.code === "STEP_UP_REQUIRED" ? 403 : 401 },
      );
    }

    const existingRequest = await getActiveAccountDeletionRequest(userId);
    const deleteRequest = existingRequest || await (async () => {
      const subscription = await prisma.subscription.findUnique({ where: { userId } });

      await createAuditLog({
        userId,
        action: "ACCOUNT_DELETE",
        entityType: "User",
        entityId: userId,
        changes: { email: user.email, stepUpMethod: stepUp.method },
        ...meta,
      });

      return createAccountDeletionRequest({
        userId,
        source: "self_service",
        email: user.email,
        stripeSubscriptionId: subscription?.stripeSubscriptionId || null,
      });
    })();

    // Email the user only on initial request — re-clicks of "delete my
    // account" while a request is pending shouldn't spam.
    if (!existingRequest) {
      const isEs = (user.preferredLocale || "").toLowerCase().startsWith("es");
      void sendSecurityNoticeEmail({
        userEmail: user.email,
        userName: user.firstName || "there",
        kind: "account-deletion-requested",
        detail: isEs ? "Tus datos se eliminarán pronto." : "Your data will be removed shortly.",
        occurredAt: new Date(),
        locale: user.preferredLocale,
        dedupeKey: `account-deletion:${deleteRequest.id}`,
      }).catch((err) => console.error("[ACCOUNT] deletion-confirm email failed:", err));
    }

    const processed = await processAccountDeletionRequest(deleteRequest.id);
    await createAuditLog({
      userId,
      action: "ACCOUNT_DEL_PROC",
      entityType: "GDPRRequest",
      entityId: deleteRequest.id,
      changes: { status: processed.status, cleanup: "cleanup" in processed ? processed.cleanup : null },
      ...extractRequestMeta(request),
    });
    const completed = processed.status === "COMPLETED";

    return NextResponse.json(
      {
        success: true,
        status: processed.status,
        requestId: deleteRequest.id,
        message: completed
          ? "Account deletion completed."
          : "Account deletion initiated. Remaining cleanup will continue automatically.",
      },
      { status: completed ? 200 : 202 }
    );
  } catch (error: any) {
    if (error?.message === "ACCOUNT_DELETED") {
      return NextResponse.json(
        {
          success: true,
          status: "PROCESSING",
          message: "Account deletion is already in progress.",
        },
        { status: 202 }
      );
    }
    console.error("Failed to delete account:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

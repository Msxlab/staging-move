import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { maskProviderIdentifier } from "@/lib/privacy";

/**
 * Admin lifecycle action: RE-VALIDATE a store receipt for an App Store /
 * Play Store subscription.
 *
 * The live App Store Server API / Play Developer API validators live in the
 * web app (apps/web/src/lib/iap-apple.ts, iap-google.ts) and are NOT importable
 * from this separate admin Next build (same constraint documented in
 * hard-delete-user.ts). So this route performs the documented fallback: it
 * re-reads the STORED receipt credential (Apple originalTransactionId /
 * latestTransactionId, Google purchaseToken) and refreshes the row's recorded
 * health — stamping `lastValidatedAt` when the credential is still present, or
 * recording a failure (and NOT stamping) when the stored credential is missing,
 * which is exactly the "Missing transaction / Missing token" health the
 * subscriptions list surfaces.
 *
 * No money moves and no entitlement flips, but it is still a mutation of
 * recorded billing health, so it sits behind the step-up (password + MFA) and
 * writes START/COMPLETE/FAIL audit rows. Keyed by Subscription.id.
 */

const revalidateSchema = z
  .object({
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

const STORE_PROVIDERS = new Set(["APP_STORE", "PLAY_STORE"]);

const returnSelect = {
  id: true,
  userId: true,
  plan: true,
  status: true,
  provider: true,
  platform: true,
  originalTransactionId: true,
  latestTransactionId: true,
  lastValidatedAt: true,
  lastSyncedAt: true,
  updatedAt: true,
};

function auditSnapshot(subscription: any) {
  return {
    rowId: subscription?.id || null,
    userId: subscription?.userId || null,
    provider: subscription?.provider || null,
    plan: subscription?.plan || null,
    status: subscription?.status || null,
    lastValidatedAt: subscription?.lastValidatedAt || null,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    const raw = await request.json().catch(() => null);
    const parsed = revalidateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid re-validate request." }, { status: 400 });
    }
    const { confirmPassword, mfaCode, backupCode } = parsed.data;
    const { id: subscriptionId } = await params;
    const requestMeta = getAuditRequestMeta(request);

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "billing_subscription_revalidate",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REVALIDATE_FAILED",
        entityType: "Subscription",
        entityId: subscriptionId,
        metadata: {
          operation: "billing_subscription_revalidate",
          status: "failed",
          reasonCode: "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        userId: true,
        provider: true,
        plan: true,
        status: true,
        originalTransactionId: true,
        latestTransactionId: true,
        purchaseTokenEncrypted: true,
        purchaseTokenHash: true,
        lastValidatedAt: true,
      },
    });
    if (!subscription || !STORE_PROVIDERS.has(subscription.provider)) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REVALIDATE_FAILED",
        entityType: "Subscription",
        entityId: subscription?.id || subscriptionId,
        metadata: {
          operation: "billing_subscription_revalidate",
          status: "failed",
          reasonCode: "not_a_store_subscription",
          before: auditSnapshot(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Only App Store or Play Store subscriptions can be re-validated." },
        { status: 409 },
      );
    }
    const userId = subscription.userId;
    const before = auditSnapshot(subscription);

    // Re-read the stored receipt credential for the relevant provider.
    const credentialPresent =
      subscription.provider === "APP_STORE"
        ? Boolean(subscription.originalTransactionId || subscription.latestTransactionId)
        : Boolean(subscription.purchaseTokenEncrypted || subscription.purchaseTokenHash);

    if (!credentialPresent) {
      // Stored credential is gone — record the unhealthy result, DON'T stamp
      // lastValidatedAt (that would falsely mark the receipt as healthy).
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REVALIDATE_COMPLETED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_revalidate",
          status: "completed",
          result: "missing_credential",
          targetUserId: userId,
          provider: subscription.provider,
          before,
        },
        request: requestMeta,
      });
      return NextResponse.json(
        {
          revalidated: false,
          result: "missing_credential",
          error:
            subscription.provider === "APP_STORE"
              ? "No stored App Store transaction id to re-validate."
              : "No stored Play Store purchase token to re-validate.",
        },
        { status: 200 },
      );
    }

    const now = new Date();
    let updated: any;
    try {
      updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { lastValidatedAt: now, lastSyncedAt: now },
        select: returnSelect,
      });
    } catch (dbError: any) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REVALIDATE_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_revalidate",
          status: "failed",
          reasonCode: "db_update_failed",
          targetUserId: userId,
          before,
          errorCode: dbError?.code || null,
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Could not update recorded health. Please try again." },
        { status: 500 },
      );
    }

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_REVALIDATE_COMPLETED",
      entityType: "Subscription",
      entityId: updated.id,
      metadata: {
        operation: "billing_subscription_revalidate",
        status: "completed",
        result: "credential_present",
        targetUserId: userId,
        provider: updated.provider,
        maskedCredentialId: maskProviderIdentifier(
          subscription.provider === "APP_STORE"
            ? subscription.latestTransactionId || subscription.originalTransactionId
            : "stored-play-token-present",
        ),
        before,
        after: auditSnapshot(updated),
      },
      request: requestMeta,
    });

    return NextResponse.json({ revalidated: true, result: "credential_present", subscription: updated });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Subscription re-validate failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to re-validate receipt. Please try again." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { getAdminStripeClient } from "@/lib/admin-stripe";
import { maskProviderIdentifier } from "@/lib/privacy";

/**
 * Admin lifecycle action: CANCEL a Stripe subscription — either immediately
 * (subscriptions.cancel, ends access now) or at the end of the current period
 * (subscriptions.update cancel_at_period_end:true, access continues until the
 * period end). Both burn money / end paid access, so both sit behind the full
 * step-up (admin password + MFA) and write START/COMPLETE/FAIL audit rows.
 *
 * Keyed by Subscription.id (the row the subscriptions detail view operates on).
 */

const cancelSchema = z
  .object({
    // "now" → immediate cancel; "period_end" → cancel_at_period_end:true.
    mode: z.enum(["now", "period_end"]),
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

function auditSnapshot(subscription: any) {
  return {
    rowId: subscription?.id || null,
    userId: subscription?.userId || null,
    provider: subscription?.provider || null,
    plan: subscription?.plan || null,
    status: subscription?.status || null,
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    maskedProviderId: maskProviderIdentifier(subscription?.stripeSubscriptionId),
  };
}

const returnSelect = {
  id: true,
  userId: true,
  plan: true,
  status: true,
  provider: true,
  platform: true,
  stripeSubscriptionId: true,
  stripeCurrentPeriodEnd: true,
  currentPeriodEndsAt: true,
  trialEndsAt: true,
  canceledAt: true,
  cancelAtPeriodEnd: true,
  autoRenew: true,
  accessType: true,
  lastSyncedAt: true,
  updatedAt: true,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    const raw = await request.json().catch(() => null);
    const parsed = cancelSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid cancel request." }, { status: 400 });
    }
    const { mode, confirmPassword, mfaCode, backupCode } = parsed.data;
    const { id: subscriptionId } = await params;
    const requestMeta = getAuditRequestMeta(request);

    // Cancelling (now or at period end) ends paid access — require MFA step-up.
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "billing_subscription_cancel",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CANCEL_FAILED",
        entityType: "Subscription",
        entityId: subscriptionId,
        metadata: {
          operation: "billing_subscription_cancel",
          status: "failed",
          reasonCode: "step_up_failed",
          mode,
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
        accessType: true,
        stripeSubscriptionId: true,
        cancelAtPeriodEnd: true,
        trialEndsAt: true,
        currentPeriodEndsAt: true,
      },
    });

    const hasStripe =
      subscription?.provider === "STRIPE" && Boolean(subscription?.stripeSubscriptionId);
    // Already-terminal states can't be cancelled again.
    const cancellable =
      hasStripe && !["CANCELED", "EXPIRED"].includes(subscription?.status || "");
    if (!subscription || !cancellable) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CANCEL_FAILED",
        entityType: "Subscription",
        entityId: subscription?.id || subscriptionId,
        metadata: {
          operation: "billing_subscription_cancel",
          status: "failed",
          reasonCode: "invalid_subscription_state",
          mode,
          before: auditSnapshot(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "This subscription cannot be cancelled (not an active Stripe subscription)." },
        { status: 409 },
      );
    }
    const stripeSubscriptionId = subscription.stripeSubscriptionId as string;
    const userId = subscription.userId;
    const operationId = `admin-subscription-cancel:${mode}:${subscription.id}:${subscription.status}`
      .replace(/[^A-Za-z0-9:_-]/g, "_")
      .slice(0, 255);
    const before = auditSnapshot(subscription);

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_CANCEL_STARTED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: {
        operation: "billing_subscription_cancel",
        status: "started",
        operationId,
        mode,
        targetUserId: userId,
        before,
      },
      request: requestMeta,
    });

    const stripe = await getAdminStripeClient();
    const now = new Date();
    let stripeSubscription: Stripe.Subscription;
    try {
      stripeSubscription =
        mode === "now"
          ? await stripe.subscriptions.cancel(stripeSubscriptionId)
          : await stripe.subscriptions.update(
              stripeSubscriptionId,
              { cancel_at_period_end: true },
              { idempotencyKey: operationId },
            );
    } catch (stripeError: any) {
      console.error("Stripe subscription cancel failed", {
        userId,
        mode,
        maskedStripeSubscriptionId: maskProviderIdentifier(stripeSubscriptionId),
        type: stripeError?.type || null,
        code: stripeError?.code || null,
      });
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CANCEL_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_cancel",
          status: "failed",
          reasonCode: "provider_update_failed",
          operationId,
          mode,
          targetUserId: userId,
          before,
          errorType: stripeError?.type || null,
          errorCode: stripeError?.code || null,
        },
        request: requestMeta,
      }).catch(() => null);
      return NextResponse.json(
        { error: "Failed to cancel the subscription with the billing provider. Please try again." },
        { status: 502 },
      );
    }

    const periodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : subscription.currentPeriodEndsAt;
    const isImmediate = mode === "now" || stripeSubscription.status === "canceled";
    const nextStatus = isImmediate ? "CANCELED" : "CANCEL_AT_PERIOD_END";

    let updated: any;
    try {
      updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: nextStatus,
          autoRenew: false,
          cancelAtPeriodEnd: !isImmediate,
          currentPeriodEndsAt: periodEnd,
          stripeCurrentPeriodEnd: periodEnd,
          canceledAt: now,
          lastSyncedAt: now,
        },
        select: returnSelect,
      });
    } catch (dbError: any) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CANCEL_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_cancel",
          status: "failed",
          reasonCode: "db_update_failed_after_provider_success",
          operationId,
          mode,
          targetUserId: userId,
          before,
          providerResult: {
            status: stripeSubscription.status,
            cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
          },
          errorCode: dbError?.code || null,
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Subscription cancelled with the provider, but local billing state could not be saved. Reconcile before retrying." },
        { status: 500 },
      );
    }

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_CANCEL_COMPLETED",
      entityType: "Subscription",
      entityId: updated.id,
      metadata: {
        operation: "billing_subscription_cancel",
        status: "completed",
        operationId,
        mode,
        targetUserId: userId,
        before,
        after: auditSnapshot(updated),
      },
      request: requestMeta,
    });

    return NextResponse.json({ subscription: updated });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Subscription cancel failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to cancel subscription. Please try again." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";
import { maskProviderIdentifier } from "@/lib/privacy";

const SUBSCRIPTION_ACTIONS = [
  "cancel_trial",
  "cancel_renewal",
  "resume_renewal",
] as const;
type SubscriptionAction = (typeof SUBSCRIPTION_ACTIONS)[number];

const subscriptionActionSchema = z
  .object({
    action: z.enum(SUBSCRIPTION_ACTIONS),
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

function isBillingProductionLike() {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  if (["development", "dev", "test", "staging", "preview"].includes(appEnv)) return false;
  return appEnv === "production" || (!appEnv && process.env.NODE_ENV === "production");
}

function requireStripeSecretKey(key: string | null | undefined) {
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  if (isBillingProductionLike() && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY must be live in production billing environments");
  }
  if (!isBillingProductionLike() && !key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY has an invalid prefix");
  }
  return key;
}

const subscriptionActionReturnSelect = {
  id: true,
  userId: true,
  plan: true,
  status: true,
  provider: true,
  platform: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripePriceId: true,
  stripeCurrentPeriodEnd: true,
  currentPeriodEndsAt: true,
  trialEndsAt: true,
  canceledAt: true,
  cancelAtPeriodEnd: true,
  autoRenew: true,
  accessType: true,
  billingInterval: true,
  lastSyncedAt: true,
  updatedAt: true,
};

function isActionAllowed(action: SubscriptionAction, subscription: any) {
  const hasStripeId = Boolean(subscription?.stripeSubscriptionId);
  if (subscription?.provider !== "STRIPE" || !hasStripeId) return false;
  if (action === "cancel_trial") {
    return subscription.status === "TRIALING";
  }
  if (action === "cancel_renewal") {
    return ["ACTIVE", "TRIALING"].includes(subscription.status) &&
      subscription.cancelAtPeriodEnd !== true;
  }
  if (action === "resume_renewal") {
    return subscription.cancelAtPeriodEnd === true ||
      ["CANCEL_AT_PERIOD_END", "TRIAL_CANCELED"].includes(subscription.status);
  }
  return false;
}

function subscriptionAuditSnapshot(subscription: any) {
  return {
    rowId: subscription?.id || null,
    provider: subscription?.provider || null,
    plan: subscription?.plan || null,
    status: subscription?.status || null,
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    maskedProviderId: maskProviderIdentifier(subscription?.stripeSubscriptionId),
  };
}

const STRIPE_IDEMPOTENCY_BUCKET_MS = 10 * 60 * 1000;

function buildSubscriptionActionIdempotencyKey(
  action: SubscriptionAction,
  userId: string,
  subscription: any,
  nowMs = Date.now(),
) {
  const bucket = Math.floor(nowMs / STRIPE_IDEMPOTENCY_BUCKET_MS);
  const cancelState = subscription.cancelAtPeriodEnd ? "canceling" : "renewing";
  const periodEnd = subscription.currentPeriodEndsAt
    ? new Date(subscription.currentPeriodEndsAt).getTime()
    : "none";
  return [
    "admin-subscription-action-v2",
    action,
    userId,
    subscription.id,
    subscription.status || "unknown",
    cancelState,
    periodEnd,
    bucket,
  ]
    .join(":")
    .replace(/[^A-Za-z0-9:_-]/g, "_")
    .slice(0, 255);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    const raw = await request.json().catch(() => null);
    const parsed = subscriptionActionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid subscription action." },
        { status: 400 },
      );
    }
    const { action, confirmPassword, mfaCode, backupCode } = parsed.data;
    const { id: userId } = await params;
    const requestMeta = getAuditRequestMeta(request);

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "billing_subscription_action",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_ACTION_FAILED",
        entityType: "User",
        entityId: userId,
        metadata: {
          operation: "billing_subscription_action",
          status: "failed",
          reasonCode: "step_up_failed",
          action,
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json({ error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined }, { status: 403 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
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
        autoRenew: true,
      },
    });
    if (!subscription || !subscription.stripeSubscriptionId || !isActionAllowed(action, subscription)) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_ACTION_FAILED",
        entityType: "Subscription",
        entityId: subscription?.id || userId,
        metadata: {
          operation: "billing_subscription_action",
          status: "failed",
          reasonCode: "invalid_subscription_state",
          targetUserId: userId,
          action,
          before: subscriptionAuditSnapshot(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Invalid subscription state for this action" },
        { status: 409 },
      );
    }
    const stripeSubscriptionId = subscription.stripeSubscriptionId;

    const idempotencyKey = buildSubscriptionActionIdempotencyKey(action, userId, subscription);
    const operationId = idempotencyKey;
    const beforeSnapshot = subscriptionAuditSnapshot(subscription);
    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_ACTION_STARTED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: {
        operation: "billing_subscription_action",
        status: "started",
        operationId,
        targetUserId: userId,
        action,
        before: beforeSnapshot,
      },
      request: requestMeta,
    });

    const stripe = new Stripe(
      requireStripeSecretKey(await getAdminRuntimeConfigValue("STRIPE_SECRET_KEY")),
      { apiVersion: "2024-06-20" },
    );
    const now = new Date();
    let stripeSubscription: Stripe.Subscription;
    try {
      stripeSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: action === "resume_renewal" ? false : true,
      }, {
        idempotencyKey,
      });
    } catch (stripeError: any) {
      // Don't leak raw Stripe payloads (request IDs, internal codes, full
      // error.raw payload). Log them server-side, return a stable public
      // message the admin UI can show without exposing implementation.
      console.error("Stripe subscription update failed", {
        userId,
        action,
        maskedStripeSubscriptionId: maskProviderIdentifier(stripeSubscriptionId),
        type: stripeError?.type || null,
        code: stripeError?.code || null,
      });
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_ACTION_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_action",
          status: "failed",
          reasonCode: "provider_update_failed",
          operationId,
          action,
          targetUserId: userId,
          before: beforeSnapshot,
          errorType: stripeError?.type || null,
          errorCode: stripeError?.code || null,
        },
        request: requestMeta,
      }).catch(() => null);
      return NextResponse.json(
        { error: "Failed to update subscription with the billing provider. Please try again." },
        { status: 502 },
      );
    }
    const periodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : subscription.currentPeriodEndsAt;
    const isTrial =
      subscription.accessType === "FREE_TRIAL" ||
      subscription.status === "TRIALING" ||
      subscription.status === "TRIAL_CANCELED";
    const trialStillActive = Boolean(subscription.trialEndsAt && subscription.trialEndsAt > now);
    const nextStatus: SubscriptionAction extends never ? never : string =
      action === "resume_renewal"
        ? isTrial && trialStillActive ? "TRIALING" : "ACTIVE"
        : isTrial ? "TRIAL_CANCELED" : "CANCEL_AT_PERIOD_END";

    let updated: any;
    try {
      updated = await prisma.subscription.update({
        where: { userId },
        data: {
          status: nextStatus,
          autoRenew: action === "resume_renewal",
          cancelAtPeriodEnd: action !== "resume_renewal",
          currentPeriodEndsAt: periodEnd,
          stripeCurrentPeriodEnd: periodEnd,
          canceledAt: action === "resume_renewal" ? null : now,
          lastSyncedAt: now,
        },
        select: subscriptionActionReturnSelect,
      });
    } catch (dbError: any) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_ACTION_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_action",
          status: "failed",
          reasonCode: "db_update_failed_after_provider_success",
          operationId,
          action,
          targetUserId: userId,
          before: beforeSnapshot,
          providerResult: {
            cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
            currentPeriodEnd: stripeSubscription.current_period_end || null,
          },
          errorCode: dbError?.code || null,
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Subscription provider updated, but local billing state could not be saved. Reconcile before retrying." },
        { status: 500 },
      );
    }

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_ACTION_COMPLETED",
      entityType: "Subscription",
      entityId: updated.id,
      metadata: {
        operation: "billing_subscription_action",
        status: "completed",
        operationId,
        action,
        targetUserId: userId,
        before: beforeSnapshot,
        after: {
          rowId: updated.id,
          provider: updated.provider,
          plan: updated.plan,
          status: updated.status,
          cancelAtPeriodEnd: Boolean(updated.cancelAtPeriodEnd),
          maskedProviderId: maskProviderIdentifier(updated.stripeSubscriptionId),
        },
      },
      request: requestMeta,
    });

    return NextResponse.json({ subscription: updated });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // Don't leak runtime config errors (`STRIPE_SECRET_KEY is missing`)
    // or arbitrary stack traces to the client. Log server-side, return a
    // stable opaque message.
    console.error("Subscription action failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to update subscription. Please try again." },
      { status: 500 },
    );
  }
}

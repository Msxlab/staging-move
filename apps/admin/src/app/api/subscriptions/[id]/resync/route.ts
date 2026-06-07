import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { getAdminStripeClient } from "@/lib/admin-stripe";
import { maskProviderIdentifier } from "@/lib/privacy";

/**
 * Admin lifecycle action: FORCE RE-SYNC from Stripe — re-fetch the live
 * subscription from the provider and overwrite the local Subscription row's
 * status / current_period_end / plan / price so an out-of-band Stripe change
 * (a webhook we missed, a dashboard edit) is reconciled on demand.
 *
 * Re-sync only WRITES LOCAL state from the authoritative provider — it never
 * moves money or changes the Stripe subscription. It is still a privileged
 * mutation (it can flip a user's entitlement), so it sits behind the step-up
 * and is fully audited. MFA is required because flipping status to/from
 * CANCELED changes access.
 *
 * Keyed by Subscription.id.
 */

const resyncSchema = z
  .object({
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

// Canonical Stripe status → local status mapping, mirrored from the web
// Stripe webhook handler (apps/web/src/app/api/webhooks/stripe/route.ts) so
// a forced re-sync produces the SAME local status the webhook path would.
function mapStripeStatus(stripeStatus: string): string {
  const map: Record<string, string> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    incomplete: "INCOMPLETE",
    incomplete_expired: "EXPIRED",
    paused: "CANCELED",
  };
  return map[stripeStatus] || "UNKNOWN";
}

function mapStripeStatusWithRenewal(subscription: Stripe.Subscription): string {
  if (subscription.status === "trialing" && subscription.cancel_at_period_end) return "TRIAL_CANCELED";
  if (subscription.status === "active" && subscription.cancel_at_period_end) return "CANCEL_AT_PERIOD_END";
  return mapStripeStatus(subscription.status);
}

const KNOWN_PLANS = new Set(["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"]);

/**
 * Best-effort plan resolution that does NOT depend on the web app's private
 * price→plan table (un-importable from this separate admin build). Stripe
 * checkout stamps `metadata.plan` on the subscription and price; prefer those.
 * When Stripe carries no recognisable plan, keep the existing local plan
 * rather than guessing — the re-sync still corrects status / period / price.
 */
function resolvePlanFromStripe(
  subscription: Stripe.Subscription,
  price: Stripe.Price | null,
  fallbackPlan: string,
): string {
  const candidates = [
    typeof subscription.metadata?.plan === "string" ? subscription.metadata.plan : null,
    price && typeof price.metadata?.plan === "string" ? price.metadata.plan : null,
  ];
  for (const candidate of candidates) {
    const normalized = candidate?.trim().toUpperCase();
    if (normalized && KNOWN_PLANS.has(normalized)) return normalized;
  }
  return fallbackPlan;
}

const returnSelect = {
  id: true,
  userId: true,
  plan: true,
  status: true,
  provider: true,
  platform: true,
  stripeSubscriptionId: true,
  stripePriceId: true,
  billingProductId: true,
  stripeCurrentPeriodEnd: true,
  currentPeriodEndsAt: true,
  cancelAtPeriodEnd: true,
  autoRenew: true,
  trialEndsAt: true,
  canceledAt: true,
  lastSyncedAt: true,
  updatedAt: true,
};

function auditSnapshot(subscription: any) {
  return {
    rowId: subscription?.id || null,
    userId: subscription?.userId || null,
    plan: subscription?.plan || null,
    status: subscription?.status || null,
    cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
    currentPeriodEndsAt: subscription?.currentPeriodEndsAt || subscription?.stripeCurrentPeriodEnd || null,
    maskedProviderId: maskProviderIdentifier(subscription?.stripeSubscriptionId),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    const raw = await request.json().catch(() => null);
    const parsed = resyncSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid re-sync request." }, { status: 400 });
    }
    const { confirmPassword, mfaCode, backupCode } = parsed.data;
    const { id: subscriptionId } = await params;
    const requestMeta = getAuditRequestMeta(request);

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "billing_subscription_resync",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_RESYNC_FAILED",
        entityType: "Subscription",
        entityId: subscriptionId,
        metadata: {
          operation: "billing_subscription_resync",
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
        stripeSubscriptionId: true,
        cancelAtPeriodEnd: true,
        currentPeriodEndsAt: true,
        stripeCurrentPeriodEnd: true,
      },
    });
    if (
      !subscription ||
      subscription.provider !== "STRIPE" ||
      !subscription.stripeSubscriptionId
    ) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_RESYNC_FAILED",
        entityType: "Subscription",
        entityId: subscription?.id || subscriptionId,
        metadata: {
          operation: "billing_subscription_resync",
          status: "failed",
          reasonCode: "no_stripe_subscription",
          before: auditSnapshot(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "This subscription is not backed by Stripe and cannot be re-synced." },
        { status: 409 },
      );
    }
    const userId = subscription.userId;
    const operationId = `admin-subscription-resync:${subscription.id}`;
    const before = auditSnapshot(subscription);

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_RESYNC_STARTED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: {
        operation: "billing_subscription_resync",
        status: "started",
        operationId,
        targetUserId: userId,
        before,
      },
      request: requestMeta,
    });

    const stripe = await getAdminStripeClient();
    let stripeSubscription: Stripe.Subscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId, {
        expand: ["items.data.price"],
      });
    } catch (stripeError: any) {
      console.error("Stripe subscription retrieve failed", {
        userId,
        maskedStripeSubscriptionId: maskProviderIdentifier(subscription.stripeSubscriptionId),
        type: stripeError?.type || null,
        code: stripeError?.code || null,
      });
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_RESYNC_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_resync",
          status: "failed",
          reasonCode: "provider_fetch_failed",
          operationId,
          targetUserId: userId,
          before,
          errorType: stripeError?.type || null,
          errorCode: stripeError?.code || null,
        },
        request: requestMeta,
      }).catch(() => null);
      return NextResponse.json(
        { error: "Failed to fetch the subscription from the billing provider. Please try again." },
        { status: 502 },
      );
    }

    const item = stripeSubscription.items?.data?.[0];
    const price = (item?.price as Stripe.Price) || null;
    const stripePriceId = price?.id || null;
    const nextStatus = mapStripeStatusWithRenewal(stripeSubscription);
    const nextPlan = resolvePlanFromStripe(stripeSubscription, price, subscription.plan);
    const periodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : subscription.currentPeriodEndsAt;
    const now = new Date();

    let updated: any;
    try {
      updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: nextStatus,
          plan: nextPlan,
          cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
          autoRenew: !stripeSubscription.cancel_at_period_end,
          currentPeriodEndsAt: periodEnd,
          stripeCurrentPeriodEnd: periodEnd,
          ...(stripePriceId ? { stripePriceId, billingProductId: stripePriceId } : {}),
          canceledAt: stripeSubscription.status === "canceled" ? now : null,
          lastSyncedAt: now,
        },
        select: returnSelect,
      });
    } catch (dbError: any) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_RESYNC_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_resync",
          status: "failed",
          reasonCode: "db_update_failed",
          operationId,
          targetUserId: userId,
          before,
          providerResult: { status: nextStatus, plan: nextPlan },
          errorCode: dbError?.code || null,
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Fetched from the provider, but local billing state could not be saved." },
        { status: 500 },
      );
    }

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_RESYNC_COMPLETED",
      entityType: "Subscription",
      entityId: updated.id,
      metadata: {
        operation: "billing_subscription_resync",
        status: "completed",
        operationId,
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
    console.error("Subscription re-sync failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to re-sync subscription. Please try again." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import {
  getAdminStripeClient,
  resolveAdminStripePriceId,
  mapAdminStripePriceId,
  isAdminPaidPlan,
  type AdminPaidPlan,
  type AdminBillingInterval,
} from "@/lib/admin-stripe";
import { maskProviderIdentifier } from "@/lib/privacy";

/**
 * Admin lifecycle action: CHANGE the PLAN (tier and/or billing interval) of a
 * Stripe subscription via subscriptions.update to a NEW price, with proration.
 *
 * SECURITY — the price id is NEVER taken from the client. The operator picks a
 * (targetPlan, targetInterval) pair; the server resolves the actual Stripe
 * price id from runtime config (resolveAdminStripePriceId, same keys the web
 * checkout uses). The POST re-resolves the price server-side and only trusts
 * the (plan, interval) pair the operator confirmed.
 *
 *  - GET  → read-only PREVIEW: resolves the target price, computes the Stripe
 *           proration amount for the upcoming invoice, and returns the
 *           current → target summary so the confirm dialog can state EXACTLY
 *           what changes (and the immediate proration charge/credit) BEFORE
 *           the operator steps up. Nothing changes on GET.
 *  - POST → applies the change with proration_behavior:create_prorations behind
 *           the full step-up (password + MFA) and writes START/COMPLETE/FAIL
 *           audit rows including the resolved (masked) price + amounts.
 *
 * Unlike the web self-serve route, the admin tool applies EVERY change
 * immediately with proration (it is an operator override, not a customer
 * downgrade-defer flow) so the effect is deterministic and fully audited.
 *
 * Keyed by Subscription.id.
 */

const TIER_RANK: Record<AdminPaidPlan, number> = { INDIVIDUAL: 1, FAMILY: 2, PRO: 3 };

const changePlanSchema = z
  .object({
    // The operator-selected DESTINATION. The server resolves the price from
    // these — a client-supplied price id is never accepted.
    targetPlan: z.enum(["INDIVIDUAL", "FAMILY", "PRO"]),
    targetInterval: z.enum(["MONTH", "YEAR"]),
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

const changePlanQuerySchema = z.object({
  targetPlan: z.enum(["INDIVIDUAL", "FAMILY", "PRO"]),
  targetInterval: z.enum(["MONTH", "YEAR"]),
});

interface LoadedSubscription {
  id: string;
  userId: string;
  provider: string;
  plan: string;
  status: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  billingInterval: string | null;
  currentPeriodEndsAt: Date | null;
  version: number;
  user: { id: string; email: string };
}

async function loadSubscription(subscriptionId: string): Promise<LoadedSubscription | null> {
  return prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      userId: true,
      provider: true,
      plan: true,
      status: true,
      stripeSubscriptionId: true,
      stripePriceId: true,
      billingInterval: true,
      currentPeriodEndsAt: true,
      version: true,
      user: { select: { id: true, email: true } },
    },
  }) as Promise<LoadedSubscription | null>;
}

function auditSnapshot(subscription: any) {
  return {
    rowId: subscription?.id || null,
    userId: subscription?.userId || null,
    plan: subscription?.plan || null,
    status: subscription?.status || null,
    billingInterval: subscription?.billingInterval || null,
    maskedProviderId: maskProviderIdentifier(subscription?.stripeSubscriptionId),
    maskedPriceId: maskProviderIdentifier(subscription?.stripePriceId),
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
  stripePriceId: true,
  billingInterval: true,
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

/**
 * Best-effort current (plan, interval) for the subscription: prefer the local
 * columns, fall back to mapping the stored Stripe price id. May return a
 * non-paid local plan string (e.g. FREE_TRIAL) which the caller treats as "no
 * paid current plan" — a change is still allowed as long as it's a real move.
 */
async function resolveCurrent(subscription: LoadedSubscription): Promise<{
  plan: string;
  interval: AdminBillingInterval;
}> {
  const mapped = await mapAdminStripePriceId(subscription.stripePriceId);
  const plan = isAdminPaidPlan(subscription.plan)
    ? subscription.plan
    : mapped?.plan || subscription.plan;
  const interval: AdminBillingInterval =
    subscription.billingInterval === "YEAR" || subscription.billingInterval === "MONTH"
      ? subscription.billingInterval
      : mapped?.interval || "MONTH";
  return { plan, interval };
}

/** Compute the Stripe proration amount for moving the primary item to a new price. */
async function previewProration(
  stripe: Stripe,
  stripeSub: Stripe.Subscription,
  primaryItemId: string,
  newPriceId: string,
): Promise<{ amount: number; currency: string } | null> {
  try {
    const upcoming = await stripe.invoices.retrieveUpcoming({
      customer: typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id,
      subscription: stripeSub.id,
      subscription_items: [{ id: primaryItemId, price: newPriceId }],
      subscription_proration_behavior: "create_prorations",
    });
    return { amount: upcoming.amount_due ?? 0, currency: upcoming.currency || "usd" };
  } catch {
    // Preview is best-effort — the confirm dialog still states the plan move
    // even if Stripe can't compute an exact proration figure right now.
    return null;
  }
}

/** Resolve the billable item on the Stripe subscription that we will re-price. */
function findPrimaryItem(
  stripeSub: Stripe.Subscription,
  currentPriceId: string | null,
): Stripe.SubscriptionItem | null {
  if (currentPriceId) {
    const match = stripeSub.items.data.find((item) => item.price.id === currentPriceId);
    if (match) return match;
  }
  return stripeSub.items.data[0] || null;
}

/** Read-only preview of a plan change for the confirm dialog. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" });
    const { id: subscriptionId } = await params;

    const parsedQuery = changePlanQuerySchema.safeParse({
      targetPlan: request.nextUrl.searchParams.get("targetPlan"),
      targetInterval: request.nextUrl.searchParams.get("targetInterval"),
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "targetPlan must be INDIVIDUAL/FAMILY/PRO and targetInterval MONTH/YEAR." },
        { status: 400 },
      );
    }
    const { targetPlan, targetInterval } = parsedQuery.data;

    const subscription = await loadSubscription(subscriptionId);
    if (
      !subscription ||
      subscription.provider !== "STRIPE" ||
      !subscription.stripeSubscriptionId
    ) {
      return NextResponse.json(
        { changeable: false, reason: "no_stripe_subscription" },
        { status: 200 },
      );
    }
    if (subscription.status !== "ACTIVE" && subscription.status !== "CANCEL_AT_PERIOD_END") {
      return NextResponse.json(
        { changeable: false, reason: "inactive_subscription" },
        { status: 200 },
      );
    }

    const current = await resolveCurrent(subscription);
    if (current.plan === targetPlan && current.interval === targetInterval) {
      return NextResponse.json(
        { changeable: false, reason: "already_on_plan", currentPlan: current.plan, currentInterval: current.interval },
        { status: 200 },
      );
    }

    // Resolve the target price SERVER-SIDE from runtime config.
    const newPriceId = await resolveAdminStripePriceId(targetPlan, targetInterval);
    if (!newPriceId) {
      return NextResponse.json(
        { changeable: false, reason: "price_not_configured", currentPlan: current.plan, currentInterval: current.interval },
        { status: 200 },
      );
    }

    const stripe = await getAdminStripeClient();
    let stripeSub: Stripe.Subscription;
    try {
      stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    } catch (stripeError: any) {
      console.error("Stripe subscription retrieve failed (change-plan preview)", {
        userId: subscription.userId,
        maskedStripeSubscriptionId: maskProviderIdentifier(subscription.stripeSubscriptionId),
        type: stripeError?.type || null,
        code: stripeError?.code || null,
      });
      return NextResponse.json(
        { error: "Failed to load the subscription from the billing provider. Please try again." },
        { status: 502 },
      );
    }

    const primaryItem = findPrimaryItem(stripeSub, subscription.stripePriceId);
    if (!primaryItem) {
      return NextResponse.json(
        { changeable: false, reason: "no_billable_item" },
        { status: 200 },
      );
    }

    const proration = await previewProration(stripe, stripeSub, primaryItem.id, newPriceId);
    const targetRank = TIER_RANK[targetPlan];
    const currentRank = isAdminPaidPlan(current.plan) ? TIER_RANK[current.plan] : 0;
    const direction =
      targetRank > currentRank ? "upgrade" : targetRank < currentRank ? "downgrade" : "interval_change";

    return NextResponse.json({
      changeable: true,
      currentPlan: current.plan,
      currentInterval: current.interval,
      targetPlan,
      targetInterval,
      direction,
      maskedTargetPriceId: maskProviderIdentifier(newPriceId),
      prorationAmount: proration?.amount ?? null,
      currency: proration?.currency ?? null,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Change-plan preview failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json({ error: "Failed to load plan-change preview." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    const raw = await request.json().catch(() => null);
    const parsed = changePlanSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid plan-change request." }, { status: 400 });
    }
    const { targetPlan, targetInterval, confirmPassword, mfaCode, backupCode } = parsed.data;
    const { id: subscriptionId } = await params;
    const requestMeta = getAuditRequestMeta(request);

    // Plan changes move money (immediate proration) — require MFA step-up.
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "billing_subscription_change_plan",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscriptionId,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "step_up_failed",
          targetPlan,
          targetInterval,
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const subscription = await loadSubscription(subscriptionId);
    if (
      !subscription ||
      subscription.provider !== "STRIPE" ||
      !subscription.stripeSubscriptionId
    ) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscription?.id || subscriptionId,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "no_stripe_subscription",
          targetPlan,
          targetInterval,
          before: auditSnapshot(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "This subscription is not backed by Stripe and cannot change plan." },
        { status: 409 },
      );
    }
    if (subscription.status !== "ACTIVE" && subscription.status !== "CANCEL_AT_PERIOD_END") {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "inactive_subscription",
          targetPlan,
          targetInterval,
          before: auditSnapshot(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Plan changes are only available on an active subscription." },
        { status: 409 },
      );
    }
    const userId = subscription.userId;

    const current = await resolveCurrent(subscription);
    if (current.plan === targetPlan && current.interval === targetInterval) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "already_on_plan",
          targetPlan,
          targetInterval,
          targetUserId: userId,
          before: auditSnapshot(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "This subscription is already on the requested plan and interval." },
        { status: 409 },
      );
    }

    // Re-resolve the price SERVER-SIDE (never trust a client price id).
    const newPriceId = await resolveAdminStripePriceId(targetPlan, targetInterval);
    if (!newPriceId) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "price_not_configured",
          targetPlan,
          targetInterval,
          targetUserId: userId,
          before: auditSnapshot(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: `No Stripe price is configured for ${targetPlan} (${targetInterval}). Configure it in Runtime Config first.` },
        { status: 409 },
      );
    }

    const operationId =
      `admin-subscription-change-plan:${subscription.id}:${newPriceId}:v${subscription.version}`
        .replace(/[^A-Za-z0-9:_-]/g, "_")
        .slice(0, 255);
    const before = auditSnapshot(subscription);

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_CHANGE_PLAN_STARTED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: {
        operation: "billing_subscription_change_plan",
        status: "started",
        operationId,
        targetUserId: userId,
        fromPlan: current.plan,
        fromInterval: current.interval,
        targetPlan,
        targetInterval,
        maskedTargetPriceId: maskProviderIdentifier(newPriceId),
        before,
      },
      request: requestMeta,
    });

    const stripe = await getAdminStripeClient();
    let stripeSub: Stripe.Subscription;
    try {
      stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    } catch (stripeError: any) {
      console.error("Stripe subscription retrieve failed (change-plan)", {
        userId,
        maskedStripeSubscriptionId: maskProviderIdentifier(subscription.stripeSubscriptionId),
        type: stripeError?.type || null,
        code: stripeError?.code || null,
      });
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "provider_fetch_failed",
          operationId,
          targetUserId: userId,
          targetPlan,
          targetInterval,
          before,
          errorType: stripeError?.type || null,
          errorCode: stripeError?.code || null,
        },
        request: requestMeta,
      }).catch(() => null);
      return NextResponse.json(
        { error: "Failed to load the subscription from the billing provider. Please try again." },
        { status: 502 },
      );
    }

    const primaryItem = findPrimaryItem(stripeSub, subscription.stripePriceId);
    if (!primaryItem) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "no_billable_item",
          operationId,
          targetUserId: userId,
          targetPlan,
          targetInterval,
          before,
        },
        request: requestMeta,
      }).catch(() => null);
      return NextResponse.json(
        { error: "Subscription has no billable item to re-price." },
        { status: 409 },
      );
    }
    // Guard against a no-op at the provider level (the item already carries the
    // resolved target price — e.g. a partially-applied earlier attempt).
    if (primaryItem.price.id === newPriceId) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "already_on_price",
          operationId,
          targetUserId: userId,
          targetPlan,
          targetInterval,
          before,
        },
        request: requestMeta,
      }).catch(() => null);
      return NextResponse.json(
        { error: "The subscription's billable item already uses the target price." },
        { status: 409 },
      );
    }

    let updatedStripeSub: Stripe.Subscription;
    try {
      updatedStripeSub = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          items: [{ id: primaryItem.id, price: newPriceId }],
          proration_behavior: "create_prorations",
          cancel_at_period_end: false,
        },
        { idempotencyKey: operationId },
      );
    } catch (stripeError: any) {
      console.error("Stripe subscription update failed (change-plan)", {
        userId,
        maskedStripeSubscriptionId: maskProviderIdentifier(subscription.stripeSubscriptionId),
        type: stripeError?.type || null,
        code: stripeError?.code || null,
      });
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "provider_update_failed",
          operationId,
          targetUserId: userId,
          targetPlan,
          targetInterval,
          maskedTargetPriceId: maskProviderIdentifier(newPriceId),
          before,
          errorType: stripeError?.type || null,
          errorCode: stripeError?.code || null,
        },
        request: requestMeta,
      }).catch(() => null);
      return NextResponse.json(
        { error: "Failed to change the plan with the billing provider. Please try again." },
        { status: 502 },
      );
    }

    const periodEnd = updatedStripeSub.current_period_end
      ? new Date(updatedStripeSub.current_period_end * 1000)
      : subscription.currentPeriodEndsAt;
    const now = new Date();

    let updated: any;
    try {
      updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: targetPlan,
          billingInterval: targetInterval,
          stripePriceId: newPriceId,
          billingProductId: newPriceId,
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
          autoRenew: true,
          canceledAt: null,
          currentPeriodEndsAt: periodEnd,
          stripeCurrentPeriodEnd: periodEnd,
          lastSyncedAt: now,
          version: { increment: 1 },
        },
        select: returnSelect,
      });
    } catch (dbError: any) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_CHANGE_PLAN_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_change_plan",
          status: "failed",
          reasonCode: "db_update_failed_after_provider_success",
          operationId,
          targetUserId: userId,
          targetPlan,
          targetInterval,
          maskedTargetPriceId: maskProviderIdentifier(newPriceId),
          before,
          errorCode: dbError?.code || null,
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Plan changed with the provider, but local billing state could not be saved. Re-sync before retrying." },
        { status: 500 },
      );
    }

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_CHANGE_PLAN_COMPLETED",
      entityType: "Subscription",
      entityId: updated.id,
      metadata: {
        operation: "billing_subscription_change_plan",
        status: "completed",
        operationId,
        targetUserId: userId,
        fromPlan: current.plan,
        fromInterval: current.interval,
        targetPlan,
        targetInterval,
        maskedTargetPriceId: maskProviderIdentifier(newPriceId),
        before,
        after: auditSnapshot(updated),
      },
      request: requestMeta,
    });

    return NextResponse.json({ subscription: updated, plan: targetPlan, billingInterval: targetInterval });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Subscription change-plan failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to change subscription plan. Please try again." },
      { status: 500 },
    );
  }
}

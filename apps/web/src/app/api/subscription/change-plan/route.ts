import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import {
  buildStripeIdempotencyKey,
  requireStripeSecretKeyForMutation,
} from "@/lib/billing-config";
import {
  billingIntervalToCycle,
  getStripePriceIdForPlanAndInterval,
  type StripeBillingInterval,
} from "@/lib/billing";
import { isPaidBillingPlan, type PaidBillingPlan } from "@/lib/shared-billing";
import { reconcileSeatsForOwner } from "@/lib/workspace-ownership";
import { captureMessage } from "@/lib/sentry";
import {
  isMobileAppClient,
  mobileExternalBillingNotAllowedResponse,
} from "@/lib/mobile-external-billing-guard";
import {
  isMissingDbColumnError,
  warnSchemaCompatibilityFallback,
} from "@/lib/db-schema-compat";
import {
  getStripeSubscriptionCurrentPeriodEndDate,
  getStripeSubscriptionCurrentPeriodEndUnix,
  getStripeSubscriptionCurrentPeriodStartUnix,
} from "@/lib/stripe-subscription-period";

// POST /api/subscription/change-plan
// Body: {
//   targetPlan: "INDIVIDUAL" | "FAMILY" | "PRO",
//   targetInterval?: "MONTH" | "YEAR",
//   acceptedSubscriptionTerms: true
// }
//
// Changes the tier of an existing Stripe subscription. UPGRADES (a higher tier,
// or month->year) apply immediately with Stripe proration and restore any
// OVERFLOW members. DOWNGRADES (a lower tier, or year->month) are DEFERRED to
// period end via a Stripe subscription schedule: the customer keeps everything
// they paid for until the period ends, then the lower plan starts — no data is
// lost and no member is demoted early (the webhook reconciles seats when the
// phase transitions). New subscribers must use checkout first; self-serve
// Family/Pro additionally requires the STRIPE_PRICE_FAMILY_/PRO_ price IDs.

const TIER_RANK: Record<string, number> = { INDIVIDUAL: 1, FAMILY: 2, PRO: 3 };

function scheduleIdFromStripeSub(stripeSub: Stripe.Subscription): string | null {
  const schedule = stripeSub.schedule;
  if (!schedule) return null;
  return typeof schedule === "string" ? schedule : schedule.id;
}

async function releaseAttachedSchedule(
  stripe: Stripe,
  stripeSub: Stripe.Subscription,
  existingScheduleId?: string | null,
): Promise<void> {
  const scheduleId = existingScheduleId || scheduleIdFromStripeSub(stripeSub);
  if (!scheduleId) return;
  await stripe.subscriptionSchedules.release(scheduleId);
}

async function retrieveOrCreateSchedule(
  stripe: Stripe,
  stripeSub: Stripe.Subscription,
  existingScheduleId?: string | null,
): Promise<Stripe.SubscriptionSchedule> {
  const scheduleId = existingScheduleId || scheduleIdFromStripeSub(stripeSub);
  if (scheduleId) return stripe.subscriptionSchedules.retrieve(scheduleId);
  return stripe.subscriptionSchedules.create({ from_subscription: stripeSub.id });
}

interface LocalSub {
  userId: string;
  version?: number | null;
  currentPeriodEndsAt: Date | null;
  billingInterval?: string | null;
}

async function applyImmediatePlanChange(input: {
  stripe: Stripe;
  userId: string;
  subscription: LocalSub;
  stripeSub: Stripe.Subscription;
  primaryItemId: string;
  newPriceId: string;
  targetPlan: PaidBillingPlan;
  targetInterval: StripeBillingInterval;
  now: Date;
}): Promise<NextResponse> {
  const { stripe, userId, subscription, stripeSub, primaryItemId, newPriceId, targetPlan, targetInterval, now } = input;

  const updated = await stripe.subscriptions.update(
    stripeSub.id,
    {
      items: [{ id: primaryItemId, price: newPriceId }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
    },
    {
      idempotencyKey: buildStripeIdempotencyKey([
        "subscription-change-plan-immediate",
        stripeSub.id,
        newPriceId,
        String(subscription.version ?? 0),
      ]),
    },
  );

  const periodEnd = getStripeSubscriptionCurrentPeriodEndDate(updated) || subscription.currentPeriodEndsAt;

  const data = {
    plan: targetPlan,
    billingInterval: targetInterval,
    pendingBillingInterval: null,
    pendingBillingIntervalEffectiveAt: null,
    stripeSubscriptionScheduleId: null,
    stripePriceId: newPriceId,
    billingProductId: newPriceId,
    currentPeriodEndsAt: periodEnd,
    stripeCurrentPeriodEnd: periodEnd,
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    autoRenew: true,
    canceledAt: null,
    lastSyncedAt: now,
    version: { increment: 1 },
  } as const;

  try {
    await prisma.subscription.update({ where: { userId }, data });
  } catch (error) {
    if (!isMissingDbColumnError(error)) throw error;
    warnSchemaCompatibilityFallback("subscription:change-plan-immediate-write", error);
    await prisma.subscription.update({
      where: { userId },
      data: {
        plan: targetPlan,
        billingInterval: targetInterval,
        stripePriceId: newPriceId,
        billingProductId: newPriceId,
        currentPeriodEndsAt: periodEnd,
        stripeCurrentPeriodEnd: periodEnd,
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        autoRenew: true,
        canceledAt: null,
        lastSyncedAt: now,
        version: { increment: 1 },
      },
    });
  }

  // Upgrade widens the seat limit → restore any OVERFLOW members. Best-effort.
  await reconcileSeatsForOwner(userId).catch(() => {});

  return NextResponse.json({
    status: "ACTIVE",
    plan: targetPlan,
    billingInterval: targetInterval,
    cycle: billingIntervalToCycle(targetInterval),
    currentPeriodEndsAt: periodEnd,
    applied: "immediate",
  });
}

export async function POST(request: NextRequest) {
  try {
    if (isMobileAppClient(request)) {
      return mobileExternalBillingNotAllowedResponse();
    }

    const userId = await requireDbUserId();

    const rlKey = getRateLimitKey(request, "subscription:change-plan");
    const rl = await rateLimit(rlKey, { limit: 5, windowSeconds: 60, failClosed: true });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.acceptedSubscriptionTerms !== true) {
      return NextResponse.json(
        { code: "TERMS_NOT_ACCEPTED", error: "Please accept the subscription terms before changing your plan." },
        { status: 400 },
      );
    }

    const targetPlan = typeof body?.targetPlan === "string" ? body.targetPlan : "";
    if (!isPaidBillingPlan(targetPlan)) {
      return NextResponse.json({ error: "targetPlan must be INDIVIDUAL, FAMILY, or PRO." }, { status: 400 });
    }
    const rawInterval = body?.targetInterval;
    const explicitInterval =
      rawInterval === "YEAR" || rawInterval === "MONTH" ? (rawInterval as StripeBillingInterval) : null;

    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription?.stripeSubscriptionId || subscription.provider !== "STRIPE") {
      return NextResponse.json(
        { error: "No active subscription to change. Start a subscription from checkout first.", code: "NO_STRIPE_SUBSCRIPTION" },
        { status: 400 },
      );
    }
    if (subscription.status !== "ACTIVE" && subscription.status !== "CANCEL_AT_PERIOD_END") {
      return NextResponse.json(
        { error: "Plan changes are only available on an active subscription." },
        { status: 400 },
      );
    }

    const currentPlan = String(subscription.plan || "INDIVIDUAL");
    const currentInterval: StripeBillingInterval = subscription.billingInterval === "YEAR" ? "YEAR" : "MONTH";
    const targetInterval = explicitInterval || currentInterval;

    if (targetPlan === currentPlan && targetInterval === currentInterval) {
      return NextResponse.json({ error: "You are already on this plan." }, { status: 400 });
    }

    const newPriceId = await getStripePriceIdForPlanAndInterval(targetPlan, targetInterval);
    if (!newPriceId) {
      return NextResponse.json(
        { error: `${targetPlan} is not available for self-serve checkout yet.`, code: "PLAN_NOT_AVAILABLE" },
        { status: 503 },
      );
    }

    const stripeSecretKey = requireStripeSecretKeyForMutation(
      await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
    );
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const primaryItem = subscription.stripePriceId
      ? stripeSub.items.data.find((item) => item.price.id === subscription.stripePriceId)
      : stripeSub.items.data[0];
    if (!primaryItem) {
      return NextResponse.json({ error: "Subscription has no billable items." }, { status: 409 });
    }

    const now = new Date();
    const targetRank = TIER_RANK[targetPlan] ?? 0;
    const currentRank = TIER_RANK[currentPlan] ?? 0;
    // Defer (period-end) when the change reduces the customer's current
    // entitlement: a lower tier, or dropping the annual commitment to monthly.
    const isReduction =
      targetRank < currentRank ||
      (targetRank === currentRank && currentInterval === "YEAR" && targetInterval === "MONTH");

    if (isReduction) {
      const periodEndUnix = getStripeSubscriptionCurrentPeriodEndUnix(stripeSub);
      const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : subscription.currentPeriodEndsAt;
      // No period left → nothing to defer; apply now so the customer actually
      // moves to the lower plan instead of silently auto-renewing the old one.
      if (!periodEndUnix || !periodEnd || periodEnd.getTime() <= now.getTime()) {
        await releaseAttachedSchedule(stripe, stripeSub, subscription.stripeSubscriptionScheduleId);
        return await applyImmediatePlanChange({
          stripe, userId, subscription, stripeSub,
          primaryItemId: primaryItem.id, newPriceId, targetPlan, targetInterval, now,
        });
      }

      const schedule = await retrieveOrCreateSchedule(stripe, stripeSub, subscription.stripeSubscriptionScheduleId);
      const currentPhaseStart =
        schedule.current_phase?.start_date ||
        getStripeSubscriptionCurrentPeriodStartUnix(stripeSub) ||
        Math.floor(now.getTime() / 1000);
      const quantity = primaryItem.quantity || 1;

      await stripe.subscriptionSchedules.update(
        schedule.id,
        {
          end_behavior: "release",
          proration_behavior: "none",
          metadata: {
            locateflow_user_id: userId,
            locateflow_pending_plan: targetPlan,
            locateflow_pending_billing_interval: targetInterval,
          },
          phases: [
            {
              start_date: currentPhaseStart,
              end_date: periodEndUnix,
              items: [{ price: primaryItem.price.id, quantity }],
              proration_behavior: "none",
            },
            {
              iterations: 1,
              items: [{ price: newPriceId, quantity }],
              billing_cycle_anchor: "phase_start",
              proration_behavior: "none",
              metadata: { plan: targetPlan, billingInterval: targetInterval },
            },
          ],
        },
        {
          idempotencyKey: buildStripeIdempotencyKey([
            "subscription-change-plan-schedule",
            schedule.id,
            `${currentPlan}-${currentInterval}->${targetPlan}-${targetInterval}`,
            String(periodEndUnix),
          ]),
        },
      );

      // Track the scheduled change locally. The plan stays current until the
      // phase transition (the webhook maps the new price -> plan and reconciles
      // seats then), so members keep access until period end. If we can't
      // persist, release the schedule so we never show an unhonored "scheduled".
      try {
        await prisma.subscription.update({
          where: { userId },
          data: {
            stripeSubscriptionScheduleId: schedule.id,
            pendingBillingInterval: targetInterval,
            pendingPlan: targetPlan,
            pendingBillingIntervalEffectiveAt: periodEnd,
            currentPeriodEndsAt: periodEnd,
            stripeCurrentPeriodEnd: periodEnd,
            status: "ACTIVE",
            cancelAtPeriodEnd: false,
            autoRenew: true,
            canceledAt: null,
            lastSyncedAt: now,
            version: { increment: 1 },
          },
        });
      } catch (error) {
        if (!isMissingDbColumnError(error)) throw error;
        warnSchemaCompatibilityFallback("subscription:change-plan-schedule-write", error);
        try {
          await stripe.subscriptionSchedules.release(schedule.id);
        } catch (rollbackError) {
          captureMessage(
            `[CHANGE_PLAN] Failed to release orphaned schedule ${schedule.id}: ${
              (rollbackError as Error)?.message || "unknown"
            }`,
            "error",
          );
        }
        return NextResponse.json(
          {
            error: "Plan change could not be saved. No changes were made — please try again shortly.",
            code: "PENDING_CHANGE_PERSIST_FAILED",
          },
          { status: 503 },
        );
      }

      return NextResponse.json({
        status: "ACTIVE",
        plan: currentPlan,
        pendingPlan: targetPlan,
        pendingBillingInterval: targetInterval,
        pendingChangeEffectiveAt: periodEnd,
        currentPeriodEndsAt: periodEnd,
        applied: "scheduled",
      });
    }

    // Upgrade (or month->year on the same tier): apply immediately with proration.
    await releaseAttachedSchedule(stripe, stripeSub, subscription.stripeSubscriptionScheduleId);
    return await applyImmediatePlanChange({
      stripe, userId, subscription, stripeSub,
      primaryItemId: primaryItem.id, newPriceId, targetPlan, targetInterval, now,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.name === "BILLING_CONFIG_ERROR") {
      const reason = error?.message || "Stripe not configured";
      captureMessage(`[CHANGE_PLAN] Stripe config rejected: ${reason}`, "error");
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    console.error("Subscription change-plan error:", error);
    return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
  }
}

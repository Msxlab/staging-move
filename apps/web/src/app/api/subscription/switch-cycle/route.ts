import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { requireStripeSecretKeyForMutation } from "@/lib/billing-config";
import {
  billingIntervalToCycle,
  getStripePriceIdForPlanAndInterval,
  type StripeBillingInterval,
} from "@/lib/billing";
import { captureMessage } from "@/lib/sentry";
import {
  isMobileAppClient,
  mobileExternalBillingNotAllowedResponse,
} from "@/lib/mobile-external-billing-guard";
import {
  isMissingDbColumnError,
  warnSchemaCompatibilityFallback,
} from "@/lib/db-schema-compat";

// POST /api/subscription/switch-cycle
// Body: { targetInterval: "MONTH" | "YEAR" }
//
// Switches the user's existing Stripe subscription between monthly and
// yearly billing. Monthly -> yearly is an immediate upgrade with Stripe
// proration. Yearly -> monthly is a deferred downgrade: keep the already
// paid annual access until current_period_end, then start monthly billing.
function scheduleIdFromStripeSub(stripeSub: Stripe.Subscription) {
  const schedule = stripeSub.schedule;
  if (!schedule) return null;
  return typeof schedule === "string" ? schedule : schedule.id;
}

async function retrieveOrCreateSchedule(
  stripe: Stripe,
  stripeSub: Stripe.Subscription,
  existingScheduleId?: string | null,
) {
  const scheduleId = existingScheduleId || scheduleIdFromStripeSub(stripeSub);
  if (scheduleId) {
    return stripe.subscriptionSchedules.retrieve(scheduleId);
  }
  return stripe.subscriptionSchedules.create({ from_subscription: stripeSub.id });
}

async function releaseAttachedSchedule(
  stripe: Stripe,
  stripeSub: Stripe.Subscription,
  existingScheduleId?: string | null,
) {
  const scheduleId = existingScheduleId || scheduleIdFromStripeSub(stripeSub);
  if (!scheduleId) return;
  await stripe.subscriptionSchedules.release(scheduleId);
}

export async function POST(request: NextRequest) {
  try {
    if (isMobileAppClient(request)) {
      return mobileExternalBillingNotAllowedResponse();
    }

    const userId = await requireDbUserId();

    const rlKey = getRateLimitKey(request, "subscription:switch-cycle");
    const rl = await rateLimit(rlKey, { limit: 5, windowSeconds: 60, failClosed: true });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const targetInterval = body?.targetInterval as StripeBillingInterval | undefined;
    if (targetInterval !== "MONTH" && targetInterval !== "YEAR") {
      return NextResponse.json({ error: "targetInterval must be MONTH or YEAR." }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });
    if (
      !subscription?.stripeSubscriptionId ||
      subscription.provider !== "STRIPE" ||
      subscription.plan !== "INDIVIDUAL"
    ) {
      return NextResponse.json(
        { error: "This action is available only for Stripe subscriptions." },
        { status: 400 },
      );
    }

    // Only allow switching from an active paid plan. Trials get charged on
    // their own schedule and we don't want to disturb that mid-trial.
    if (subscription.status !== "ACTIVE" && subscription.status !== "CANCEL_AT_PERIOD_END") {
      return NextResponse.json(
        { error: "Plan switching is only available on an active subscription." },
        { status: 400 },
      );
    }

    if (subscription.billingInterval === targetInterval) {
      if (subscription.pendingBillingInterval === targetInterval) {
        return NextResponse.json(
          { error: "This billing cycle change is already scheduled." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "You are already on this billing cycle." },
        { status: 400 },
      );
    }

    const newPriceId = await getStripePriceIdForPlanAndInterval(
      "INDIVIDUAL",
      targetInterval,
    );
    if (!newPriceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for ${targetInterval}.` },
        { status: 503 },
      );
    }

    const stripeSecretKey = requireStripeSecretKeyForMutation(
      await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
    );
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

    // Load the subscription so we know which item to swap. A LocateFlow
    // subscription has exactly one line item (the plan), but we look it up
    // by ID instead of indexing [0] to stay robust against future add-ons.
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const primaryItem = subscription.stripePriceId
      ? stripeSub.items.data.find((item) => item.price.id === subscription.stripePriceId)
      : stripeSub.items.data[0];
    if (!primaryItem) {
      return NextResponse.json(
        { error: "Subscription has no billable items." },
        { status: 409 },
      );
    }

    const now = new Date();

    if (subscription.billingInterval === "YEAR" && targetInterval === "MONTH") {
      const periodEndUnix = stripeSub.current_period_end;
      const periodEnd = periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : subscription.currentPeriodEndsAt;
      if (!periodEndUnix || !periodEnd || periodEnd.getTime() <= now.getTime()) {
        return NextResponse.json(
          { error: "Could not determine the annual period end for scheduling." },
          { status: 409 },
        );
      }

      const schedule = await retrieveOrCreateSchedule(
        stripe,
        stripeSub,
        subscription.stripeSubscriptionScheduleId,
      );
      const currentPhaseStart =
        schedule.current_phase?.start_date ||
        stripeSub.current_period_start ||
        Math.floor(now.getTime() / 1000);
      const quantity = primaryItem.quantity || 1;

      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release",
        proration_behavior: "none",
        metadata: {
          locateflow_user_id: userId,
          locateflow_pending_billing_interval: "MONTH",
        },
        phases: [
          {
            start_date: currentPhaseStart,
            end_date: periodEndUnix,
            items: [{ price: primaryItem.price.id, quantity }],
            proration_behavior: "none",
            metadata: {
              billingInterval: "YEAR",
              pendingBillingInterval: "MONTH",
            },
          },
          {
            iterations: 1,
            items: [{ price: newPriceId, quantity }],
            billing_cycle_anchor: "phase_start",
            proration_behavior: "none",
            metadata: {
              billingInterval: "MONTH",
              pendingBillingInterval: "",
            },
          },
        ],
      });

      try {
        await prisma.subscription.update({
          where: { userId },
          data: {
            stripeSubscriptionScheduleId: schedule.id,
            pendingBillingInterval: "MONTH",
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
        warnSchemaCompatibilityFallback("subscription:switch-cycle-pending-write", error);
        await prisma.subscription.update({
          where: { userId },
          data: {
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

      return NextResponse.json({
        status: "ACTIVE",
        billingInterval: "YEAR",
        cycle: "yearly",
        pendingBillingInterval: "MONTH",
        pendingBillingIntervalEffectiveAt: periodEnd,
        currentPeriodEndsAt: periodEnd,
        scheduled: true,
      });
    }

    await releaseAttachedSchedule(stripe, stripeSub, subscription.stripeSubscriptionScheduleId);

    const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{ id: primaryItem.id, price: newPriceId }],
      proration_behavior: "create_prorations",
      // Resume auto-renewal when switching — if the user had set the plan
      // to cancel at period end, switching cycles is a clear "I want to
      // stay" signal, so we clear the cancel flag.
      cancel_at_period_end: false,
    });

    const periodEnd = updated.current_period_end
      ? new Date(updated.current_period_end * 1000)
      : subscription.currentPeriodEndsAt;
    const newCycle = billingIntervalToCycle(targetInterval);

    try {
      await prisma.subscription.update({
        where: { userId },
        data: {
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
        },
      });
    } catch (error) {
      if (!isMissingDbColumnError(error)) throw error;
      warnSchemaCompatibilityFallback("subscription:switch-cycle-immediate-write", error);
      await prisma.subscription.update({
        where: { userId },
        data: {
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

    return NextResponse.json({
      status: "ACTIVE",
      billingInterval: targetInterval,
      cycle: newCycle,
      currentPeriodEndsAt: periodEnd,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.name === "BILLING_CONFIG_ERROR") {
      const reason = error?.message || "Stripe not configured";
      captureMessage(`[SWITCH_CYCLE] Stripe config rejected: ${reason}`, "error");
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    console.error("Subscription switch-cycle error:", error);
    return NextResponse.json({ error: "Failed to switch billing cycle" }, { status: 500 });
  }
}

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
// Body: { targetInterval: "MONTH" | "YEAR", acceptedSubscriptionTerms: true }
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

type LocalSubscriptionForSwitch = {
  userId: string;
  version?: number | null;
  currentPeriodEndsAt: Date | null;
};

async function applyImmediateCycleSwap(input: {
  stripe: Stripe;
  userId: string;
  subscription: LocalSubscriptionForSwitch;
  stripeSub: Stripe.Subscription;
  primaryItemId: string;
  newPriceId: string;
  targetInterval: StripeBillingInterval;
  now: Date;
}) {
  const {
    stripe,
    userId,
    subscription,
    stripeSub,
    primaryItemId,
    newPriceId,
    targetInterval,
    now,
  } = input;

  const updated = await stripe.subscriptions.update(
    stripeSub.id,
    {
      items: [{ id: primaryItemId, price: newPriceId }],
      proration_behavior: "create_prorations",
      // Resume auto-renewal when switching — if the user had set the plan
      // to cancel at period end, switching cycles is a clear "I want to
      // stay" signal, so we clear the cancel flag.
      cancel_at_period_end: false,
    },
    {
      idempotencyKey: buildStripeIdempotencyKey([
        "subscription-switch-immediate",
        stripeSub.id,
        newPriceId,
        String(subscription.version ?? 0),
      ]),
    },
  );

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
    // Stripe already charged the proration. The webhook will repair the
    // local row from the new price on the next customer.subscription.updated
    // delivery — derivedBillingInterval will match targetInterval and the
    // sync writes billingInterval/stripePriceId regardless of the
    // pending-column existence. Keep the user-visible response truthful.
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
    if (body?.acceptedSubscriptionTerms !== true) {
      return NextResponse.json(
        { code: "TERMS_NOT_ACCEPTED", error: "Please accept the subscription terms before changing your billing cycle." },
        { status: 400 },
      );
    }

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
      // If the annual period has already ended (or there is no period at
      // all), there's nothing left to defer — Stripe is about to auto-renew
      // the yearly plan in the next webhook tick. Fall through to the
      // immediate-swap path so the user actually gets monthly billing
      // instead of getting a silent 409 and then being charged for another
      // year.
      if (!periodEndUnix || !periodEnd || periodEnd.getTime() <= now.getTime()) {
        await releaseAttachedSchedule(
          stripe,
          stripeSub,
          subscription.stripeSubscriptionScheduleId,
        );
        return await applyImmediateCycleSwap({
          stripe,
          userId,
          subscription,
          stripeSub,
          primaryItemId: primaryItem.id,
          newPriceId,
          targetInterval,
          now,
        });
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

      await stripe.subscriptionSchedules.update(
        schedule.id,
        {
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
        },
        {
          idempotencyKey: buildStripeIdempotencyKey([
            "subscription-schedule",
            schedule.id,
            "YEAR-to-MONTH",
            String(periodEndUnix),
          ]),
        },
      );

      // Rollback path: the Stripe schedule is live, but if our DB cannot
      // record the pending interval we have no way to detect the phase
      // transition later (the webhook clears pendingBillingInterval by
      // matching it against the derived price interval). Releasing the
      // schedule reverts Stripe to the original yearly subscription
      // without phase 2, so the user's billing is unchanged. Better to
      // surface 503 than leave an orphan schedule and a misleading
      // "scheduled: true" response that we can't honor.
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
        try {
          await stripe.subscriptionSchedules.release(schedule.id);
        } catch (rollbackError) {
          captureMessage(
            `[SWITCH_CYCLE] Failed to release orphaned schedule ${schedule.id}: ${
              (rollbackError as Error)?.message || "unknown"
            }`,
            "error",
          );
        }
        return NextResponse.json(
          {
            error:
              "Billing cycle change could not be saved. No changes were made — please try again shortly.",
            code: "PENDING_INTERVAL_PERSIST_FAILED",
          },
          { status: 503 },
        );
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

    return await applyImmediateCycleSwap({
      stripe,
      userId,
      subscription,
      stripeSub,
      primaryItemId: primaryItem.id,
      newPriceId,
      targetInterval,
      now,
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

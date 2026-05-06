import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { requireStripeSecretKeyForMutation } from "@/lib/billing-config";
import { captureMessage } from "@/lib/sentry";
import {
  sendSubscriptionCanceledEmail,
  sendSubscriptionResumedEmail,
} from "@/lib/email-service";

type SubscriptionAction = "cancel_trial" | "cancel_renewal" | "resume_renewal";

function formatDateForEmail(date: Date | null | undefined, locale: string | null | undefined) {
  if (!date) return null;
  const lang = (locale || "").toLowerCase().startsWith("es") ? "es-US" : "en-US";
  return date.toLocaleDateString(lang, { year: "numeric", month: "long", day: "numeric" });
}

function formatPlanLabel(plan: string | null | undefined) {
  return (plan || "subscription")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function fireAndLogEmail(promise: Promise<unknown>, context: string) {
  void promise.catch((err) => {
    console.error(`[SUBSCRIPTION_ACTION] Email dispatch failed (${context}):`, err);
    captureMessage(`[SUBSCRIPTION_ACTION] Email dispatch failed (${context})`, "warning");
  });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const rlKey = getRateLimitKey(request, "subscription:action");
    const rl = await rateLimit(rlKey, { limit: 8, windowSeconds: 60, failClosed: true });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action as SubscriptionAction;
    if (!["cancel_trial", "cancel_renewal", "resume_renewal"].includes(action)) {
      return NextResponse.json({ error: "Invalid subscription action." }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        user: { select: { email: true, firstName: true, preferredLocale: true, deletedAt: true } },
      },
    });
    if (!subscription?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "This action is available only for Stripe subscriptions." },
        { status: 400 },
      );
    }

    const stripeSecretKey = requireStripeSecretKeyForMutation(
      await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
    );
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const now = new Date();
    const isTrial = subscription.status === "TRIALING" || subscription.status === "TRIAL_CANCELED";

    if (action === "resume_renewal") {
      const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
      const periodEnd = updated.current_period_end ? new Date(updated.current_period_end * 1000) : subscription.currentPeriodEndsAt;
      const nextStatus = isTrial && subscription.trialEndsAt && subscription.trialEndsAt > now ? "TRIALING" : "ACTIVE";
      await prisma.subscription.update({
        where: { userId },
        data: {
          status: nextStatus,
          cancelAtPeriodEnd: false,
          autoRenew: true,
          currentPeriodEndsAt: periodEnd,
          stripeCurrentPeriodEnd: periodEnd,
          canceledAt: null,
          lastSyncedAt: now,
          version: { increment: 1 },
        },
      });
      if (subscription.user?.email && !subscription.user.deletedAt) {
        fireAndLogEmail(
          sendSubscriptionResumedEmail({
            userEmail: subscription.user.email,
            userName: subscription.user.firstName || "there",
            planLabel: formatPlanLabel(subscription.plan),
            renewsOn: formatDateForEmail(periodEnd, subscription.user.preferredLocale),
            locale: subscription.user.preferredLocale,
            dedupeKey: `subscription:renewal-resumed:${subscription.stripeSubscriptionId}:${periodEnd?.toISOString().slice(0, 10) || "unknown"}`,
            metadata: {
              userId,
              subscriptionId: subscription.id,
              provider: "STRIPE",
              newStatus: nextStatus,
            },
          }),
          `resume_renewal userId=${userId}`,
        );
      }
      return NextResponse.json({ status: nextStatus, autoRenew: true, currentPeriodEndsAt: periodEnd });
    }

    const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    const periodEnd = updated.current_period_end ? new Date(updated.current_period_end * 1000) : subscription.currentPeriodEndsAt;
    const nextStatus = action === "cancel_trial" || isTrial ? "TRIAL_CANCELED" : "CANCEL_AT_PERIOD_END";
    await prisma.subscription.update({
      where: { userId },
      data: {
        status: nextStatus,
        cancelAtPeriodEnd: true,
        autoRenew: false,
        currentPeriodEndsAt: periodEnd,
        stripeCurrentPeriodEnd: periodEnd,
        canceledAt: now,
        lastSyncedAt: now,
        version: { increment: 1 },
      },
    });

    if (subscription.user?.email && !subscription.user.deletedAt) {
      fireAndLogEmail(
        sendSubscriptionCanceledEmail({
          userEmail: subscription.user.email,
          userName: subscription.user.firstName || "there",
          planLabel: formatPlanLabel(subscription.plan),
          accessEndsOn: formatDateForEmail(periodEnd, subscription.user.preferredLocale),
          locale: subscription.user.preferredLocale,
          dedupeKey: `subscription:renewal-canceled:${subscription.stripeSubscriptionId}:${periodEnd?.toISOString().slice(0, 10) || "unknown"}`,
          metadata: {
            userId,
            subscriptionId: subscription.id,
            provider: "STRIPE",
            newStatus: nextStatus,
          },
        }),
        `${action} userId=${userId}`,
      );
    }

    return NextResponse.json({
      status: nextStatus,
      autoRenew: false,
      currentPeriodEndsAt: periodEnd,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.name === "BILLING_CONFIG_ERROR") {
      const reason = error?.message || "Stripe not configured";
      captureMessage(`[SUBSCRIPTION_ACTION] Stripe config rejected: ${reason}`, "error");
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }
    console.error("Subscription action error:", error);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}

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
  isMissingDbColumnError,
  warnSchemaCompatibilityFallback,
} from "@/lib/db-schema-compat";
import { captureMessage } from "@/lib/sentry";
import {
  formatPlanLabel,
  formatDateForEmail,
  fireAndLogEmail as fireAndLogBillingEmail,
} from "@/lib/billing-email-utils";
import {
  sendSubscriptionCanceledEmail,
  sendSubscriptionResumedEmail,
} from "@/lib/email-service";
import { getStripeSubscriptionCurrentPeriodEndDate } from "@/lib/stripe-subscription-period";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";

type SubscriptionAction = "cancel_trial" | "cancel_renewal" | "resume_renewal";

const CANCEL_REASON_CODES = new Set([
  "too_expensive",
  "not_using",
  "missing_feature",
  "found_alternative",
  "just_trying",
  "technical_issue",
  "other",
]);

function normalizeCancelReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase().slice(0, 40);
  return CANCEL_REASON_CODES.has(slug) ? slug : null;
}

function normalizeCancelComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 500);
  return trimmed.length > 0 ? trimmed : null;
}

function fireAndLogEmail(promise: Promise<unknown>, context: string) {
  fireAndLogBillingEmail(promise, context, { logPrefix: "[SUBSCRIPTION_ACTION]", captureWarning: true });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    // Fail closed only when a CONFIGURED Redis limiter is mid-outage; an
    // unconfigured limiter falls back to in-memory rather than 429ing every
    // subscription action during a Redis outage (audit round-2 billing #5).
    const rlKey = getRateLimitKey(request, "subscription:action", { userId });
    const rl = await rateLimit(rlKey, { limit: 8, windowSeconds: 60, failClosed: "if-redis-configured" });
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
      const updated = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        { cancel_at_period_end: false },
        {
          idempotencyKey: buildStripeIdempotencyKey([
            "subscription-resume",
            subscription.stripeSubscriptionId,
            String(subscription.version ?? 0),
          ]),
        },
      );
      const periodEnd = getStripeSubscriptionCurrentPeriodEndDate(updated) || subscription.currentPeriodEndsAt;
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
      // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
      await auditImpersonatedMutation(request, { action: "UPDATE", entityType: "Subscription", entityId: subscription.id, route: "/api/subscription/actions" });
      return NextResponse.json({ status: nextStatus, autoRenew: true, currentPeriodEndsAt: periodEnd });
    }

    const updated = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      { cancel_at_period_end: true },
      {
        idempotencyKey: buildStripeIdempotencyKey([
          "subscription-cancel",
          subscription.stripeSubscriptionId,
          String(subscription.version ?? 0),
        ]),
      },
    );
    const periodEnd = getStripeSubscriptionCurrentPeriodEndDate(updated) || subscription.currentPeriodEndsAt;
    const nextStatus = action === "cancel_trial" || isTrial ? "TRIAL_CANCELED" : "CANCEL_AT_PERIOD_END";

    // The survey modal posts cancelReason + cancelReasonComment alongside
    // the cancel action; both fields are optional so the legacy
    // immediate-cancel paths keep working unchanged.
    const cancelReason = normalizeCancelReason(body?.cancelReason);
    const cancelReasonComment = normalizeCancelComment(body?.cancelReasonComment);

    const baseUpdate = {
      status: nextStatus,
      cancelAtPeriodEnd: true,
      autoRenew: false,
      currentPeriodEndsAt: periodEnd,
      stripeCurrentPeriodEnd: periodEnd,
      canceledAt: now,
      lastSyncedAt: now,
      version: { increment: 1 },
    };
    // Only persist the survey fields when the modal returned a value, so a
    // resume-and-recancel-via-Skip flow doesn't wipe a previously captured
    // reason. Also wrap in the schema-compat fallback so a rolling deploy
    // can't 500 every cancel request before the migration lands.
    const cancelSurveyData = {
      ...(cancelReason !== null ? { cancelReason } : {}),
      ...(cancelReasonComment !== null ? { cancelReasonComment } : {}),
    };

    try {
      await prisma.subscription.update({
        where: { userId },
        data: { ...baseUpdate, ...cancelSurveyData },
      });
    } catch (dbError) {
      if (
        !isMissingDbColumnError(dbError) ||
        Object.keys(cancelSurveyData).length === 0
      ) {
        throw dbError;
      }
      warnSchemaCompatibilityFallback("subscription:cancel-survey-write", dbError);
      await prisma.subscription.update({
        where: { userId },
        data: baseUpdate,
      });
    }

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

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "UPDATE", entityType: "Subscription", entityId: subscription.id, route: "/api/subscription/actions" });
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

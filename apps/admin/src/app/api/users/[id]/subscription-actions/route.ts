import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

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
    const { action, confirmPassword } = parsed.data;

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "billing_subscription_action",
    });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const { id: userId } = await params;
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription?.stripeSubscriptionId) {
      return NextResponse.json({ error: "User does not have a Stripe subscription." }, { status: 400 });
    }

    const stripe = new Stripe(
      requireStripeSecretKey(await getAdminRuntimeConfigValue("STRIPE_SECRET_KEY")),
      { apiVersion: "2024-06-20" },
    );
    const now = new Date();
    let stripeSubscription: Stripe.Subscription;
    try {
      stripeSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: action === "resume_renewal" ? false : true,
      });
    } catch (stripeError: any) {
      // Don't leak raw Stripe payloads (request IDs, internal codes, full
      // error.raw payload). Log them server-side, return a stable public
      // message the admin UI can show without exposing implementation.
      console.error("Stripe subscription update failed", {
        userId,
        action,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        message: typeof stripeError?.message === "string" ? stripeError.message.slice(0, 500) : "unknown",
        type: stripeError?.type || null,
        code: stripeError?.code || null,
      });
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "SUBSCRIPTION_ACTION_FAILED",
          entityType: "Subscription",
          entityId: subscription.id,
          changes: JSON.stringify({
            action,
            userId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            errorType: stripeError?.type || null,
            errorCode: stripeError?.code || null,
          }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
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

    const updated = await prisma.subscription.update({
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
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE",
        entityType: "Subscription",
        entityId: updated.id,
        changes: JSON.stringify({
          action,
          userId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          status: nextStatus,
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
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

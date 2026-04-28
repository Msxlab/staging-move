import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

type SubscriptionAction = "cancel_trial" | "cancel_renewal" | "resume_renewal";

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
    const body = await request.json().catch(() => ({}));
    const confirm = await requirePasswordConfirm(
      session,
      typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
    );
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const action = body?.action as SubscriptionAction;
    if (!["cancel_trial", "cancel_renewal", "resume_renewal"].includes(action)) {
      return NextResponse.json({ error: "Invalid subscription action." }, { status: 400 });
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
    const stripeSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: action === "resume_renewal" ? false : true,
    });
    const periodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : subscription.currentPeriodEndsAt;
    const isTrial =
      subscription.accessType === "FREE_TRIAL" ||
      subscription.status === "TRIALING" ||
      subscription.status === "TRIAL_CANCELED";
    const trialStillActive = Boolean(subscription.trialEndsAt && subscription.trialEndsAt > now);
    const nextStatus =
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
    return NextResponse.json({ error: error?.message || "Failed to update subscription" }, { status: 500 });
  }
}

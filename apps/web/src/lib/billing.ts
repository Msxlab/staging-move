import { prisma } from "@/lib/db";
import {
  createFallbackEntitlementSnapshot,
  DEFAULT_BILLING_PLAN,
  DEFAULT_SUBSCRIPTION_STATUS,
  isActiveSubscriptionStatus,
  TRIAL_DURATION_DAYS,
  type BillingPlan,
  type BillingProvider,
  type UnifiedEntitlementSnapshot,
} from "@/lib/shared-billing";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

export function createTrialEndsAt() {
  return new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export type BillingCycle = "monthly" | "yearly";

/**
 * Resolve the Stripe Price ID for a plan + billing cycle. Runtime config
 * is the single source of truth so operators can rotate prices without a
 * code deploy. Yearly checkout must fail cleanly if the yearly price is not
 * configured; silently charging monthly for a yearly request is unsafe.
 */
export async function getStripePriceIdForPlan(
  _plan: Extract<BillingPlan, "INDIVIDUAL">,
  cycle: BillingCycle = "monthly",
) {
  if (cycle === "yearly") {
    const yearly = await getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY");
    if (yearly) return yearly;
    return null;
  }
  return getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL");
}

export async function mapStripePriceIdToPlan(priceId: string | null | undefined): Promise<BillingPlan | null> {
  if (!priceId) return null;
  const [monthly, yearly] = await Promise.all([
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY"),
  ]);
  if (priceId === monthly || priceId === yearly) return "INDIVIDUAL";
  return null;
}

export function buildUnifiedEntitlementSnapshot(subscription: any): UnifiedEntitlementSnapshot {
  if (!subscription) {
    return createFallbackEntitlementSnapshot({
      status: "UNKNOWN",
      isActive: false,
      trialEndsAt: null,
    });
  }

  const plan = (subscription.plan || DEFAULT_BILLING_PLAN) as BillingPlan;
  const status = subscription.status || DEFAULT_SUBSCRIPTION_STATUS;
  const provider = (subscription.provider || (subscription.stripeCustomerId ? "STRIPE" : "TRIAL")) as BillingProvider;
  const trialEndsAt = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const currentPeriodEndsAt = subscription.currentPeriodEndsAt
    ? new Date(subscription.currentPeriodEndsAt)
    : subscription.stripeCurrentPeriodEnd
      ? new Date(subscription.stripeCurrentPeriodEnd)
      : subscription.premiumUntil
        ? new Date(subscription.premiumUntil)
        : null;

  const trialExpired =
    plan === "FREE_TRIAL" &&
    (!trialEndsAt || Date.now() > trialEndsAt.getTime());
  const isActive = isActiveSubscriptionStatus(status) && !trialExpired;
  const managementKind = provider === "STRIPE" ? "stripe" : provider === "APP_STORE" || provider === "PLAY_STORE" ? "store" : "none";

  return {
    plan,
    status,
    provider,
    platform: subscription.platform || null,
    isActive,
    isTrial: plan === "FREE_TRIAL",
    managementKind,
    trialEndsAt: trialEndsAt?.toISOString() || null,
    currentPeriodEndsAt: currentPeriodEndsAt?.toISOString() || null,
  };
}

export async function ensureSubscriptionDefaults(
  userId: string,
  options: { platform?: string | null; trialEndsAt?: Date } = {},
) {
  return prisma.subscription.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      plan: DEFAULT_BILLING_PLAN,
      status: DEFAULT_SUBSCRIPTION_STATUS,
      provider: "TRIAL",
      platform: options.platform || "web",
      trialEndsAt: options.trialEndsAt || createTrialEndsAt(),
    },
  });
}

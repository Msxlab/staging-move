import { prisma } from "@/lib/db";
import {
  createFallbackEntitlementSnapshot,
  DEFAULT_BILLING_PLAN,
  DEFAULT_SUBSCRIPTION_STATUS,
  deriveUserSubscriptionState,
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
export type StripeBillingInterval = "MONTH" | "YEAR";

export const DEFAULT_STRIPE_ANNUAL_TRIAL_DAYS = 90;

export function billingCycleToInterval(cycle: BillingCycle): StripeBillingInterval {
  return cycle === "yearly" ? "YEAR" : "MONTH";
}

export function billingIntervalToCycle(interval: StripeBillingInterval): BillingCycle {
  return interval === "YEAR" ? "yearly" : "monthly";
}

/**
 * Resolve the Stripe Price ID for a plan + billing interval.
 *
 * DigitalOcean/deployment env is the production source of truth for these
 * keys unless STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED=true is set. The legacy
 * STRIPE_PRICE_INDIVIDUAL key is monthly-only and never beats the new
 * monthly/yearly keys.
 */
export async function getStripePriceIdForPlanAndInterval(
  _plan: Extract<BillingPlan, "INDIVIDUAL">,
  billingInterval: StripeBillingInterval,
): Promise<string | null> {
  const [monthly, yearly, legacyMonthly] = await Promise.all([
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_MONTHLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL"),
  ]);

  if (billingInterval === "MONTH") return monthly || legacyMonthly || null;
  return yearly || null;
}

export async function getStripePriceIdForPlan(
  plan: Extract<BillingPlan, "INDIVIDUAL">,
  cycle: BillingCycle = "monthly",
) {
  return getStripePriceIdForPlanAndInterval(plan, billingCycleToInterval(cycle));
}

export async function mapStripePriceIdToPlanAndInterval(
  priceId: string | null | undefined,
): Promise<{ plan: Extract<BillingPlan, "INDIVIDUAL">; billingInterval: StripeBillingInterval } | null> {
  if (!priceId) return null;
  const [monthly, yearly, legacyMonthly] = await Promise.all([
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_MONTHLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL_YEARLY"),
    getRuntimeConfigValue("STRIPE_PRICE_INDIVIDUAL"),
  ]);
  if (monthly && priceId === monthly) return { plan: "INDIVIDUAL", billingInterval: "MONTH" };
  if (yearly && priceId === yearly) return { plan: "INDIVIDUAL", billingInterval: "YEAR" };
  if (legacyMonthly && priceId === legacyMonthly) return { plan: "INDIVIDUAL", billingInterval: "MONTH" };
  return null;
}

export async function mapStripePriceIdToPlan(priceId: string | null | undefined): Promise<BillingPlan | null> {
  return (await mapStripePriceIdToPlanAndInterval(priceId))?.plan || null;
}

export async function getStripeAnnualTrialDays(): Promise<number> {
  const raw = await getRuntimeConfigValue("STRIPE_ANNUAL_TRIAL_DAYS");
  if (!raw) return DEFAULT_STRIPE_ANNUAL_TRIAL_DAYS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
    return DEFAULT_STRIPE_ANNUAL_TRIAL_DAYS;
  }
  return parsed;
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
  const accessType = subscription.accessType || (provider === "STRIPE" && subscription.trialEndsAt ? "FREE_TRIAL" : null);
  const trialEndsAt = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const freeAccessEndsAt = subscription.freeAccessEndsAt ? new Date(subscription.freeAccessEndsAt) : null;
  const firstChargeAt = subscription.firstChargeAt ? new Date(subscription.firstChargeAt) : null;
  const currentPeriodEndsAt = subscription.currentPeriodEndsAt
    ? new Date(subscription.currentPeriodEndsAt)
    : subscription.stripeCurrentPeriodEnd
      ? new Date(subscription.stripeCurrentPeriodEnd)
      : subscription.premiumUntil
        ? new Date(subscription.premiumUntil)
        : null;

  const trialExpired =
    plan === "FREE_TRIAL" &&
    accessType !== "FREE_ACCESS" &&
    (!trialEndsAt || Date.now() > trialEndsAt.getTime());
  const freeAccessExpired =
    accessType === "FREE_ACCESS" &&
    (!freeAccessEndsAt || Date.now() > freeAccessEndsAt.getTime());
  const derivedState = deriveUserSubscriptionState(subscription);
  const isActive =
    isActiveSubscriptionStatus(status) &&
    !trialExpired &&
    !freeAccessExpired &&
    !["FREE_ACCESS_EXPIRED", "CANCELED", "PAST_DUE", "REFUNDED", "UNKNOWN"].includes(derivedState);
  const managementKind = provider === "STRIPE" ? "stripe" : provider === "APP_STORE" || provider === "PLAY_STORE" ? "store" : "none";

  return {
    plan,
    status,
    provider,
    platform: subscription.platform || null,
    accessType: accessType || (plan === "INDIVIDUAL" ? "PAID" : null),
    isActive,
    isTrial: accessType === "FREE_TRIAL" || (plan === "FREE_TRIAL" && accessType !== "FREE_ACCESS"),
    autoRenew: Boolean(subscription.autoRenew ?? (provider === "STRIPE" && !subscription.cancelAtPeriodEnd)),
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    managementKind,
    trialEndsAt: trialEndsAt?.toISOString() || null,
    freeAccessEndsAt: freeAccessEndsAt?.toISOString() || null,
    firstChargeAt: firstChargeAt?.toISOString() || null,
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
      accessType: "FREE_ACCESS",
      freeAccessEndsAt: options.trialEndsAt || createTrialEndsAt(),
    },
  });
}

export const TRIAL_DURATION_DAYS = 14;

// Plans that are actually purchasable today.
export const BILLING_PLAN_ORDER = ["FREE_TRIAL", "INDIVIDUAL"] as const;
export type BillingPlan = (typeof BILLING_PLAN_ORDER)[number];

export const PAID_BILLING_PLANS = ["INDIVIDUAL"] as const;
export type PaidBillingPlan = (typeof PAID_BILLING_PLANS)[number];

export const BILLING_PROVIDER_VALUES = ["TRIAL", "STRIPE", "APP_STORE", "PLAY_STORE", "ADMIN", "UNKNOWN"] as const;
export type BillingProvider = (typeof BILLING_PROVIDER_VALUES)[number];

export const BILLING_PLATFORM_VALUES = ["web", "ios", "android"] as const;
export type BillingPlatform = (typeof BILLING_PLATFORM_VALUES)[number];

export const SUBSCRIPTION_STATUS_VALUES = [
  "FREE_ACCESS",
  "FREE_ACCESS_EXPIRED",
  "TRIALING",
  "TRIAL_CANCELED",
  "ACTIVE",
  "CANCEL_AT_PERIOD_END",
  "PAST_DUE",
  "GRACE_PERIOD",
  "CANCELED",
  "EXPIRED",
  "INCOMPLETE",
  "UNPAID",
  "REFUNDED",
  "UNKNOWN",
  "PENDING_CHECKOUT",
  "PENDING_VALIDATION",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

export const DEFAULT_BILLING_PLAN: BillingPlan = "FREE_TRIAL";
export const DEFAULT_SUBSCRIPTION_STATUS: SubscriptionStatus = "FREE_ACCESS";

export interface BillingPlanDefinition {
  id: BillingPlan;
  displayName: string;
  shortDescription: string;
  priceLabel: string;
  periodLabel: string;
  monthlyPriceUsd: number;
  yearlyPriceLabel?: string;
  yearlyPriceUsd?: number;
  isPaid: boolean;
  features: string[];
}

export const BILLING_PLAN_DEFINITIONS: Record<BillingPlan, BillingPlanDefinition> = {
  FREE_TRIAL: {
    id: "FREE_TRIAL",
    displayName: "Free Access",
    shortDescription: "Try LocateFlow without a payment method.",
    priceLabel: "Free",
    periodLabel: `${TRIAL_DURATION_DAYS} days`,
    monthlyPriceUsd: 0,
    isPaid: false,
    features: [
      "2 addresses",
      "10 services",
      "Basic moving checklist",
    ],
  },
  INDIVIDUAL: {
    id: "INDIVIDUAL",
    displayName: "Individual",
    shortDescription: "For one person keeping every service tied to their addresses in sync.",
    priceLabel: "$7.99",
    periodLabel: "/month",
    monthlyPriceUsd: 7.99,
    yearlyPriceLabel: "$79/year",
    yearlyPriceUsd: 79,
    isPaid: true,
    features: [
      "10 addresses",
      "100 services",
      "Bill & renewal reminders",
      "Document storage",
      "Smart moving checklist",
      "Export anytime (CSV, PDF)",
    ],
  },
};

export const BILLING_PRODUCT_CONFIG_KEYS = {
  web: {
    INDIVIDUAL: "STRIPE_PRICE_INDIVIDUAL",
  },
} as const;

export interface UnifiedEntitlementSnapshot {
  plan: BillingPlan;
  status: SubscriptionStatus;
  provider: BillingProvider;
  platform: BillingPlatform | null;
  accessType: "FREE_ACCESS" | "FREE_TRIAL" | "PAID" | null;
  isActive: boolean;
  isTrial: boolean;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  managementKind: "stripe" | "store" | "none";
  trialEndsAt: string | null;
  freeAccessEndsAt: string | null;
  firstChargeAt: string | null;
  currentPeriodEndsAt: string | null;
}

export function getBillingPlanDefinition(plan: string | null | undefined): BillingPlanDefinition {
  const normalized = BILLING_PLAN_ORDER.find((value) => value === plan);
  return BILLING_PLAN_DEFINITIONS[normalized || DEFAULT_BILLING_PLAN];
}

export function isPaidBillingPlan(plan: string | null | undefined): plan is PaidBillingPlan {
  return PAID_BILLING_PLANS.includes(plan as PaidBillingPlan);
}

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  return status === "ACTIVE" ||
    status === "TRIALING" ||
    status === "FREE_ACCESS" ||
    status === "TRIAL_CANCELED" ||
    status === "CANCEL_AT_PERIOD_END" ||
    status === "GRACE_PERIOD";
}

export function createFallbackEntitlementSnapshot(
  partial: Partial<UnifiedEntitlementSnapshot> = {}
): UnifiedEntitlementSnapshot {
  return {
    plan: partial.plan || DEFAULT_BILLING_PLAN,
    status: partial.status || DEFAULT_SUBSCRIPTION_STATUS,
    provider: partial.provider || "TRIAL",
    platform: partial.platform ?? null,
    accessType: partial.accessType ?? "FREE_ACCESS",
    isActive: partial.isActive ?? true,
    isTrial: partial.isTrial ?? false,
    autoRenew: partial.autoRenew ?? false,
    cancelAtPeriodEnd: partial.cancelAtPeriodEnd ?? false,
    managementKind: partial.managementKind || "none",
    trialEndsAt: partial.trialEndsAt ?? null,
    freeAccessEndsAt: partial.freeAccessEndsAt ?? null,
    firstChargeAt: partial.firstChargeAt ?? null,
    currentPeriodEndsAt: partial.currentPeriodEndsAt ?? null,
  };
}

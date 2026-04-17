export const TRIAL_DURATION_DAYS = 7;

export const BILLING_PLAN_ORDER = ["FREE_TRIAL", "INDIVIDUAL"] as const;
export type BillingPlan = (typeof BILLING_PLAN_ORDER)[number];

export const PAID_BILLING_PLANS = ["INDIVIDUAL"] as const;
export type PaidBillingPlan = (typeof PAID_BILLING_PLANS)[number];

export const BILLING_PROVIDER_VALUES = ["TRIAL", "STRIPE", "APP_STORE", "PLAY_STORE", "ADMIN", "UNKNOWN"] as const;
export type BillingProvider = (typeof BILLING_PROVIDER_VALUES)[number];

export const BILLING_PLATFORM_VALUES = ["web", "ios", "android"] as const;
export type BillingPlatform = (typeof BILLING_PLATFORM_VALUES)[number];

export const SUBSCRIPTION_STATUS_VALUES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "EXPIRED",
  "INCOMPLETE",
  "UNPAID",
  "UNKNOWN",
  "PENDING_VALIDATION",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

export const DEFAULT_BILLING_PLAN: BillingPlan = "FREE_TRIAL";
export const DEFAULT_SUBSCRIPTION_STATUS: SubscriptionStatus = "TRIALING";

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
    displayName: "Free Trial",
    shortDescription: "Try the full workflow before you upgrade.",
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
    shortDescription: "For a single mover managing everything personally.",
    priceLabel: "$4.99",
    periodLabel: "/month",
    monthlyPriceUsd: 4.99,
    yearlyPriceLabel: "$49/year",
    yearlyPriceUsd: 49,
    isPaid: true,
    features: [
      "10 addresses",
      "100 services",
      "Full moving planner",
      "QR box tracking",
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
  isActive: boolean;
  isTrial: boolean;
  managementKind: "stripe" | "store" | "none";
  trialEndsAt: string | null;
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
  return status === "ACTIVE" || status === "TRIALING";
}

export function createFallbackEntitlementSnapshot(
  partial: Partial<UnifiedEntitlementSnapshot> = {}
): UnifiedEntitlementSnapshot {
  return {
    plan: partial.plan || DEFAULT_BILLING_PLAN,
    status: partial.status || DEFAULT_SUBSCRIPTION_STATUS,
    provider: partial.provider || "TRIAL",
    platform: partial.platform ?? null,
    isActive: partial.isActive ?? true,
    isTrial: partial.isTrial ?? true,
    managementKind: partial.managementKind || "none",
    trialEndsAt: partial.trialEndsAt ?? null,
    currentPeriodEndsAt: partial.currentPeriodEndsAt ?? null,
  };
}

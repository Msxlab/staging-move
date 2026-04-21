export const TRIAL_DURATION_DAYS = 14;

// Plans that are actually purchasable today. FAMILY and PRO are surfaced on
// marketing pages as "Coming soon" teasers but are not listed here because
// Stripe/App Store/Play Store have no product mapped to them yet.
export const BILLING_PLAN_ORDER = ["FREE_TRIAL", "INDIVIDUAL"] as const;
export type BillingPlan = (typeof BILLING_PLAN_ORDER)[number];

// Upcoming plans shown as teasers on the marketing page. When a plan here
// ships, move it into BILLING_PLAN_ORDER + add a BILLING_PLAN_DEFINITIONS
// entry + create the Stripe / store products before the marketing toggle.
export const UPCOMING_BILLING_PLAN_ORDER = ["FAMILY", "PRO"] as const;
export type UpcomingBillingPlan = (typeof UPCOMING_BILLING_PLAN_ORDER)[number];

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
      "Document storage + OCR",
      "Smart moving checklist",
      "Export anytime (CSV, PDF)",
    ],
  },
};

/** Upcoming plan teasers — shown on marketing pages with a "Coming soon"
 *  badge. Kept in a separate map so nothing else in the app can accidentally
 *  treat them as billable. */
export interface UpcomingBillingPlanDefinition {
  id: UpcomingBillingPlan;
  displayName: string;
  shortDescription: string;
  priceLabel: string;
  periodLabel: string;
  yearlyPriceLabel?: string;
  features: string[];
}

export const UPCOMING_BILLING_PLAN_DEFINITIONS: Record<
  UpcomingBillingPlan,
  UpcomingBillingPlanDefinition
> = {
  FAMILY: {
    id: "FAMILY",
    displayName: "Family",
    shortDescription:
      "Up to 5 members under one household, shared addresses and services.",
    priceLabel: "$14.99",
    periodLabel: "/month",
    yearlyPriceLabel: "$149/year",
    features: [
      "Everything in Individual",
      "Up to 5 household members",
      "Shared addresses + services",
      "Per-member task assignment",
      "Unified budget view",
    ],
  },
  PRO: {
    id: "PRO",
    displayName: "Pro",
    shortDescription:
      "For realtors, relocation managers, and anyone tracking services on behalf of clients.",
    priceLabel: "$19.99",
    periodLabel: "/month",
    yearlyPriceLabel: "$199/year",
    features: [
      "Everything in Family",
      "Unlimited addresses + services",
      "Team seats & roles",
      "White-label email + reports",
      "API access",
      "Priority support",
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

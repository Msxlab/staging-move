export const TRIAL_DURATION_DAYS = 14;

// All known plan tiers (doc 20/30/62). FAMILY/PRO are admin-grantable today;
// their Stripe self-serve purchase additionally needs STRIPE_PRICE_FAMILY_*/
// PRO_* in env (see BILLING_PRODUCT_CONFIG_KEYS). Subscription.plan is
// VarChar(30), so adding tiers needs NO DB migration — this is purely additive.
export const BILLING_PLAN_ORDER = ["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"] as const;
export type BillingPlan = (typeof BILLING_PLAN_ORDER)[number];

export const PAID_BILLING_PLANS = ["INDIVIDUAL", "FAMILY", "PRO"] as const;
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
    priceLabel: "$3.99",
    periodLabel: "/month",
    monthlyPriceUsd: 3.99,
    yearlyPriceLabel: "$39.99/year",
    yearlyPriceUsd: 39.99,
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
  FAMILY: {
    id: "FAMILY",
    displayName: "Family",
    shortDescription: "For households sharing a home and bills. Up to 6 members.",
    priceLabel: "$9.99",
    periodLabel: "/month",
    monthlyPriceUsd: 9.99,
    yearlyPriceLabel: "$99/year",
    yearlyPriceUsd: 99,
    isPaid: true,
    features: [
      "Up to 6 members (1 owner + 5)",
      "17 addresses",
      "250 services",
      "Shared services (who pays, who uses)",
      "Family budget view",
      "Consolidated household reminders",
      "Child accounts (no financial visibility)",
      "Export anytime (CSV, PDF)",
    ],
  },
  PRO: {
    id: "PRO",
    displayName: "Pro",
    shortDescription: "For power users, portfolios, and home-office pros. Up to 10 members.",
    priceLabel: "$19.99",
    periodLabel: "/month",
    monthlyPriceUsd: 19.99,
    yearlyPriceLabel: "$199/year",
    yearlyPriceUsd: 199,
    isPaid: true,
    features: [
      "Up to 10 members",
      "25 addresses",
      "1,000 services",
      "Address labels (Home, Office, Rental…)",
      "Partner Hub - guided partner updates",
      "Partner update queue",
      "Tax & property export (CSV + PDF)",
      "Unlimited move history",
    ],
  },
};

export const BILLING_PRODUCT_CONFIG_KEYS = {
  web: {
    INDIVIDUAL_MONTHLY: "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
    INDIVIDUAL_YEARLY: "STRIPE_PRICE_INDIVIDUAL_YEARLY",
    FAMILY_MONTHLY: "STRIPE_PRICE_FAMILY_MONTHLY",
    FAMILY_YEARLY: "STRIPE_PRICE_FAMILY_YEARLY",
    PRO_MONTHLY: "STRIPE_PRICE_PRO_MONTHLY",
    PRO_YEARLY: "STRIPE_PRICE_PRO_YEARLY",
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

/**
 * Type guard for a recognized billing plan. Use before persisting a plan value
 * sourced from outside the app (Stripe metadata, query params) so an unknown
 * string is rejected rather than silently stored and mis-read downstream.
 */
export function isBillingPlan(plan: string | null | undefined): plan is BillingPlan {
  return BILLING_PLAN_ORDER.includes(plan as BillingPlan);
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

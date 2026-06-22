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

export type BillingInterval = "MONTH" | "YEAR";

export interface BillingPlanDefinition {
  id: BillingPlan;
  displayName: string;
  shortDescription: string;
  primaryBillingInterval?: BillingInterval;
  priceLabel: string;
  periodLabel: string;
  monthlyPriceUsd: number;
  monthlyPriceLabel?: string;
  yearlyPriceLabel?: string;
  yearlyPriceUsd?: number;
  isPaid: boolean;
  features: string[];
}

export const BILLING_PLAN_DEFINITIONS: Record<BillingPlan, BillingPlanDefinition> = {
  FREE_TRIAL: {
    id: "FREE_TRIAL",
    displayName: "Free",
    shortDescription: "Basic move checklist, address tracking, and Home Dossier preview.",
    priceLabel: "Free",
    periodLabel: "",
    monthlyPriceUsd: 0,
    isPaid: false,
    features: [
      "Up to 3 addresses & 10 services",
      "Keep your providers & accounts in one place",
      "Bill & renewal reminders",
      "Provider suggestions from our catalog",
      "Basic moving checklist preview",
      "Home Dossier preview (upgrade for the full report; PDF export is Pro)",
    ],
  },
  INDIVIDUAL: {
    id: "INDIVIDUAL",
    displayName: "Individual",
    shortDescription: "Unlock the full move: personalized plan, tracking, and migration.",
    primaryBillingInterval: "YEAR",
    priceLabel: "$24",
    periodLabel: "/year",
    monthlyPriceUsd: 4.99,
    monthlyPriceLabel: "$4.99/month",
    yearlyPriceLabel: "$24/year",
    yearlyPriceUsd: 24,
    isPaid: true,
    features: [
      "Full personalized move plan + tracking",
      "Data-checked provider suggestions with confidence labels",
      "New Home Dossier: flood zone, school district & moving-day weather",
      "VIN recall check for your vehicles",
      "Moving-day weather alerts & weekly digest",
      "Moving checklist, countdown & state guide",
      "Provider migration & move tasks",
      "Up to 10 addresses & 100 services",
      "Bill & renewal reminders",
      "Custom providers",
      "Export anytime (CSV, PDF)",
    ],
  },
  FAMILY: {
    id: "FAMILY",
    displayName: "Family",
    shortDescription: "For households sharing a home and bills. Up to 6 members.",
    primaryBillingInterval: "YEAR",
    priceLabel: "$39",
    periodLabel: "/year",
    monthlyPriceUsd: 7.99,
    monthlyPriceLabel: "$7.99/month",
    yearlyPriceLabel: "$39/year",
    yearlyPriceUsd: 39,
    isPaid: true,
    features: [
      "Everything in Individual, up to 6 members (1 owner + 5)",
      "15 addresses & 500 services",
      "AI move briefing — your move, explained",
      "Real route map for your move",
      "Shared addresses & services",
      "Household budget view",
      "Consolidated household reminders",
      "Child accounts (no financial visibility)",
      "Export anytime (CSV, PDF)",
    ],
  },
  PRO: {
    id: "PRO",
    displayName: "Pro",
    shortDescription: "For power users, portfolios, and home-office pros. Up to 10 members.",
    primaryBillingInterval: "YEAR",
    priceLabel: "$59",
    periodLabel: "/year",
    monthlyPriceUsd: 11.99,
    monthlyPriceLabel: "$11.99/month",
    yearlyPriceLabel: "$59/year",
    yearlyPriceUsd: 59,
    isPaid: true,
    features: [
      "Everything in Family, up to 10 members",
      "25 addresses & 1,000 services",
      "Provider confidence reports across every saved address",
      "Licensed mover suggestions (FMCSA-registered where available)",
      "New Home Dossier PDF exports",
      "Up to 3 move plans at once",
      "Priority support",
      "Partner Hub - guided partner updates",
      "Tax, property & home-office exports (CSV + PDF)",
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

export function billingPriceLabelForInterval(plan: BillingPlan, interval: BillingInterval): string {
  const definition = BILLING_PLAN_DEFINITIONS[plan];
  if (!definition.isPaid) return definition.priceLabel;
  if (interval === "YEAR") {
    return definition.yearlyPriceLabel || `${definition.priceLabel}${definition.periodLabel}`;
  }
  return definition.monthlyPriceLabel || `$${definition.monthlyPriceUsd}/month`;
}

export function billingAmountUsdForInterval(plan: BillingPlan, interval: BillingInterval): number {
  const definition = BILLING_PLAN_DEFINITIONS[plan];
  if (!definition.isPaid) return 0;
  if (interval === "YEAR") return definition.yearlyPriceUsd ?? definition.monthlyPriceUsd * 12;
  return definition.monthlyPriceUsd;
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

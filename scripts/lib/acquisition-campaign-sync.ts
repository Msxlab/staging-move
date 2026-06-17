export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "CANCEL_AT_PERIOD_END",
  "TRIAL_CANCELED",
  "PAST_DUE",
  "GRACE_PERIOD",
] as const;

export type CampaignSyncCode = "INDIVIDUAL90" | "INDIVIDUALMONTHLY";

export type CampaignSyncEnv = {
  STRIPE_PRICE_INDIVIDUAL_MONTHLY?: string | null;
  STRIPE_PRICE_INDIVIDUAL_YEARLY?: string | null;
  STRIPE_PRICE_INDIVIDUAL?: string | null;
};

export type CampaignSyncTarget = {
  code: CampaignSyncCode;
  displayPriceLabel: string;
  checkoutDisclosureCopy: string;
  stripePriceId: string;
};

function envValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getCampaignSyncTarget(
  code: CampaignSyncCode,
  env: CampaignSyncEnv,
): CampaignSyncTarget | null {
  if (code === "INDIVIDUAL90") {
    const stripePriceId = envValue(env.STRIPE_PRICE_INDIVIDUAL_YEARLY);
    if (!stripePriceId) return null;
    return {
      code,
      displayPriceLabel: "$24/year",
      stripePriceId,
      checkoutDisclosureCopy:
        "Annual plan includes a 90-day free trial, then renews at $24/year unless canceled.",
    };
  }

  const stripePriceId =
    envValue(env.STRIPE_PRICE_INDIVIDUAL_MONTHLY) ||
    envValue(env.STRIPE_PRICE_INDIVIDUAL);
  if (!stripePriceId) return null;
  return {
    code,
    displayPriceLabel: "$4.99/month",
    stripePriceId,
    checkoutDisclosureCopy: "Monthly plan renews at $4.99/month unless canceled.",
  };
}

export function getCampaignSyncTargets(env: CampaignSyncEnv): CampaignSyncTarget[] {
  return (["INDIVIDUAL90", "INDIVIDUALMONTHLY"] as const)
    .map((code) => getCampaignSyncTarget(code, env))
    .filter((target): target is CampaignSyncTarget => Boolean(target));
}

export function activeSubscriberMutationGuidance(count: number): string {
  if (count <= 0) {
    return "No active subscribers are attached to the target campaigns.";
  }
  return [
    `${count} active subscription(s) are attached to the target campaigns.`,
    "This sync only updates public campaign copy and future checkout price IDs; existing Stripe subscriptions keep their existing Stripe price IDs.",
    "Clone a new campaign instead of mutating the old one if immutable campaign reporting or grandfathered offer copy is required.",
  ].join(" ");
}

import type Stripe from "stripe";

/**
 * Single source of truth for translating a live Stripe subscription into the
 * local subscription fields. This mirrors the derivation the Stripe webhook
 * applies (apps/web/src/app/api/webhooks/stripe/route.ts). The nightly
 * reconcile cron MUST use this so it can't drift from the webhook — it
 * previously used a cancel-unaware status map and never synced accessType,
 * which silently re-activated canceled subscriptions and left trial→paid
 * conversions stuck at accessType=FREE_TRIAL ($0 in MRR forever).
 */

type StripeSubLike = Pick<Stripe.Subscription, "status" | "cancel_at_period_end">;

export function mapStripeStatus(stripeStatus: string): string {
  const map: Record<string, string> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    incomplete: "INCOMPLETE",
    incomplete_expired: "EXPIRED",
    // Stripe `paused` (pause_collection) is an intentional, resumable pause —
    // not a dunning/payment failure. Map to CANCELED so access ends cleanly
    // without the "update your payment method" dunning UX; a later resume
    // sends status=active and re-activates the row. (The reconcile cron used
    // to map paused→PAST_DUE, which disagreed with the webhook.)
    paused: "CANCELED",
  };
  return map[stripeStatus] || "UNKNOWN";
}

export function mapStripeStatusWithRenewal(subscription: StripeSubLike): string {
  if (subscription.status === "trialing" && subscription.cancel_at_period_end) return "TRIAL_CANCELED";
  if (subscription.status === "active" && subscription.cancel_at_period_end) return "CANCEL_AT_PERIOD_END";
  return mapStripeStatus(subscription.status);
}

export interface StripeEntitlementFields {
  status: string;
  accessType: "FREE_TRIAL" | "PAID";
  cancelAtPeriodEnd: boolean;
  autoRenew: boolean;
}

export function deriveStripeEntitlementFields(subscription: StripeSubLike): StripeEntitlementFields {
  const status = mapStripeStatusWithRenewal(subscription);
  const accessType: "FREE_TRIAL" | "PAID" =
    subscription.status === "trialing" || status === "TRIAL_CANCELED" ? "FREE_TRIAL" : "PAID";
  return {
    status,
    accessType,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    autoRenew: !subscription.cancel_at_period_end,
  };
}

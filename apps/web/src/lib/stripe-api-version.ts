import type Stripe from "stripe";

// stripe-node 16 is pinned to 2024-06-20. Flexible-billing subscriptions need
// the preview Billing API version for schedule create/update calls.
export const STRIPE_API_VERSION = "2024-06-20";
export const STRIPE_FLEXIBLE_BILLING_API_VERSION = "2025-04-30.preview";

export function withFlexibleBillingApiVersion(
  options: Stripe.RequestOptions = {},
): Stripe.RequestOptions {
  return {
    ...options,
    apiVersion: STRIPE_FLEXIBLE_BILLING_API_VERSION,
  };
}

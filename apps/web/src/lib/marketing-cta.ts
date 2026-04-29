import { prisma } from "@/lib/db";
import { deriveUserSubscriptionState } from "@/lib/shared-billing";

export type MarketingCtaIntent = "anonymous" | "manage" | "upgrade";

export interface MarketingCtaTarget {
  href: string;
  intent: MarketingCtaIntent;
}

/**
 * Resolve the destination for the homepage / pricing "Start 3 months free"
 * CTA based on the user's current subscription state.
 *
 * - Anonymous: /sign-up so we can capture the intent.
 * - Trialing / active / cancel-at-period-end / pending checkout: send the
 *   user to subscription management — these users either already have the
 *   plan or are mid-flow, and re-routing them to /dashboard or /sign-up
 *   would be confusing.
 * - Free Access / Free Access Expired / canceled / unknown: send the user
 *   to subscription so they can review the trial offer + start checkout.
 */
export async function resolveMarketingCtaTarget(
  userId: string | null | undefined,
): Promise<MarketingCtaTarget> {
  if (!userId) return { href: "/sign-up", intent: "anonymous" };

  const subscription = await prisma.subscription
    .findUnique({ where: { userId } })
    .catch(() => null);

  const state = deriveUserSubscriptionState(subscription);

  if (
    state === "TRIALING" ||
    state === "TRIAL_CANCELED" ||
    state === "ACTIVE" ||
    state === "CANCEL_AT_PERIOD_END" ||
    state === "PAST_DUE" ||
    state === "GRACE_PERIOD" ||
    state === "PENDING_CHECKOUT"
  ) {
    return { href: "/settings/subscription", intent: "manage" };
  }

  return { href: "/settings/subscription", intent: "upgrade" };
}

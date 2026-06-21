import {
  CONSUMER_FREE_FLAG,
  consumerFreeApplies,
  getEffectiveEntitlement,
  type EffectiveEntitlement,
} from "@locateflow/shared";
import { isFeatureEnabled } from "@/lib/feature-flags";

type SubscriptionArg = Parameters<typeof getEffectiveEntitlement>[0];

/**
 * Resolve a CONSUMER entitlement: the canonical effective entitlement with the
 * H3-safe consumer-free override applied when CONSUMER_FREE is on.
 *
 * Use this on EVERY consumer access gate (seats, API connectors, …) so a
 * free-for-all user resolves to PRO in ONE place (audit P1-2 / docs 16-H3).
 * Never use it on admin / billing-truth / ownership-reconcile paths — those want
 * the RAW `getEffectiveEntitlement` so manual grants, expiries, refunds and real
 * tiers stay truthful (and a lapsed payer collapses).
 *
 * Returns `consumerFreeApplied` so callers with an extra commitment requirement
 * (e.g. the connector annual-commitment gate) can exempt consumer-free users —
 * the override leaves `isManualOverride` false, so the boolean is the only signal.
 */
export async function resolveConsumerEntitlement(
  subscription: SubscriptionArg,
): Promise<{ entitlement: EffectiveEntitlement; consumerFreeApplied: boolean }> {
  const consumerFree = await isFeatureEnabled(CONSUMER_FREE_FLAG);
  const raw = getEffectiveEntitlement(subscription);
  const consumerFreeApplied = consumerFreeApplies(raw, consumerFree);
  const entitlement = consumerFreeApplied
    ? getEffectiveEntitlement(subscription, undefined, { applyConsumerFree: true })
    : raw;
  return { entitlement, consumerFreeApplied };
}

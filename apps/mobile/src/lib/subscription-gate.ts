/**
 * Backend gate codes (apps/web api-gates + plan-limits) that mean "this action
 * needs access review / an active subscription", as opposed to a transient
 * error. The mobile create flows branch on these to show a clear access path
 * instead of a generic "Try again" alert that dead-ends the user.
 */
export const UPSELL_GATE_CODES: string[] = [
  "SUBSCRIPTION_REQUIRED",
  "SUBSCRIPTION_INACTIVE",
  "TRIAL_EXPIRED",
  "ADDRESS_LIMIT_REACHED",
  "SERVICE_LIMIT_REACHED",
  "SETUP_ADDRESS_LIMIT_REACHED",
  "SETUP_SERVICE_LIMIT_REACHED",
  "SETUP_MOVING_PLAN_LIMIT_REACHED",
  "SETUP_CUSTOM_PROVIDER_LIMIT_REACHED",
  // Legacy freemium gate: stale clients can still hit this code when the server
  // refuses plan creation; surface access review instead of a dead-end retry.
  "MOVING_PLAN_UPGRADE_REQUIRED",
];

/**
 * CONSUMER_FREE / H8 guard. Under consumer-free the user has full, unlimited
 * access, so the server will not emit these limit/subscription gate codes — but
 * a stale client (or a cached payload from before the flip) could still receive
 * one. When that happens we must NOT route the user to an un-buyable "Upgrade"
 * CTA. This predicate lets a create flow recognise the contradiction and fall
 * back to a neutral message instead.
 *
 * Pass the same consumer-free signal the subscription screen uses
 * (`isMobileConsumerFreeEntitlement`). With the flag OFF `consumerFree` is
 * false and this always returns false, so existing gate handling is
 * BYTE-IDENTICAL to today.
 */
export function shouldSuppressUpsellGate(
  code: string | null | undefined,
  consumerFree: boolean,
): boolean {
  if (!consumerFree) return false;
  return Boolean(code && UPSELL_GATE_CODES.includes(code));
}

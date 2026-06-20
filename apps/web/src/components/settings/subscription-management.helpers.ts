/**
 * Pure gating for the CONSUMER_FREE "You're on Free" panel on the subscription
 * screen. Kept in a standalone module so it can be unit-tested without importing
 * the heavy client component.
 *
 * Show the free panel only once the entitlement has loaded (managementKind
 * defined) for a non-paying consumer — NEVER for a real or lapsed stripe/store
 * payer (they keep the full management screen), never while loading, never when
 * the flag is off.
 */
export function shouldShowConsumerFreePanel(input: {
  consumerFree: boolean;
  loading: boolean;
  managementKind: string | null | undefined;
}): boolean {
  if (!input.consumerFree || input.loading) return false;
  if (input.managementKind == null) return false; // entitlement not loaded yet
  return input.managementKind !== "stripe" && input.managementKind !== "store";
}

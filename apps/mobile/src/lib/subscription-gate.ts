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

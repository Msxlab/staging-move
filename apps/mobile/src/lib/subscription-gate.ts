/**
 * Backend gate codes (apps/web api-gates + plan-limits) that mean "this action
 * needs a higher plan / an active subscription", as opposed to a transient
 * error. The mobile create flows branch on these to show an Upgrade affordance
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
  // Freemium re-architecture: the moving plan is a paid unlock. A FREE user who
  // POSTs /api/moving (e.g. a stale "Start a move" entry point) gets this code;
  // surfacing the Upgrade affordance is far better than a dead-end "Try again".
  "MOVING_PLAN_UPGRADE_REQUIRED",
];

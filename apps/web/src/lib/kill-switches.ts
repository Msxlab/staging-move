import { getRuntimeConfigValue } from "@/lib/runtime-config";

/**
 * Operator kill switches — runtime-editable emergency stops (SEC-KILL).
 *
 * Both switches are managed Runtime Config keys (see
 * packages/shared/src/runtime-config.ts), so an operator can flip them from
 * the admin Runtime Config screen during an incident and they take effect on
 * the next request — no deploy. Deployment env still wins when the same key
 * is set there (standard managed-key precedence).
 *
 * Semantics:
 * - Only the exact value "true" (trimmed, case-insensitive) turns a switch ON.
 * - Unset, empty, or any other value means OFF.
 * - A failed config read also means OFF. This is deliberate fail-open for
 *   availability: a kill switch exists to let operators stop traffic during
 *   an incident — a transient DB/config outage must never be able to pause
 *   signups or silence email on its own. (The audit's RESPOND finding asks
 *   for an operator stop-button, not a default-closed gate.)
 *
 * These helpers are the single decision point for both switches; route code
 * must call them instead of re-reading the config keys.
 */
async function isKillSwitchOn(key: "KILL_SIGNUPS" | "KILL_OUTBOUND_EMAIL"): Promise<boolean> {
  const raw = await getRuntimeConfigValue(key).catch(() => null);
  return (raw || "").trim().toLowerCase() === "true";
}

/**
 * KILL_SIGNUPS — when ON, new-account creation is paused: the register route
 * and OAuth flows that would create a brand-new user return a polite 503.
 * Existing users (sign-in, OAuth sign-in/link to existing accounts) are
 * unaffected.
 */
export function areSignupsKilled(): Promise<boolean> {
  return isKillSwitchOn("KILL_SIGNUPS");
}

/**
 * KILL_OUTBOUND_EMAIL — when ON, the central email send path short-circuits
 * to a logged no-op before contacting the provider (EmailLog rows record
 * SKIPPED with reason kill_switch).
 */
export function isOutboundEmailKilled(): Promise<boolean> {
  return isKillSwitchOn("KILL_OUTBOUND_EMAIL");
}

/** Shared user-facing copy + machine code for paused signups (503 responses). */
export const SIGNUPS_PAUSED_CODE = "SIGNUPS_PAUSED";
export const SIGNUPS_PAUSED_MESSAGE =
  "New signups are temporarily paused. Please try again later.";

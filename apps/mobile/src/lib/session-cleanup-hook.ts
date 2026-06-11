/**
 * Session-cleanup hook registry.
 *
 * `clearSession()` in auth-store.ts must wipe the SAME sensitive local state
 * the manual sign-out path clears (dashboard/widget snapshots, last-plan hint,
 * onboarding cache, app-lock flag, analytics opt-out) — otherwise a forced
 * logout (401 from `onUnauthorized` or `refreshUser`, i.e. the 30-day JWT
 * expiring) leaves the previous user's PII on the device for the next account.
 *
 * The actual cleanup (`clearSensitiveLocalState` in lib/local-cleanup.ts) pulls
 * in analytics → api → auth-store, so importing it directly from auth-store
 * would create an import cycle. Instead the app root registers it here once and
 * `clearSession` invokes whatever is registered. Decoupled + cycle-free; if no
 * hook is registered (e.g. early boot before the root mounts) the call is a
 * harmless no-op.
 */

type SessionCleanupHook = () => Promise<void> | void;

let registeredHook: SessionCleanupHook | null = null;

/** Register the sensitive-state cleanup run on every session clear. */
export function setSessionCleanupHook(hook: SessionCleanupHook | null): void {
  registeredHook = hook;
}

/**
 * Run the registered cleanup hook (best-effort, never throws). Called by
 * `clearSession` so manual AND forced logouts converge on the same teardown.
 */
export async function runSessionCleanupHook(): Promise<void> {
  const hook = registeredHook;
  if (!hook) return;
  try {
    await hook();
  } catch {
    /* best-effort: a cleanup failure must never block sign-out */
  }
}

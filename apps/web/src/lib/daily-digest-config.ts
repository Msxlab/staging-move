import { getRuntimeConfigValue } from "@/lib/runtime-config";

/**
 * Single source of truth for whether the DAILY REMINDER ROLLUP owns the daily
 * email + push send.
 *
 * When ENABLED, the per-item daily reminder crons (move / task / bill /
 * bill-overdue / contract) still write their granular in-app feed entries via
 * createInAppNotification — the in-app feed stays per-item — but they SUPPRESS
 * their own per-item EMAIL + PUSH. The daily-digest cron then re-derives the
 * exact same due-today set, with the exact same per-type preference gating, and
 * sends ONE rollup email + ONE rollup push per user. Net effect: each item is
 * emailed/pushed exactly once, inside the digest, instead of ~5 separate blasts.
 *
 * When DISABLED (default), nothing changes: each cron emails + pushes per item
 * as before and the digest cron is a no-op. This keeps the rollup flag-gated so
 * it can be flipped on/off operationally without a deploy.
 *
 * Backed by runtime config (env OR the RuntimeConfigEntry table, same mechanism
 * the crons already use for NEXT_PUBLIC_APP_URL), so NO schema migration is
 * needed. Set DAILY_DIGEST_ENABLED = "true" to turn the rollup on.
 *
 * IMPORTANT — flip ATOMICITY: the gate is read ONCE per run and the resolved
 * boolean is threaded through the whole run. Both the digest cron and the
 * per-item crons fire on the SAME local-8am UTC slots, so on any given morning
 * they read the same config value. The per-day dedupe keys make a stale read at
 * a config-flip seam a no-op rather than a double- or zero-send (see the cron
 * comments).
 */
export async function isDailyDigestEnabled(): Promise<boolean> {
  try {
    const raw = await getRuntimeConfigValue("DAILY_DIGEST_ENABLED");
    return (raw || "").trim().toLowerCase() === "true";
  } catch {
    // Fail CLOSED: if we can't resolve the flag, behave as if the rollup is OFF
    // so the per-item crons keep emailing/pushing. A reminder being sent
    // per-item (the legacy behavior) is strictly safer than a reminder being
    // dropped because both sides thought the other owned the send.
    return false;
  }
}

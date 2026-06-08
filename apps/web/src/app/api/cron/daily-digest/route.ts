import { NextRequest, NextResponse } from "next/server";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendDailyDigestEmail } from "@/lib/email-service";
import { sendNotification } from "@/lib/notifications";
import { isDailyDigestEnabled } from "@/lib/daily-digest-config";
import {
  buildPushSummary,
  collectDailyDigests,
  digestDedupeKey,
} from "@/lib/daily-digest";

export const runtime = "nodejs";

/**
 * DAILY REMINDER ROLLUP cron.
 *
 * At the user's local ~8am, consolidates their due-today reminders — imminent
 * move countdown, due/overdue tasks, due bills, contract renewals — into ONE
 * rollup EMAIL + ONE rollup PUSH, instead of the ~5 separate emails + ~5 pushes
 * the per-item crons would otherwise blast at once.
 *
 * OWNERSHIP / NO DOUBLE-SEND. When DAILY_DIGEST_ENABLED is on:
 *   - the per-item crons (move/task/bill/bill-overdue/contract) STILL write
 *     their granular in-app feed entries (the feed stays per-item), but they
 *     SUPPRESS their own per-item email + push;
 *   - this cron owns the daily email + push. It re-derives the EXACT same
 *     due-today set (same queries, same tz-aware lead-day matches, same per-type
 *     preference gates — see lib/daily-digest.ts) so every item the per-item
 *     crons would have emailed is in the rollup. Each item is therefore
 *     emailed/pushed exactly once.
 * When the flag is OFF this cron is a no-op (the per-item crons own sending).
 *
 * IDEMPOTENT. One per-user-per-local-day dedupe key gates BOTH the email (via
 * EmailLog's dedupe) and the push (key + ":push"), so even though this endpoint
 * is hit on every per-zone local-8am UTC slot, a user's digest sends at most
 * once per day. The local-hour gate inside collectDailyDigests means only the
 * user's own zone-run produces their digest; the dedupe key makes any DST-seam
 * or off-grid-tz overlap a no-op.
 *
 * PREFERENCES. Honored per section: a user who muted bill emails sees no bills
 * in the email digest; the push summary counts only push-enabled kinds. If a
 * user has no deliverable item on either channel they're skipped entirely.
 *
 * Schedule: the same local-8am per-zone UTC slots as the per-item reminder
 * batch (cron.yml 12–18 UTC).
 */
async function handleCron(request: NextRequest) {
  const guard = await guardCronRequest(request, "daily-digest");
  if (!guard.ok) return guard.response;

  try {
    // When the rollup is off, the per-item crons own the daily send — do
    // nothing here so we never double-send.
    if (!(await isDailyDigestEnabled())) {
      return NextResponse.json({ ok: true, skipped: "digest-disabled" });
    }

    const now = new Date();
    const digests = await collectDailyDigests(now);

    let emailSent = 0;
    let pushSent = 0;
    let usersProcessed = 0;
    const errors: string[] = [];

    const dateLabelFor = (timeZone: string) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(now);

    for (const digest of digests) {
      usersProcessed++;
      const dedupeKey = digestDedupeKey(digest.userId, now, digest.timeZone);

      try {
        // ── ONE rollup email (only when there are email-gated sections) ──
        if (digest.email && digest.emailSections.length > 0) {
          const ok = await sendDailyDigestEmail({
            userEmail: digest.email,
            userName: digest.userName,
            dateLabel: dateLabelFor(digest.timeZone),
            moveCountdownDays: digest.moveCountdownDays,
            sections: digest.emailSections.map((s) => ({
              heading: s.heading,
              items: s.items.map((item) => ({
                label: item.label,
                detail: item.detail,
                href: item.href,
              })),
            })),
            userId: digest.userId,
            locale: digest.locale,
            dedupeKey,
            metadata: { userId: digest.userId },
          });
          if (ok) emailSent++;
        }

        // ── ONE rollup push (only when there are push-enabled kinds) ──
        const pushSummary = buildPushSummary(digest);
        if (pushSummary) {
          const pushed = await sendNotification({
            userId: digest.userId,
            type: "PUSH",
            subject: "Your day at a glance",
            body: pushSummary,
            // Distinct ":push" suffix so the email and push dedupe independently
            // but each still fires at most once per user per day.
            dedupeKey: `${dedupeKey}:push`,
            metadata: { kind: "daily-digest" },
          });
          if (pushed) pushSent++;
        }
      } catch (err) {
        errors.push(
          `daily-digest failed for user ${digest.userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      candidates: digests.length,
      usersProcessed,
      emailSent,
      pushSent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] daily-digest error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GitHub Actions / Vercel cron send GET; POST kept for parity with the others.
export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }

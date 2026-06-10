import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import { groupNotificationPreferencesByUser, isPushTypeEnabled } from "@/lib/notification-preferences";
import { daysUntilDateOnly, isReminderDeliveryHour, resolveReminderTimeZone } from "@/lib/reminder-timezone";
import { lookupMoveDayForecast } from "@/lib/nws-weather";

export const runtime = "nodejs";

// Move-week weather push — a daily, push-first companion to move-reminders.
//
// For each active moving plan whose move date is 0–3 days away (counted in the
// OWNER'S timezone) and whose DESTINATION address has coordinates, fetch the
// NWS forecast for the move date (lib/nws-weather, graceful-degradation
// contract: it never throws) and send ONE push per plan per local day:
//
//   "Moving day forecast for {city}: {summary}, high {n}°F"
//   (+ " Rain likely — protect boxes." when precip chance > 50%)
//
// Delivery + dedupe follow the reminder-cron house pattern exactly:
//  - fired on the per-US-zone 12:00–18:00 UTC GHA slots; the
//    isReminderDeliveryHour gate means each user is alerted at ~8am LOCAL and
//    every other run skips them;
//  - the in-app Notification row's @@unique([userId, channel, dedupeKey])
//    constraint is the at-most-once guarantee — the push is only sent when the
//    in-app row was newly created, so cross-run overlap is a no-op;
//  - per-user PUSH preference (type MOVE_ALERT) is honored, same type the
//    move-reminder push uses.
//
// HONESTY: this is a *forecast* and the copy says so (the in-app entry carries
// the NWS source fine-print; it informs — "protect boxes" — never alarms).
// GRACEFUL DEGRADATION: any non-"ok" forecast (no coords / beyond horizon /
// NWS down) simply skips the plan; nothing is sent and nothing is consumed, so
// the plan is retried by the next day's run.
//
// NOTIFICATION_PUSH_ENABLED is the master kill switch: when it is not "true"
// the run is a complete no-op (no DB reads, no NWS calls, and — important —
// no dedupe keys burned, so enabling the flag later doesn't lose that day's
// alerts to already-consumed keys).

// Alert when the move is today (0) through 3 days out — well inside the NWS
// ~7-day forecast horizon, so "too_far" only happens on odd grid responses.
const ALERT_WINDOW_DAYS = 3;

/** The user's local calendar date (YYYY-MM-DD) — the per-day dedupe component. */
function localDateString(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function handleCron(request: NextRequest) {
  try {
    const guard = await guardCronRequest(request, "move-week-alerts");
    if (!guard.ok) return guard.response;

    if (process.env.NOTIFICATION_PUSH_ENABLED !== "true") {
      return NextResponse.json({ success: true, skipped: "NOTIFICATION_PUSH_ENABLED is not true" });
    }

    const now = new Date();
    // Same windowing slack as move-reminders: scan with a day of slack on each
    // side, then do the exact day match per-plan in the USER'S timezone.
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 1);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + ALERT_WINDOW_DAYS + 2);

    const plans = await prisma.movingPlan.findMany({
      where: {
        moveDate: { gte: windowStart, lt: windowEnd },
        status: { in: ["PLANNING", "IN_PROGRESS"] },
        // Exclude soft-deleted owners (the extension scopes the plan, not the
        // included user relation) — mirrors move-reminders.
        user: { deletedAt: null },
        // Forecast needs a point: only plans whose DESTINATION is geocoded.
        toAddress: { latitude: { not: null }, longitude: { not: null } },
      },
      include: {
        user: { select: { id: true, profile: { select: { timezone: true } } } },
        toAddress: { select: { city: true, state: true, latitude: true, longitude: true } },
      },
      orderBy: { moveDate: "asc" },
      take: 1000,
    });

    const candidateUserIds = [...new Set(plans.map((p) => p.userId))];
    const preferenceRecords = candidateUserIds.length > 0
      ? await prisma.notificationPreference.findMany({
          where: { userId: { in: candidateUserIds } },
          select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
        })
      : [];
    const preferencesByUser = groupNotificationPreferencesByUser(preferenceRecords);

    let alerted = 0;
    let pushSent = 0;
    let skippedNoCoords = 0;
    let skippedNoForecast = 0;
    const errors: string[] = [];

    for (const plan of plans) {
      const userTimeZone = resolveReminderTimeZone(plan.user.profile?.timezone);
      // Local-time delivery gate (~8am local): each per-zone UTC run only acts
      // on its own zone's users; the per-day dedupe key makes overlap a no-op.
      if (!isReminderDeliveryHour(now, userTimeZone)) continue;

      const days = daysUntilDateOnly(plan.moveDate, now, userTimeZone);
      if (days < 0 || days > ALERT_WINDOW_DAYS) continue;

      // Push-first alert: a user who muted MOVE_ALERT pushes gets nothing
      // (no orphaned in-app row either — this alert exists FOR the push).
      const userPreferences = preferencesByUser.get(plan.userId) || [];
      if (!isPushTypeEnabled(userPreferences, "MOVE_ALERT")) continue;

      // Belt and braces — the query already filters NULL coordinates.
      const { latitude, longitude } = plan.toAddress;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        skippedNoCoords++;
        continue;
      }

      // moveDate is date-only at UTC midnight; slice the calendar day directly
      // (same convention as the dossier route's weather target date).
      const targetDate = plan.moveDate.toISOString().slice(0, 10);
      const forecast = await lookupMoveDayForecast({ latitude, longitude, targetDate });
      // Non-"ok" (NWS down / horizon / shape) → send nothing today; the key is
      // not consumed so tomorrow's run retries with a fresher forecast.
      if (forecast.status !== "ok" || (!forecast.summary && forecast.tempHighF === null)) {
        skippedNoForecast++;
        continue;
      }

      const city = plan.toAddress.city;
      const title = `Moving day forecast for ${city}`;
      const bodyParts: string[] = [];
      if (forecast.summary) bodyParts.push(forecast.summary);
      if (forecast.tempHighF !== null) bodyParts.push(`high ${Math.round(forecast.tempHighF)}°F`);
      const rainWarning =
        forecast.precipChancePct !== null && forecast.precipChancePct > 50
          ? " Rain likely — protect boxes."
          : "";
      const pushBody = `${bodyParts.join(", ")}.${rainWarning}`;
      // The in-app feed entry carries the source fine-print (push stays terse).
      const inAppBody = `${pushBody} Source: National Weather Service — forecasts can change.`;

      // ONE alert per plan per (user-local) day.
      const dedupeKey = `cron:move-week-alert:${plan.id}:${localDateString(now, userTimeZone)}`;

      try {
        const created = await createInAppNotification({
          userId: plan.userId,
          type: "MOVE_WEATHER",
          title,
          body: inAppBody,
          href: `/moving/plan/${plan.id}`,
          icon: "Calendar",
          dedupeKey,
          metadata: {
            kind: "move-week-alert",
            movingPlanId: plan.id,
            daysUntilMove: days,
            forecastDate: forecast.forecastDate,
            precipChancePct: forecast.precipChancePct,
            source: forecast.source.name,
          },
        });
        if (!created) continue; // already alerted today — dedupe hit

        alerted++;
        const pushed = await sendNotification({
          userId: plan.userId,
          type: "PUSH",
          subject: title,
          body: pushBody,
          dedupeKey: `${dedupeKey}:push`,
          // kind contains "move" → routed to the HIGH-importance Android
          // "move-alerts" channel (see lib/notifications pushChannelId).
          metadata: {
            kind: "move-week-alert",
            movingPlanId: plan.id,
            daysUntilMove: days,
          },
        });
        if (pushed) pushSent++;
      } catch (alertError) {
        errors.push(`Move-week alert failed for moving plan ${plan.id}: ${alertError}`);
      }
    }

    return NextResponse.json({
      success: true,
      alerted,
      pushSent,
      skippedNoCoords,
      skippedNoForecast,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Move-week alerts cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

// GitHub Actions cron hits GET; POST kept for parity with the other cron routes.
export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }

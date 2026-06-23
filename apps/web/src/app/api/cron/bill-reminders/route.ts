import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendBillReminderEmail } from "@/lib/email-service";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import {
  buildWebNotificationSettings,
  groupNotificationPreferencesByUser,
  isPushTypeEnabled,
  MAX_WEB_NOTIFICATION_REMINDER_DAYS,
} from "@/lib/notification-preferences";
import { isReminderDeliveryHour, nextBillingOccurrence, resolveReminderTimeZone } from "@/lib/reminder-timezone";
import { isDailyDigestEnabled } from "@/lib/daily-digest-config";

/**
 * GET /api/cron/bill-reminders
 * Sends bill reminder emails for services with upcoming billing dates.
 * Intended to be called by a cron job (e.g. Vercel Cron, GitHub Actions, or external scheduler).
 * Protected by CRON_SECRET header.
 */

export async function GET(req: Request) {
  const guard = await guardCronRequest(req, "bill-reminders");
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();
    const reminderDays = MAX_WEB_NOTIFICATION_REMINDER_DAYS;
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + reminderDays);

    // REL-003: Fix month-boundary bug — build list of billing days in the window
    const currentDay = now.getDate();
    const futureDay = futureDate.getDate();
    const spansMonthBoundary = futureDay < currentDay;

    let billingDayFilter: any;
    if (spansMonthBoundary) {
      // Window crosses month boundary (e.g., day 29 → day 2)
      // Match days >= currentDay (rest of this month) OR <= futureDay (start of next month)
      billingDayFilter = {
        OR: [
          { billingDay: { gte: currentDay, lte: 31 } },
          { billingDay: { gte: 1, lte: futureDay } },
        ],
      };
    } else {
      billingDayFilter = { AND: [{ billingDay: { not: null } }, { billingDay: { gte: currentDay, lte: futureDay } }] };
    }

    const serviceWhere = {
      ...billingDayFilter,
      monthlyCost: { gt: 0 },
      isActive: true,
      // Skip services whose owner is in the deletion grace window (soft-deleted
      // user). The soft-delete extension filters only the top-level model, not the
      // included `user` relation — so without this guard a grace-deleted user still
      // gets bill-reminder emails/push. Mirrors bill-overdue / task-reminders /
      // move-reminders / contract-reminders, which all carry this guard.
      user: { deletedAt: null },
    };

    // When the daily rollup owns the email/push send, suppress this cron's
    // per-item email + push (the digest sends them once, bundled). The in-app
    // feed entry is STILL written so the feed stays granular. Read once per run.
    const digestOwnsSend = await isDailyDigestEnabled();

    let sentCount = 0;
    let mirroredCount = 0;
    let pushSentCount = 0;
    let processed = 0;
    const errors: string[] = [];

    // 4.10a: cursor-paginate the candidate services so a large catalog can't
    // load every active billable service into memory at once. Each page is
    // bounded; preferences are batched per page.
    const PAGE_SIZE = 500;
    let cursor: string | undefined;

    for (;;) {
      const services = await prisma.service.findMany({
        where: serviceWhere,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, profile: { select: { timezone: true } } } },
        },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (services.length === 0) break;
      cursor = services[services.length - 1].id;
      processed += services.length;

      const userIds = [...new Set(services.map((service) => service.user?.id).filter(Boolean))] as string[];
      const preferences = userIds.length > 0
        ? await prisma.notificationPreference.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
          })
        : [];
      const preferencesByUser = groupNotificationPreferencesByUser(preferences);

      for (const svc of services) {
      if (!svc.user?.email) continue;
      const userPreferences = preferencesByUser.get(svc.user.id) || [];
      const notificationSettings = buildWebNotificationSettings(userPreferences);
      // Channels are independent (matches task/move-reminders). `billReminder`
      // is the EMAIL toggle; turning email off must not also kill the in-app
      // feed record + push. Skip the user entirely only when BOTH email and
      // push are off. Push checks its own type (own-type only).
      const emailAllowed =
        notificationSettings.config.emailEnabled && notificationSettings.prefs.billReminder;
      const pushAllowed = isPushTypeEnabled(userPreferences, "BILL_REMINDER");
      if (!emailAllowed && !pushAllowed) continue;

      const userTimeZone = resolveReminderTimeZone(svc.user.profile?.timezone);
      // Local ~8am delivery gate (see reminder-timezone.ts). The batch fires at
      // several UTC hours covering 8am across US zones; only the run that matches
      // this user's zone acts. Per-day dedupe keys keep any overlap idempotent.
      if (!isReminderDeliveryHour(now, userTimeZone)) continue;
      const { date: dueDate, daysUntil: daysUntilDue } = nextBillingOccurrence(
        svc.billingDay || currentDay,
        now,
        userTimeZone,
      );
      const leadDays = Number.parseInt(notificationSettings.config.reminderDays, 10);
      if (!Number.isFinite(leadDays) || daysUntilDue !== leadDays) continue;

      try {
        // dueDate is a UTC-midnight date-only value — format it in UTC so the
        // displayed day matches the user's billing day regardless of server tz.
        const dueDateText = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
        const dedupeKey = `cron:bill-reminder:${svc.id}:${dueDate.toISOString().slice(0, 10)}:${daysUntilDue}`;
        const notificationBody = `${svc.providerName} is due ${daysUntilDue === 0 ? "today" : `in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`} on ${dueDateText}.`;

        // In-app feed entry — the durable record, written whenever at least one
        // channel is on (deduped by dedupeKey on re-runs).
        try {
          const mirrored = await createInAppNotification({
            userId: svc.user.id,
            type: "BILL_REMINDER",
            title: `Bill reminder: ${svc.providerName}`,
            body: notificationBody,
            href: `/services/${svc.id}`,
            icon: "Receipt",
            dedupeKey,
            metadata: { kind: "bill-reminder", serviceId: svc.id, daysUntilDue },
          });
          if (mirrored) mirroredCount++;
        } catch (mirrorError) {
          errors.push(`In-app mirror failed for ${svc.providerName}: ${mirrorError}`);
        }

        // Email — only if the user allows email bill reminders AND the daily
        // rollup isn't the owner of the send.
        if (emailAllowed && !digestOwnsSend) {
          const success = await sendBillReminderEmail({
            userEmail: svc.user.email,
            userName: [svc.user.firstName, svc.user.lastName].filter(Boolean).join(" ") || "User",
            serviceName: svc.providerName,
            category: (svc.category || "Service").replace(/_/g, " "),
            amount: svc.monthlyCost || 0,
            dueDate: dueDateText,
            daysUntilDue,
            userId: svc.user.id,
            dedupeKey,
            metadata: { userId: svc.user.id, serviceId: svc.id },
          });
          if (success) sentCount++;
        }

        // Push — only if the user's push toggle allows it AND the daily rollup
        // isn't the owner of the send.
        if (pushAllowed && !digestOwnsSend) {
          const pushed = await sendNotification({
            userId: svc.user.id,
            type: "PUSH",
            subject: `Bill reminder: ${svc.providerName}`,
            body: notificationBody,
            dedupeKey: `${dedupeKey}:push`,
            metadata: { kind: "bill-reminder", serviceId: svc.id, daysUntilDue },
          });
          if (pushed) pushSentCount++;
        }
      } catch (err) {
        errors.push(`Failed for ${svc.providerName}: ${err}`);
      }
      }

      if (services.length < PAGE_SIZE) break;
    }

    return NextResponse.json({
      ok: true,
      processed,
      sent: sentCount,
      mirrored: mirroredCount,
      pushSent: pushSentCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] bill-reminders error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

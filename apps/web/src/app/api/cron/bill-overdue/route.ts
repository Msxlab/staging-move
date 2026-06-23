import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendBillOverdueEmail } from "@/lib/email-service";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import {
  buildWebNotificationSettings,
  groupNotificationPreferencesByUser,
  isPushTypeEnabled,
} from "@/lib/notification-preferences";
import { isReminderDeliveryHour, resolveReminderTimeZone } from "@/lib/reminder-timezone";
import { isDailyDigestEnabled } from "@/lib/daily-digest-config";
import { formatDateOnlyUtc } from "@locateflow/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

function mostRecentBillingDate(billingDay: number, now: Date) {
  const today = startOfDay(now);
  let due = new Date(now.getFullYear(), now.getMonth(), clampDay(now.getFullYear(), now.getMonth(), billingDay));
  if (due > today) {
    const prevMonth = now.getMonth() - 1;
    const year = prevMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = (prevMonth + 12) % 12;
    due = new Date(year, month, clampDay(year, month, billingDay));
  }
  return due;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
}

// `date` is a billing date constructed at LOCAL midnight (new Date(y, m, d)),
// matching the local-time day math used by startOfDay/daysBetween here. Format
// from its local calendar components in a tz-independent way (reproject the
// Y/M/D onto a UTC instant, then format in UTC) so the displayed day never
// shifts to the server's process tz — e.g. an owner testing from Turkey.
function formatDate(date: Date, locale?: string | null) {
  const lang = (locale || "").toLowerCase().startsWith("es") ? "es-US" : "en-US";
  const utcCalendarDay = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  return formatDateOnlyUtc(utcCalendarDay, { month: "short", day: "numeric", year: "numeric" }, lang);
}

export async function GET(req: Request) {
  const guard = await guardCronRequest(req, "bill-overdue");
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();

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
    // bounded; preferences are batched per page. The id cursor advances until a
    // short page signals the end.
    const PAGE_SIZE = 500;
    let cursor: string | undefined;

    for (;;) {
      const page = await prisma.service.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          billingDay: { not: null },
          monthlyCost: { gt: 0 },
          user: { deletedAt: null },
        },
        select: {
          id: true,
          userId: true,
          providerName: true,
          category: true,
          monthlyCost: true,
          billingDay: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true, profile: { select: { timezone: true } } } },
        },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (page.length === 0) break;
      cursor = page[page.length - 1].id;
      processed += page.length;

      const userIds = [...new Set(page.map((service) => service.userId))];
      const preferences = userIds.length
        ? await prisma.notificationPreference.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
          })
        : [];
      const preferencesByUser = groupNotificationPreferencesByUser(preferences);

      for (const service of page) {
      if (!service.user?.email || !service.billingDay) continue;
      // Local ~8am delivery gate (see reminder-timezone.ts). Per-day dedupe keys
      // keep any cross-run overlap idempotent.
      const userTimeZone = resolveReminderTimeZone(service.user.profile?.timezone);
      if (!isReminderDeliveryHour(now, userTimeZone)) continue;
      const dueDate = mostRecentBillingDate(service.billingDay, now);
      const daysOverdue = daysBetween(now, dueDate);
      if (daysOverdue !== 1) continue;

      const userPreferences = preferencesByUser.get(service.userId) || [];
      const notificationSettings = buildWebNotificationSettings(userPreferences);
      // Channels independent: `billOverdue` is the EMAIL toggle; email-off must
      // not also kill the in-app feed record + push. Skip only when both are off.
      const emailAllowed =
        notificationSettings.config.emailEnabled && notificationSettings.prefs.billOverdue;
      const pushAllowed = isPushTypeEnabled(userPreferences, "BILL_OVERDUE");
      if (!emailAllowed && !pushAllowed) continue;

      const dueDateText = formatDate(dueDate, service.user.preferredLocale);
      const userName = [service.user.firstName, service.user.lastName].filter(Boolean).join(" ") || "there";
      const dedupeKey = `cron:bill-overdue:${service.id}:${dueDate.toISOString().slice(0, 10)}`;
      const body = `${service.providerName} was due on ${dueDateText}.`;

      try {
        // In-app feed entry — durable record, written when ≥1 channel is on.
        try {
          const mirrored = await createInAppNotification({
            userId: service.userId,
            type: "BILL_OVERDUE",
            title: `Overdue bill: ${service.providerName}`,
            body,
            href: `/services/${service.id}`,
            icon: "Receipt",
            dedupeKey,
            metadata: { kind: "bill-overdue", serviceId: service.id, daysOverdue },
          });
          if (mirrored) mirroredCount++;
        } catch (mirrorError) {
          errors.push(`In-app mirror failed for service ${service.id}: ${mirrorError}`);
        }

        if (emailAllowed && !digestOwnsSend) {
          const success = await sendBillOverdueEmail({
            userEmail: service.user.email,
            userName,
            serviceName: service.providerName,
            category: (service.category || "Service").replace(/_/g, " "),
            amount: service.monthlyCost || 0,
            dueDate: dueDateText,
            daysOverdue,
            serviceId: service.id,
            userId: service.userId,
            locale: service.user.preferredLocale,
            dedupeKey,
            metadata: { userId: service.userId, serviceId: service.id },
          });
          if (success) sentCount++;
        }

        if (pushAllowed && !digestOwnsSend) {
          const pushed = await sendNotification({
            userId: service.userId,
            type: "PUSH",
            subject: `Overdue bill: ${service.providerName}`,
            body,
            dedupeKey: `${dedupeKey}:push`,
            metadata: { kind: "bill-overdue", serviceId: service.id, daysOverdue },
          });
          if (pushed) pushSentCount++;
        }
      } catch (err) {
        errors.push(`Failed for service ${service.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
      }

      if (page.length < PAGE_SIZE) break;
    }

    return NextResponse.json({
      ok: true,
      processed,
      sent: sentCount,
      mirrored: mirroredCount,
      pushSent: pushSentCount,
      errors: errors.length ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] bill-overdue error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

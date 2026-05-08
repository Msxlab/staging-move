import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendBillReminderEmail } from "@/lib/email-service";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import {
  buildWebNotificationSettings,
  getDaysUntilDate,
  getNextBillingDate,
  groupNotificationPreferencesByUser,
  isPushTypeEnabled,
  MAX_WEB_NOTIFICATION_REMINDER_DAYS,
} from "@/lib/notification-preferences";

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

    const services = await prisma.service.findMany({
      where: {
        ...billingDayFilter,
        monthlyCost: { gt: 0 },
        isActive: true,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    const userIds = [...new Set(services.map((service) => service.user?.id).filter(Boolean))] as string[];
    const preferences = userIds.length > 0
      ? await prisma.notificationPreference.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
        })
      : [];
    const preferencesByUser = groupNotificationPreferencesByUser(preferences);

    let sentCount = 0;
    let mirroredCount = 0;
    let pushSentCount = 0;
    const errors: string[] = [];

    for (const svc of services) {
      if (!svc.user?.email) continue;
      const userPreferences = preferencesByUser.get(svc.user.id) || [];
      const notificationSettings = buildWebNotificationSettings(userPreferences);
      if (!notificationSettings.config.emailEnabled || !notificationSettings.prefs.billReminder) continue;

      const dueDate = getNextBillingDate(svc.billingDay || currentDay, now);
      const daysUntilDue = getDaysUntilDate(dueDate, now);
      const leadDays = Number.parseInt(notificationSettings.config.reminderDays, 10);
      if (!Number.isFinite(leadDays) || daysUntilDue !== leadDays) continue;

      try {
        const dueDateText = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const dedupeKey = `cron:bill-reminder:${svc.id}:${dueDate.toISOString().slice(0, 10)}:${daysUntilDue}`;
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
          metadata: {
            userId: svc.user.id,
            serviceId: svc.id,
          },
        });

        if (success) {
          sentCount++;
          try {
            const notificationBody = `${svc.providerName} is due ${daysUntilDue === 0 ? "today" : `in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`} on ${dueDateText}.`;
            const mirrored = await createInAppNotification({
              userId: svc.user.id,
              type: "BILL_REMINDER",
              title: `Bill reminder: ${svc.providerName}`,
              body: notificationBody,
              href: `/services/${svc.id}`,
              icon: "Receipt",
              dedupeKey,
              metadata: {
                kind: "bill-reminder",
                serviceId: svc.id,
                daysUntilDue,
                channelMirror: "EMAIL",
              },
            });
            if (mirrored) {
              mirroredCount++;
              if (isPushTypeEnabled(userPreferences, ["BILL_REMINDER", "TASK_REMINDER"])) {
                const pushed = await sendNotification({
                  userId: svc.user.id,
                  type: "PUSH",
                  subject: `Bill reminder: ${svc.providerName}`,
                  body: notificationBody,
                  dedupeKey: `${dedupeKey}:push`,
                  metadata: {
                    kind: "bill-reminder",
                    serviceId: svc.id,
                    daysUntilDue,
                  },
                });
                if (pushed) pushSentCount++;
              }
            }
          } catch (mirrorError) {
            errors.push(`In-app mirror failed for ${svc.providerName}: ${mirrorError}`);
          }
        }
      } catch (err) {
        errors.push(`Failed for ${svc.providerName}: ${err}`);
      }
    }

    return NextResponse.json({
      ok: true,
      processed: services.length,
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

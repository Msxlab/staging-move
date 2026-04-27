import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendBillReminderEmail } from "@/lib/email-service";
import { verifyInternalAuth } from "@/lib/internal-secrets";
import {
  buildWebNotificationSettings,
  getDaysUntilDate,
  getNextBillingDate,
  groupNotificationPreferencesByUser,
  MAX_WEB_NOTIFICATION_REMINDER_DAYS,
} from "@/lib/notification-preferences";

/**
 * GET /api/cron/bill-reminders
 * Sends bill reminder emails for services with upcoming billing dates.
 * Intended to be called by a cron job (e.g. Vercel Cron, GitHub Actions, or external scheduler).
 * Protected by CRON_SECRET header.
 */
export async function GET(req: Request) {
  // SEC-003: Fail-closed — reject if no matching cron secret configured.
  if (!verifyInternalAuth(req.headers.get("authorization"), "cron")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const errors: string[] = [];

    for (const svc of services) {
      if (!svc.user?.email) continue;
      const notificationSettings = buildWebNotificationSettings(preferencesByUser.get(svc.user.id) || []);
      if (!notificationSettings.config.emailEnabled || !notificationSettings.prefs.billReminder) continue;

      const dueDate = getNextBillingDate(svc.billingDay || currentDay, now);
      const daysUntilDue = getDaysUntilDate(dueDate, now);
      const leadDays = Number.parseInt(notificationSettings.config.reminderDays, 10);
      if (!Number.isFinite(leadDays) || daysUntilDue !== leadDays) continue;

      try {
        const success = await sendBillReminderEmail({
          userEmail: svc.user.email,
          userName: [svc.user.firstName, svc.user.lastName].filter(Boolean).join(" ") || "User",
          serviceName: svc.providerName,
          category: (svc.category || "Service").replace(/_/g, " "),
          amount: svc.monthlyCost || 0,
          dueDate: dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          daysUntilDue,
          userId: svc.user.id,
          dedupeKey: `cron:bill-reminder:${svc.id}:${dueDate.toISOString().slice(0, 10)}:${daysUntilDue}`,
          metadata: {
            userId: svc.user.id,
            serviceId: svc.id,
          },
        });

        if (success) sentCount++;
      } catch (err) {
        errors.push(`Failed for ${svc.providerName}: ${err}`);
      }
    }

    return NextResponse.json({
      ok: true,
      processed: services.length,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] bill-reminders error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

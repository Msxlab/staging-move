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

function formatDate(date: Date, locale?: string | null) {
  const lang = (locale || "").toLowerCase().startsWith("es") ? "es-US" : "en-US";
  return date.toLocaleDateString(lang, { month: "short", day: "numeric", year: "numeric" });
}

export async function GET(req: Request) {
  const guard = await guardCronRequest(req, "bill-overdue");
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();
    const services = await prisma.service.findMany({
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
        user: { select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true } },
      },
    });

    const userIds = [...new Set(services.map((service) => service.userId))];
    const preferences = userIds.length
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

    for (const service of services) {
      if (!service.user?.email || !service.billingDay) continue;
      const dueDate = mostRecentBillingDate(service.billingDay, now);
      const daysOverdue = daysBetween(now, dueDate);
      if (daysOverdue !== 1) continue;

      const userPreferences = preferencesByUser.get(service.userId) || [];
      const notificationSettings = buildWebNotificationSettings(userPreferences);
      if (!notificationSettings.config.emailEnabled || !notificationSettings.prefs.billOverdue) continue;

      const dueDateText = formatDate(dueDate, service.user.preferredLocale);
      const userName = [service.user.firstName, service.user.lastName].filter(Boolean).join(" ") || "there";
      const dedupeKey = `cron:bill-overdue:${service.id}:${dueDate.toISOString().slice(0, 10)}`;

      try {
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

        if (success) {
          sentCount++;
          const body = `${service.providerName} was due on ${dueDateText}.`;
          const mirrored = await createInAppNotification({
            userId: service.userId,
            type: "BILL_OVERDUE",
            title: `Overdue bill: ${service.providerName}`,
            body,
            href: `/services/${service.id}`,
            icon: "Receipt",
            dedupeKey,
            metadata: {
              kind: "bill-overdue",
              serviceId: service.id,
              daysOverdue,
              channelMirror: "EMAIL",
            },
          });
          if (mirrored) {
            mirroredCount++;
            if (isPushTypeEnabled(userPreferences, ["BILL_OVERDUE", "BILL_REMINDER"])) {
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
          }
        }
      } catch (err) {
        errors.push(`Failed for service ${service.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      processed: services.length,
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

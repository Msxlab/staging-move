import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendContractReminderEmail } from "@/lib/email-service";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import { buildWebNotificationSettings, groupNotificationPreferencesByUser, isPushTypeEnabled } from "@/lib/notification-preferences";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { daysUntilDateOnly, isReminderDeliveryHour, resolveReminderTimeZone } from "@/lib/reminder-timezone";
import { isDailyDigestEnabled } from "@/lib/daily-digest-config";
import { formatDateOnlyUtc } from "@locateflow/shared";

export const runtime = "nodejs";

async function handleCron(request: NextRequest) {
  try {
    const guard = await guardCronRequest(request, "contract-reminders");
    if (!guard.ok) return guard.response;

    const now = new Date();
    const reminderDays = [30, 14, 7, 1];
    const appUrl =
      (await getRuntimeConfigValue("NEXT_PUBLIC_APP_URL")) ||
      "http://localhost:3000";
    let sent = 0;
    let mirrored = 0;
    let pushSent = 0;
    const errors: string[] = [];

    // Scan all contracts ending within the window (one day of slack on each
    // side), then decide per-service whether it's an exact lead-day match in
    // THE USER'S timezone, so a far-timezone user isn't reminded on the wrong
    // local day or skipped by the exact integer match.
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 1);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + Math.max(...reminderDays) + 2);

    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        contractEndDate: { gte: windowStart, lt: windowEnd },
        // Soft-delete scopes the service row but not the included user —
        // skip services whose owner was deleted (mirrors task-reminders).
        user: { deletedAt: null },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, profile: { select: { timezone: true } } } },
      },
      orderBy: { contractEndDate: "asc" },
      take: 1000,
    });

    const userIds = [...new Set(services.map((service) => service.user?.id).filter(Boolean))] as string[];
    const preferenceRecords = userIds.length > 0
      ? await prisma.notificationPreference.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
        })
      : [];
    const preferencesByUser = groupNotificationPreferencesByUser(preferenceRecords);

    // When the daily rollup owns the email/push send, suppress this cron's
    // per-item email + push (the digest sends them once, bundled). The in-app
    // feed entry is STILL written so the feed stays granular. Read once per run.
    const digestOwnsSend = await isDailyDigestEnabled();

    {
      for (const service of services) {
        if (!service.user?.email || !service.contractEndDate) continue;
        const userTimeZone = resolveReminderTimeZone(service.user.profile?.timezone);
        // Local ~8am delivery gate (see reminder-timezone.ts). Per-day dedupe
        // keys keep any cross-run overlap idempotent.
        if (!isReminderDeliveryHour(now, userTimeZone)) continue;
        const days = daysUntilDateOnly(service.contractEndDate, now, userTimeZone);
        if (!reminderDays.includes(days)) continue;

        const userPreferences = preferencesByUser.get(service.user.id) || [];
        const notificationSettings = buildWebNotificationSettings(userPreferences);
        // Channels independent: `contractExpiring` is the EMAIL toggle; email-off
        // must not also kill the in-app feed record + push. Skip only when both off.
        const emailAllowed =
          notificationSettings.config.emailEnabled && notificationSettings.prefs.contractExpiring;
        const pushAllowed = isPushTypeEnabled(userPreferences, "CONTRACT_EXPIRY");
        if (!emailAllowed && !pushAllowed) continue;

        // contractEndDate is a date-only value stored at UTC midnight — format
        // in UTC so the displayed day is stable across server timezones.
        const contractEndDateText = formatDateOnlyUtc(service.contractEndDate!, { month: "long", day: "numeric", year: "numeric" });
        const dedupeKey = `cron:contract-reminder:${service.id}:${service.contractEndDate!.toISOString().slice(0, 10)}:${days}`;
        const notificationTitle = `${service.providerName} contract ends soon`;
        const notificationBody = `${service.providerName} ends in ${days} day${days === 1 ? "" : "s"} on ${contractEndDateText}.`;

        try {
          // In-app feed entry — durable record, written when ≥1 channel is on.
          try {
            const created = await createInAppNotification({
              userId: service.user.id,
              type: "CONTRACT_EXPIRY",
              title: notificationTitle,
              body: notificationBody,
              href: `/services/${service.id}`,
              icon: "Clock",
              dedupeKey,
              metadata: { kind: "contract-reminder", serviceId: service.id, daysRemaining: days },
            });
            if (created) mirrored++;
          } catch (mirrorError) {
            errors.push(`In-app mirror failed for ${service.providerName}: ${mirrorError}`);
          }

          if (emailAllowed && !digestOwnsSend) {
            const success = await sendContractReminderEmail({
              userEmail: service.user.email,
              userName: [service.user.firstName, service.user.lastName].filter(Boolean).join(" ") || "there",
              serviceName: service.providerName,
              contractEndDate: contractEndDateText,
              daysRemaining: days,
              serviceLink: `${appUrl}/services/${service.id}`,
              userId: service.user.id,
              dedupeKey,
              metadata: { userId: service.user.id, serviceId: service.id },
            });
            if (success) sent++;
          }

          if (pushAllowed && !digestOwnsSend) {
            const pushed = await sendNotification({
              userId: service.user.id,
              type: "PUSH",
              subject: notificationTitle,
              body: notificationBody,
              dedupeKey: `${dedupeKey}:push`,
              metadata: { kind: "contract-reminder", serviceId: service.id, daysRemaining: days },
            });
            if (pushed) pushSent++;
          }
        } catch (err) {
          errors.push(`Failed for ${service.providerName}: ${err}`);
        }
      }
    }

    return NextResponse.json({ success: true, sent, mirrored, pushSent, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error("Contract reminders cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }

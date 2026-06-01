import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendContractReminderEmail } from "@/lib/email-service";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import { buildWebNotificationSettings, groupNotificationPreferencesByUser, isPushTypeEnabled } from "@/lib/notification-preferences";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

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

    for (const days of reminderDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const services = await prisma.service.findMany({
        where: {
          isActive: true,
          contractEndDate: { gte: startOfDay, lt: endOfDay },
          // Soft-delete scopes the service row but not the included user —
          // skip services whose owner was deleted (mirrors task-reminders).
          user: { deletedAt: null },
        },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      const userIds = [...new Set(services.map((service) => service.user?.id).filter(Boolean))] as string[];
      const preferenceRecords = userIds.length > 0
        ? await prisma.notificationPreference.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
          })
        : [];
      const preferencesByUser = groupNotificationPreferencesByUser(preferenceRecords);

      for (const service of services) {
        if (!service.user?.email) continue;

        const userPreferences = preferencesByUser.get(service.user.id) || [];
        const notificationSettings = buildWebNotificationSettings(userPreferences);
        if (!notificationSettings.config.emailEnabled || !notificationSettings.prefs.contractExpiring) continue;

        const contractEndDateText = service.contractEndDate!.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const dedupeKey = `cron:contract-reminder:${service.id}:${service.contractEndDate!.toISOString().slice(0, 10)}:${days}`;
        const success = await sendContractReminderEmail({
          userEmail: service.user.email,
          userName: [service.user.firstName, service.user.lastName].filter(Boolean).join(" ") || "there",
          serviceName: service.providerName,
          contractEndDate: contractEndDateText,
          daysRemaining: days,
          serviceLink: `${appUrl}/services/${service.id}`,
          userId: service.user.id,
          dedupeKey,
          metadata: {
            userId: service.user.id,
            serviceId: service.id,
          },
        });

        if (success) {
          sent++;
          try {
            const notificationTitle = `${service.providerName} contract ends soon`;
            const notificationBody = `${service.providerName} ends in ${days} day${days === 1 ? "" : "s"} on ${contractEndDateText}.`;
            const created = await createInAppNotification({
              userId: service.user.id,
              type: "CONTRACT_EXPIRY",
              title: notificationTitle,
              body: notificationBody,
              href: `/services/${service.id}`,
              icon: "Clock",
              dedupeKey,
              metadata: {
                kind: "contract-reminder",
                serviceId: service.id,
                daysRemaining: days,
                channelMirror: "EMAIL",
              },
            });
            if (created) {
              mirrored++;
              // Own type only — a cross-type fallback list let disabling "push
              // task reminders" silently suppress contract-expiry push.
              if (isPushTypeEnabled(userPreferences, "CONTRACT_EXPIRY")) {
                const pushed = await sendNotification({
                  userId: service.user.id,
                  type: "PUSH",
                  subject: notificationTitle,
                  body: notificationBody,
                  dedupeKey: `${dedupeKey}:push`,
                  metadata: {
                    kind: "contract-reminder",
                    serviceId: service.id,
                    daysRemaining: days,
                  },
                });
                if (pushed) pushSent++;
              }
            }
          } catch (mirrorError) {
            errors.push(`In-app mirror failed for ${service.providerName}: ${mirrorError}`);
          }
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

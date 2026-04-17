import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendContractReminderEmail } from "@/lib/email-service";
import { buildWebNotificationSettings, groupNotificationPreferencesByUser } from "@/lib/notification-preferences";

export const runtime = "nodejs";

async function handleCron(request: NextRequest) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || expectedSecret.length < 16) {
      console.error("CRON_SECRET is not configured or too short");
      return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
    }

    const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!cronSecret || cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const reminderDays = [30, 14, 7, 1];
    let sent = 0;

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

        const notificationSettings = buildWebNotificationSettings(preferencesByUser.get(service.user.id) || []);
        if (!notificationSettings.config.emailEnabled || !notificationSettings.prefs.contractExpiring) continue;

        const success = await sendContractReminderEmail({
          userEmail: service.user.email,
          userName: [service.user.firstName, service.user.lastName].filter(Boolean).join(" ") || "there",
          serviceName: service.providerName,
          contractEndDate: service.contractEndDate!.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          daysRemaining: days,
          serviceLink: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/services/${service.id}`,
          dedupeKey: `cron:contract-reminder:${service.id}:${service.contractEndDate!.toISOString().slice(0, 10)}:${days}`,
          metadata: {
            userId: service.user.id,
            serviceId: service.id,
          },
        });

        if (success) sent++;
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error("Contract reminders cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }

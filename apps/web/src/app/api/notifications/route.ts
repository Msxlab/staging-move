import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import {
  buildWebNotificationSettings,
  normalizeDigestDay,
  normalizeReminderDays,
  WEB_NOTIFICATION_CONFIG_DEFINITIONS,
  WEB_NOTIFICATION_PREFERENCE_DEFINITIONS,
} from "@/lib/notification-preferences";

// GET /api/notifications
export async function GET() {
  try {
    const userId = await requireDbUserId();

    const stored = await prisma.notificationPreference.findMany({ where: { userId } });
    const settings = buildWebNotificationSettings(stored);

    return NextResponse.json({ prefs: settings.prefs, config: settings.config });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to fetch notification prefs:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST /api/notifications
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const body = await request.json();

    await Promise.all(
      WEB_NOTIFICATION_PREFERENCE_DEFINITIONS.map((definition) => {
        if (typeof body[definition.key] !== "boolean") return Promise.resolve(null);

        return prisma.notificationPreference.upsert({
          where: { userId_channel_type: { userId, channel: definition.channel, type: definition.type } },
          update: { enabled: body[definition.key], frequency: definition.frequency },
          create: {
            userId,
            channel: definition.channel,
            type: definition.type,
            enabled: body[definition.key],
            frequency: definition.frequency,
          },
        });
      })
    );

    const emailEnabled = typeof body.emailEnabled === "boolean"
      ? body.emailEnabled
      : typeof body._emailEnabled === "boolean"
        ? body._emailEnabled
        : undefined;
    const digestDay = typeof body.digestDay === "string"
      ? body.digestDay
      : typeof body._digestDay === "string"
        ? body._digestDay
        : undefined;
    const reminderDays = typeof body.reminderDays === "string"
      ? body.reminderDays
      : typeof body._reminderDays === "string"
        ? body._reminderDays
        : undefined;

    const [emailConfig, digestConfig, reminderConfig] = WEB_NOTIFICATION_CONFIG_DEFINITIONS;
    const configWrites: Promise<unknown>[] = [];

    if (emailEnabled !== undefined) {
      configWrites.push(
        prisma.notificationPreference.upsert({
          where: { userId_channel_type: { userId, channel: emailConfig.channel, type: emailConfig.type } },
          update: { enabled: emailEnabled, frequency: emailConfig.defaultFrequency },
          create: {
            userId,
            channel: emailConfig.channel,
            type: emailConfig.type,
            enabled: emailEnabled,
            frequency: emailConfig.defaultFrequency,
          },
        })
      );
    }

    if (digestDay !== undefined) {
      // Coerce to a known day before storing so an out-of-range or oversized
      // value can't overflow the VarChar(20) frequency column (failing the
      // whole save) or persist a value the read path would silently discard.
      const normalizedDigestDay = normalizeDigestDay(digestDay);
      configWrites.push(
        prisma.notificationPreference.upsert({
          where: { userId_channel_type: { userId, channel: digestConfig.channel, type: digestConfig.type } },
          update: { enabled: true, frequency: normalizedDigestDay },
          create: {
            userId,
            channel: digestConfig.channel,
            type: digestConfig.type,
            enabled: true,
            frequency: normalizedDigestDay,
          },
        })
      );
    }

    if (reminderDays !== undefined) {
      const normalizedReminderDays = normalizeReminderDays(reminderDays);
      configWrites.push(
        prisma.notificationPreference.upsert({
          where: { userId_channel_type: { userId, channel: reminderConfig.channel, type: reminderConfig.type } },
          update: { enabled: true, frequency: normalizedReminderDays },
          create: {
            userId,
            channel: reminderConfig.channel,
            type: reminderConfig.type,
            enabled: true,
            frequency: normalizedReminderDays,
          },
        })
      );
    }

    await Promise.all(configWrites);

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "UPDATE", entityType: "NotificationPreference", entityId: userId, route: "/api/notifications" });

    const stored = await prisma.notificationPreference.findMany({ where: { userId } });
    const settings = buildWebNotificationSettings(stored);

    return NextResponse.json({ prefs: settings.prefs, config: settings.config, success: true });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to save notification prefs:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

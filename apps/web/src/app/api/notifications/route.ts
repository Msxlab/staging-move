import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import {
  buildWebNotificationSettings,
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
      configWrites.push(
        prisma.notificationPreference.upsert({
          where: { userId_channel_type: { userId, channel: digestConfig.channel, type: digestConfig.type } },
          update: { enabled: true, frequency: digestDay },
          create: {
            userId,
            channel: digestConfig.channel,
            type: digestConfig.type,
            enabled: true,
            frequency: digestDay,
          },
        })
      );
    }

    if (reminderDays !== undefined) {
      configWrites.push(
        prisma.notificationPreference.upsert({
          where: { userId_channel_type: { userId, channel: reminderConfig.channel, type: reminderConfig.type } },
          update: { enabled: true, frequency: reminderDays },
          create: {
            userId,
            channel: reminderConfig.channel,
            type: reminderConfig.type,
            enabled: true,
            frequency: reminderDays,
          },
        })
      );
    }

    await Promise.all(configWrites);

    const stored = await prisma.notificationPreference.findMany({ where: { userId } });
    const settings = buildWebNotificationSettings(stored);

    return NextResponse.json({ prefs: settings.prefs, config: settings.config, success: true });
  } catch (error) {
    console.error("Failed to save notification prefs:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

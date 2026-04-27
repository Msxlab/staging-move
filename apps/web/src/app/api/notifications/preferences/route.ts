import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";

const MOBILE_NOTIFICATION_PREFERENCES = [
  { key: "emailTaskReminders", channel: "EMAIL", type: "TASK_REMINDER", enabled: true, frequency: "IMMEDIATE" },
  { key: "emailWeeklyDigest", channel: "EMAIL", type: "WEEKLY_DIGEST", enabled: false, frequency: "WEEKLY" },
  { key: "emailMoveAlerts", channel: "EMAIL", type: "MOVE_ALERT", enabled: true, frequency: "IMMEDIATE" },
  { key: "pushTaskReminders", channel: "PUSH", type: "TASK_REMINDER", enabled: false, frequency: "IMMEDIATE" },
  { key: "pushMoveAlerts", channel: "PUSH", type: "MOVE_ALERT", enabled: false, frequency: "IMMEDIATE" },
  { key: "pushStreakReminders", channel: "PUSH", type: "STREAK_REMINDER", enabled: false, frequency: "IMMEDIATE" },
] as const;

function buildPreferencesObject(records: any[]) {
  const recordMap = new Map(records.map((record: any) => [`${record.channel}:${record.type}`, record]));

  return MOBILE_NOTIFICATION_PREFERENCES.reduce<Record<string, boolean>>((acc, pref) => {
    const record = recordMap.get(`${pref.channel}:${pref.type}`);
    acc[pref.key] = record ? record.enabled : pref.enabled;
    return acc;
  }, {});
}

export async function GET() {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await prisma.notificationPreference.findMany({ where: { userId } });
  return NextResponse.json({ preferences: buildPreferencesObject(preferences) });
}

export async function PUT(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body && typeof body === "object" && MOBILE_NOTIFICATION_PREFERENCES.some((pref) => pref.key in body)) {
    await Promise.all(
      MOBILE_NOTIFICATION_PREFERENCES.map((pref) => {
        if (typeof body[pref.key] !== "boolean") {
          return Promise.resolve(null);
        }

        return prisma.notificationPreference.upsert({
          where: { userId_channel_type: { userId, channel: pref.channel, type: pref.type } },
          update: { enabled: body[pref.key], frequency: pref.frequency },
          create: { userId, channel: pref.channel, type: pref.type, enabled: body[pref.key], frequency: pref.frequency },
        });
      })
    );

    const preferences = await prisma.notificationPreference.findMany({ where: { userId } });
    return NextResponse.json({ preferences: buildPreferencesObject(preferences) });
  }

  const { channel, type, enabled, frequency } = body;

  const pref = await prisma.notificationPreference.upsert({
    where: { userId_channel_type: { userId, channel, type } },
    update: { enabled, frequency },
    create: { userId, channel, type, enabled, frequency: frequency || "IMMEDIATE" },
  });

  return NextResponse.json(pref);
}

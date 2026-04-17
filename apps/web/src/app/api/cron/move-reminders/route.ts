import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMoveReminderEmail } from "@/lib/email-service";
import { buildWebNotificationSettings, groupNotificationPreferencesByUser } from "@/lib/notification-preferences";

export const runtime = "nodejs";

// Cron handler for move reminders — Send reminders 7, 3, 1 days before move
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
    const reminderDays = [7, 3, 1];
    const preferenceRecords = await prisma.notificationPreference.findMany({
      select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
    });
    const preferencesByUser = groupNotificationPreferencesByUser(preferenceRecords);
    let sent = 0;

    for (const days of reminderDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const plans = await prisma.movingPlan.findMany({
        where: {
          moveDate: { gte: startOfDay, lt: endOfDay },
          status: { in: ["PLANNING", "IN_PROGRESS"] },
        },
        include: {
          user: { select: { email: true, firstName: true } },
          fromAddress: { select: { city: true, state: true } },
          toAddress: { select: { city: true, state: true } },
        },
      });

      for (const plan of plans) {
        const notificationSettings = buildWebNotificationSettings(preferencesByUser.get(plan.userId) || []);
        if (!notificationSettings.config.emailEnabled || !notificationSettings.prefs.moveUpdate) continue;
        if (!plan.user.email) continue;

        const success = await sendMoveReminderEmail({
          userEmail: plan.user.email,
          userName: plan.user.firstName || "",
          fromCity: `${plan.fromAddress.city}, ${plan.fromAddress.state}`,
          toCity: `${plan.toAddress.city}, ${plan.toAddress.state}`,
          moveDate: plan.moveDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          daysRemaining: days,
          completedTasks: plan.completedTasks,
          totalTasks: plan.totalTasks,
          dedupeKey: `cron:move-reminder:${plan.id}:${plan.moveDate.toISOString().slice(0, 10)}:${days}`,
          metadata: {
            userId: plan.userId,
            movingPlanId: plan.id,
          },
        });
        if (success) sent++;
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error("Move reminders cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

// Vercel cron sends GET requests
export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }

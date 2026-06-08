import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMoveReminderEmail } from "@/lib/email-service";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import { buildWebNotificationSettings, groupNotificationPreferencesByUser, isPushTypeEnabled } from "@/lib/notification-preferences";
import { daysUntilDateOnly, resolveReminderTimeZone } from "@/lib/reminder-timezone";

export const runtime = "nodejs";

// Cron handler for move reminders — Send reminders 7, 3, 1 days before move
async function handleCron(request: NextRequest) {
  try {
    const guard = await guardCronRequest(request, "move-reminders");
    if (!guard.ok) return guard.response;

    const now = new Date();
    const reminderDays = [7, 3, 1];
    // Scan all upcoming moves once over a window with a day of slack on each
    // side, then decide per-plan whether it's an exact lead-day match in THE
    // USER'S timezone (the previous per-day server-time window could fire on
    // the wrong local calendar day or miss the exact match for far timezones).
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 1);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + Math.max(...reminderDays) + 2);
    const plans = await prisma.movingPlan.findMany({
      where: {
        moveDate: { gte: windowStart, lt: windowEnd },
        status: { in: ["PLANNING", "IN_PROGRESS"] },
        // The soft-delete extension scopes the plan itself, but not the
        // included user relation — exclude plans whose owner was deleted so
        // we don't email a removed account (mirrors task-reminders).
        user: { deletedAt: null },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, profile: { select: { timezone: true } } } },
        fromAddress: { select: { city: true, state: true } },
        toAddress: { select: { city: true, state: true } },
      },
      orderBy: { moveDate: "asc" },
      take: 1000,
    });
    const candidateUserIds = [...new Set(plans.map((p) => p.userId))];
    const preferenceRecords = candidateUserIds.length > 0
      ? await prisma.notificationPreference.findMany({
          where: { userId: { in: candidateUserIds } },
          select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
        })
      : [];
    const preferencesByUser = groupNotificationPreferencesByUser(preferenceRecords);
    let sent = 0;
    let mirrored = 0;
    let pushSent = 0;
    const errors: string[] = [];

    {
      for (const plan of plans) {
        const userTimeZone = resolveReminderTimeZone(plan.user.profile?.timezone);
        const days = daysUntilDateOnly(plan.moveDate, now, userTimeZone);
        if (!reminderDays.includes(days)) continue;

        const userPreferences = preferencesByUser.get(plan.userId) || [];
        const notificationSettings = buildWebNotificationSettings(userPreferences);
        const emailAllowed = Boolean(
          plan.user.email &&
          notificationSettings.config.emailEnabled &&
          notificationSettings.prefs.moveUpdate
        );
        const pushAllowed = isPushTypeEnabled(userPreferences, "MOVE_ALERT");
        if (!emailAllowed && !pushAllowed) continue;

        const fromCity = `${plan.fromAddress.city}, ${plan.fromAddress.state}`;
        const toCity = `${plan.toAddress.city}, ${plan.toAddress.state}`;
        const moveDateText = plan.moveDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const dedupeKey = `cron:move-reminder:${plan.id}:${plan.moveDate.toISOString().slice(0, 10)}:${days}`;
        let emailSent = false;
        if (emailAllowed) {
          emailSent = await sendMoveReminderEmail({
            userEmail: plan.user.email!,
            userName: plan.user.firstName || "",
            fromCity,
            toCity,
            moveDate: moveDateText,
            daysRemaining: days,
            userId: plan.userId,
            dedupeKey,
            metadata: {
              userId: plan.userId,
              movingPlanId: plan.id,
            },
          });
          if (emailSent) sent++;
        }

        try {
          const notificationTitle = days === 1 ? "Your move is tomorrow" : `Your move is in ${days} days`;
          const notificationBody = `Your move from ${fromCity} to ${toCity} is scheduled for ${moveDateText}.`;
          const created = await createInAppNotification({
            userId: plan.userId,
            type: "MOVE_REMINDER",
            title: notificationTitle,
            body: notificationBody,
            href: `/moving/plan/${plan.id}`,
            icon: "Calendar",
            dedupeKey,
            metadata: {
              kind: "move-reminder",
              movingPlanId: plan.id,
              daysRemaining: days,
              channelMirror: emailSent ? "EMAIL" : pushAllowed ? "PUSH" : "IN_APP",
            },
          });
          if (created) {
            mirrored++;
            if (pushAllowed) {
              const pushed = await sendNotification({
                userId: plan.userId,
                type: "PUSH",
                subject: notificationTitle,
                body: notificationBody,
                dedupeKey: `${dedupeKey}:push`,
                metadata: {
                  kind: "move-reminder",
                  movingPlanId: plan.id,
                  daysRemaining: days,
                },
              });
              if (pushed) pushSent++;
            }
          }
        } catch (mirrorError) {
          errors.push(`In-app mirror failed for moving plan ${plan.id}: ${mirrorError}`);
        }
      }
    }

    return NextResponse.json({ success: true, sent, mirrored, pushSent, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error("Move reminders cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

// Vercel cron sends GET requests
export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }

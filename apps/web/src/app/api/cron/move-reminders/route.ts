import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMoveReminderEmail } from "@/lib/email-service";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import { buildWebNotificationSettings, groupNotificationPreferencesByUser, isPushTypeEnabled } from "@/lib/notification-preferences";

export const runtime = "nodejs";

// Cron handler for move reminders — Send reminders 7, 3, 1 days before move
async function handleCron(request: NextRequest) {
  try {
    const guard = await guardCronRequest(request, "move-reminders");
    if (!guard.ok) return guard.response;

    const now = new Date();
    const reminderDays = [7, 3, 1];
    // Bound the preference read to users who actually have an upcoming move in
    // the reminder window — the previous unfiltered findMany loaded EVERY
    // user's preferences into memory on every run. The extra userId-only scan
    // is far cheaper than the full-table read it replaces.
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + Math.max(...reminderDays) + 1);
    const candidatePlans = await prisma.movingPlan.findMany({
      where: {
        moveDate: { gte: now, lt: windowEnd },
        status: { in: ["PLANNING", "IN_PROGRESS"] },
        user: { deletedAt: null },
      },
      select: { userId: true },
    });
    const candidateUserIds = [...new Set(candidatePlans.map((p) => p.userId))];
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
          // The soft-delete extension scopes the plan itself, but not the
          // included user relation — exclude plans whose owner was deleted so
          // we don't email a removed account (mirrors task-reminders).
          user: { deletedAt: null },
        },
        include: {
          user: { select: { email: true, firstName: true } },
          fromAddress: { select: { city: true, state: true } },
          toAddress: { select: { city: true, state: true } },
        },
      });

      for (const plan of plans) {
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
            href: `/moving/${plan.id}`,
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

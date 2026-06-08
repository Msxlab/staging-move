import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTaskReminderEmail } from "@/lib/email-service";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { guardCronRequest } from "@/lib/cron-guard";
import { sendNotification } from "@/lib/notifications";
import {
  buildWebNotificationSettings,
  groupNotificationPreferencesByUser,
  isPushTypeEnabled,
} from "@/lib/notification-preferences";
import { daysUntilDateOnly, resolveReminderTimeZone } from "@/lib/reminder-timezone";
import { formatDateOnlyUtc } from "@locateflow/shared";

const TASK_REMINDER_DAYS = [3, 1, 0];
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// dueDate / moveDate are date-only values stored at UTC midnight — format in
// UTC so the displayed day never shifts to the server's local tz.
function formatDate(date: Date, locale?: string | null) {
  const lang = (locale || "").toLowerCase().startsWith("es") ? "es-US" : "en-US";
  return formatDateOnlyUtc(date, { month: "short", day: "numeric", year: "numeric" }, lang);
}

function movingPlanLabel(plan: {
  moveDate: Date;
  fromAddress?: { city: string; state: string } | null;
  toAddress?: { city: string; state: string } | null;
}) {
  const from = [plan.fromAddress?.city, plan.fromAddress?.state].filter(Boolean).join(", ");
  const to = [plan.toAddress?.city, plan.toAddress?.state].filter(Boolean).join(", ");
  const route = from && to ? `${from} to ${to}` : from || to || "Moving plan";
  return `${route} (${formatDate(plan.moveDate)})`;
}

export async function GET(req: Request) {
  const guard = await guardCronRequest(req, "task-reminders");
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();
    const start = startOfDay(now);
    // Widen the scan window by a day on each side so a task on the user's local
    // calendar edge (their timezone differs from the server's) is still a
    // candidate; the exact lead-day match below is timezone-aware.
    const windowStart = new Date(start.getTime() - DAY_MS);
    const horizon = new Date(start.getTime() + (Math.max(...TASK_REMINDER_DAYS) + 2) * DAY_MS);

    const tasks = await prisma.moveTask.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: windowStart, lt: horizon },
        status: { notIn: ["COMPLETED", "DISMISSED"] },
        user: { deletedAt: null },
        movingPlan: { deletedAt: null },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        userId: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true, profile: { select: { timezone: true } } } },
        movingPlan: {
          select: {
            id: true,
            moveDate: true,
            fromAddress: { select: { city: true, state: true } },
            toAddress: { select: { city: true, state: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 500,
    });

    const userIds = [...new Set(tasks.map((task) => task.userId))];
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

    for (const task of tasks) {
      if (!task.user || !task.dueDate) continue;
      const userTimeZone = resolveReminderTimeZone(task.user.profile?.timezone);
      const daysUntilDue = daysUntilDateOnly(task.dueDate, now, userTimeZone);
      if (!TASK_REMINDER_DAYS.includes(daysUntilDue)) continue;

      const userPreferences = preferencesByUser.get(task.userId) || [];
      const notificationSettings = buildWebNotificationSettings(userPreferences);
      const emailAllowed = Boolean(
        task.user.email &&
        notificationSettings.config.emailEnabled &&
        notificationSettings.prefs.taskReminder
      );
      const pushAllowed = isPushTypeEnabled(userPreferences, "TASK_REMINDER");
      if (!emailAllowed && !pushAllowed) continue;

      const dueDateText = formatDate(task.dueDate, task.user.preferredLocale);
      const dedupeKey = `cron:task-reminder:${task.id}:${task.dueDate.toISOString().slice(0, 10)}:${daysUntilDue}`;
      const userName = [task.user.firstName, task.user.lastName].filter(Boolean).join(" ") || "there";

      try {
        let emailSent = false;
        if (emailAllowed) {
          emailSent = await sendTaskReminderEmail({
            userEmail: task.user.email!,
            userName,
            taskTitle: task.title,
            dueDate: dueDateText,
            daysUntilDue,
            movingPlanLabel: movingPlanLabel(task.movingPlan),
            movingPlanId: task.movingPlan.id,
            taskId: task.id,
            userId: task.userId,
            locale: task.user.preferredLocale,
            dedupeKey,
            metadata: { userId: task.userId, taskId: task.id, movingPlanId: task.movingPlan.id },
          });
          if (emailSent) sentCount++;
        }

        const when = daysUntilDue === 0
          ? "today"
          : `in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
        const body = `${task.title} is due ${when} on ${dueDateText}.`;
        const mirrored = await createInAppNotification({
          userId: task.userId,
          type: "TASK_DUE",
          title: `Task reminder: ${task.title}`,
          body,
          href: `/moving/plan/${task.movingPlan.id}`,
          icon: "CalendarCheck",
          dedupeKey,
          metadata: {
            kind: "task-reminder",
            taskId: task.id,
            movingPlanId: task.movingPlan.id,
            daysUntilDue,
            channelMirror: emailSent ? "EMAIL" : pushAllowed ? "PUSH" : "IN_APP",
          },
        });
        if (mirrored) {
          mirroredCount++;
          if (pushAllowed) {
            const pushed = await sendNotification({
              userId: task.userId,
              type: "PUSH",
              subject: `Task reminder: ${task.title}`,
              body,
              dedupeKey: `${dedupeKey}:push`,
              metadata: { kind: "task-reminder", taskId: task.id, movingPlanId: task.movingPlan.id },
            });
            if (pushed) pushSentCount++;
          }
        }
      } catch (err) {
        errors.push(`Failed for task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      processed: tasks.length,
      sent: sentCount,
      mirrored: mirroredCount,
      pushSent: pushSentCount,
      errors: errors.length ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] task-reminders error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

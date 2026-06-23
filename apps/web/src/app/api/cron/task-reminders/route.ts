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
import { daysUntilDateOnly, isReminderDeliveryHour, resolveReminderTimeZone } from "@/lib/reminder-timezone";
import { isDailyDigestEnabled } from "@/lib/daily-digest-config";
import { formatDateOnlyUtc } from "@locateflow/shared";
import { resolveConsumerEntitlement } from "@/lib/consumer-entitlement";

const TASK_REMINDER_DAYS = [3, 1, 0];
// Hard-deadline escalation: deadline-bearing checklist tasks (USCIS AR-11, DMV
// transfer, the 60-day health-insurance window) get an extra "deadline
// approaching" nudge when the legal deadline is this many days out — separate
// from the soft dueDate reminders, so a missed/edited due date doesn't silence
// a legally-critical deadline. At-most-once per (task, deadline, tier) via a
// distinct dedupe key.
const DEADLINE_ESCALATION_DAYS = [7, 1];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 4.8b: build the set of userIds that currently have an active entitlement, so
 * we don't keep sending reminders to LAPSED users. Read-only: one batched
 * Subscription read + the canonical resolver.
 *
 * Uses `resolveConsumerEntitlement`, which applies the H3-safe CONSUMER_FREE
 * override — so in the everything-free pivot a free / campaign / no-row
 * consumer still resolves to access and is NOT skipped. Only a genuinely lapsed
 * payer (expired stripe/trial with CONSUMER_FREE off) is dropped. A user whose
 * subscription read or resolve fails is allowed through (fail-open) so a
 * transient DB hiccup never silences a paying user's reminders.
 */
async function buildEntitledUserIds(userIds: string[]): Promise<Set<string>> {
  const entitled = new Set<string>(userIds);
  if (userIds.length === 0) return entitled;
  let subscriptions: Array<{ userId: string } & Record<string, unknown>>;
  try {
    subscriptions = (await prisma.subscription.findMany({
      where: { userId: { in: userIds } },
    })) as Array<{ userId: string } & Record<string, unknown>>;
  } catch {
    // Fail-open: never silence a legitimate user over a read error.
    return entitled;
  }
  const subByUser = new Map(subscriptions.map((sub) => [sub.userId, sub]));
  for (const userId of userIds) {
    try {
      const { entitlement } = await resolveConsumerEntitlement(
        (subByUser.get(userId) ?? null) as never,
      );
      if (!entitlement.hasAccess) entitled.delete(userId);
    } catch {
      // Fail-open on resolver error.
    }
  }
  return entitled;
}

function parseDeadlineDate(metadata: unknown): Date | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).deadlineDate;
  if (typeof raw !== "string") return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

    const taskSelect = {
      id: true,
      title: true,
      dueDate: true,
      userId: true,
      metadata: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true, profile: { select: { timezone: true } } } },
      movingPlan: {
        select: {
          id: true,
          moveDate: true,
          fromAddress: { select: { city: true, state: true } },
          toAddress: { select: { city: true, state: true } },
        },
      },
    } as const;

    const tasks = await prisma.moveTask.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: windowStart, lt: horizon },
        status: { notIn: ["COMPLETED", "DISMISSED"] },
        user: { deletedAt: null },
        movingPlan: { deletedAt: null },
      },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: 500,
    });

    // Deadline-escalation candidates: open, deadline-bearing checklist tasks
    // (templateId set) whose HARD deadline may fall outside the soft-due window.
    // Scanned separately and de-duped against the soft-due batch by task id so a
    // task never gets both reminders evaluated twice in one run.
    const deadlineHorizon = new Date(
      start.getTime() + (Math.max(...DEADLINE_ESCALATION_DAYS) + 2) * DAY_MS,
    );
    const seenTaskIds = new Set(tasks.map((task) => task.id));
    const deadlineTasks = (
      await prisma.moveTask.findMany({
        where: {
          deletedAt: null,
          templateId: { not: null },
          status: { notIn: ["COMPLETED", "DISMISSED"] },
          user: { deletedAt: null },
          movingPlan: { deletedAt: null, moveDate: { lt: deadlineHorizon } },
        },
        select: taskSelect,
        orderBy: { dueDate: "asc" },
        take: 500,
      })
    ).filter((task) => !seenTaskIds.has(task.id));

    const allTaskRows = [...tasks, ...deadlineTasks];
    const userIds = [...new Set(allTaskRows.map((task) => task.userId))];
    const preferences = userIds.length
      ? await prisma.notificationPreference.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
        })
      : [];
    const preferencesByUser = groupNotificationPreferencesByUser(preferences);

    // 4.8b: only remind users with an active entitlement — skip lapsed users.
    const entitledUserIds = await buildEntitledUserIds(userIds);

    // When the daily rollup owns the email/push send, suppress this cron's
    // per-item SOFT-DUE email + push (the digest emails/pushes them once,
    // bundled). The in-app feed entry is STILL written so the feed stays
    // granular. The HARD-DEADLINE escalation tier below is NOT suppressed: it's
    // a distinct legally-critical nudge that the digest deliberately does not
    // model, so dropping its email/push would drop a reminder. It keeps sending
    // per-item. Read once per run so the batch agrees.
    const digestOwnsSend = await isDailyDigestEnabled();

    let sentCount = 0;
    let mirroredCount = 0;
    let pushSentCount = 0;
    let escalatedCount = 0;
    const errors: string[] = [];

    for (const task of allTaskRows) {
      if (!task.user || !task.dueDate) continue;
      if (!entitledUserIds.has(task.userId)) continue; // 4.8b: skip lapsed users
      const userTimeZone = resolveReminderTimeZone(task.user.profile?.timezone);
      // Local ~8am delivery gate (see reminder-timezone.ts). Dedupe keys keep
      // any cross-run overlap idempotent.
      if (!isReminderDeliveryHour(now, userTimeZone)) continue;
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
        if (emailAllowed && !digestOwnsSend) {
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
            channelMirror: digestOwnsSend ? "DIGEST" : emailSent ? "EMAIL" : pushAllowed ? "PUSH" : "IN_APP",
          },
        });
        if (mirrored) {
          mirroredCount++;
          if (pushAllowed && !digestOwnsSend) {
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

    // ── Hard-deadline escalation tier ──
    // For deadline-bearing checklist tasks, fire a distinct "deadline
    // approaching" reminder when the legal deadline is exactly one of the
    // escalation lead-days out (in the user's timezone). The dedupe key is keyed
    // on the deadline date + lead-day, so it's at-most-once per tier and never
    // collides with the soft-due reminder above — no spam.
    for (const task of allTaskRows) {
      if (!task.user) continue;
      if (!entitledUserIds.has(task.userId)) continue; // 4.8b: skip lapsed users
      const deadlineDate = parseDeadlineDate(task.metadata);
      if (!deadlineDate) continue;

      const userTimeZone = resolveReminderTimeZone(task.user.profile?.timezone);
      // Same local ~8am delivery gate as the soft-due loop above.
      if (!isReminderDeliveryHour(now, userTimeZone)) continue;
      const daysUntilDeadline = daysUntilDateOnly(deadlineDate, now, userTimeZone);
      if (!DEADLINE_ESCALATION_DAYS.includes(daysUntilDeadline)) continue;

      const userPreferences = preferencesByUser.get(task.userId) || [];
      const notificationSettings = buildWebNotificationSettings(userPreferences);
      const emailAllowed = Boolean(
        task.user.email &&
        notificationSettings.config.emailEnabled &&
        notificationSettings.prefs.taskReminder
      );
      const pushAllowed = isPushTypeEnabled(userPreferences, "TASK_REMINDER");
      if (!emailAllowed && !pushAllowed) continue;

      const deadlineText = formatDate(deadlineDate, task.user.preferredLocale);
      const dedupeKey = `cron:task-deadline:${task.id}:${deadlineDate.toISOString().slice(0, 10)}:${daysUntilDeadline}`;
      const userName = [task.user.firstName, task.user.lastName].filter(Boolean).join(" ") || "there";
      const when = daysUntilDeadline === 1 ? "tomorrow" : `in ${daysUntilDeadline} days`;
      const body = `Deadline approaching: ${task.title} must be done by ${deadlineText} (${when}).`;

      try {
        let emailSent = false;
        if (emailAllowed) {
          emailSent = await sendTaskReminderEmail({
            userEmail: task.user.email!,
            userName,
            taskTitle: `⏳ Deadline: ${task.title}`,
            dueDate: deadlineText,
            daysUntilDue: daysUntilDeadline,
            movingPlanLabel: movingPlanLabel(task.movingPlan),
            movingPlanId: task.movingPlan.id,
            taskId: task.id,
            userId: task.userId,
            locale: task.user.preferredLocale,
            dedupeKey,
            metadata: { userId: task.userId, taskId: task.id, movingPlanId: task.movingPlan.id, deadline: true },
          });
          if (emailSent) sentCount++;
        }

        const mirrored = await createInAppNotification({
          userId: task.userId,
          type: "TASK_DUE",
          title: `Deadline approaching: ${task.title}`,
          body,
          href: `/moving/plan/${task.movingPlan.id}`,
          icon: "AlertTriangle",
          dedupeKey,
          metadata: {
            kind: "task-deadline",
            taskId: task.id,
            movingPlanId: task.movingPlan.id,
            daysUntilDeadline,
            channelMirror: emailSent ? "EMAIL" : pushAllowed ? "PUSH" : "IN_APP",
          },
        });
        if (mirrored) {
          mirroredCount++;
          escalatedCount++;
          if (pushAllowed) {
            const pushed = await sendNotification({
              userId: task.userId,
              type: "PUSH",
              subject: `Deadline approaching: ${task.title}`,
              body,
              dedupeKey: `${dedupeKey}:push`,
              metadata: { kind: "task-deadline", taskId: task.id, movingPlanId: task.movingPlan.id },
            });
            if (pushed) pushSentCount++;
          }
        }
      } catch (err) {
        errors.push(`Deadline escalation failed for task ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      processed: allTaskRows.length,
      sent: sentCount,
      mirrored: mirroredCount,
      pushSent: pushSentCount,
      escalated: escalatedCount,
      errors: errors.length ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] task-reminders error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardCronRequest } from "@/lib/cron-guard";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { sendNotification } from "@/lib/notifications";
import { sendLifecycleNudgeEmail } from "@/lib/email-service";
import {
  buildWebNotificationSettings,
  groupNotificationPreferencesByUser,
  isPushTypeEnabled,
} from "@/lib/notification-preferences";
import { epochDayInTimeZone, isReminderDeliveryHour, resolveReminderTimeZone, daysUntilDateOnly } from "@/lib/reminder-timezone";
import { formatDateOnlyUtc } from "@locateflow/shared";

export const runtime = "nodejs";

/**
 * Behavior-triggered LIFECYCLE / WIN-BACK nudges.
 *
 * Every other reminder cron fires off data the user already entered (a bill's
 * billingDay, a task's dueDate, a plan's moveDate). Those never reach DORMANT or
 * ABANDONED-ONBOARDING users — someone who signed up, added little, and went
 * quiet has no upcoming deadline to trigger on, so they get ZERO nudges. This
 * cron closes that gap with two behavior triggers:
 *
 *   1. ABANDONED SETUP — signed up N days ago (day 3, then day 7) but has NO
 *      moving plan AND NO services. Nudge: "finish setting up your move".
 *   2. INACTIVE WIN-BACK — last seen N days ago (day 14, then day 30) but still
 *      has an UPCOMING move with OPEN tasks. Gentle: "your move is coming up —
 *      N task(s) waiting".
 *
 * IDEMPOTENCY / NO SPAM: each nudge is at-most-once per (user, kind, window-day)
 * via a dedupe key. The in-app feed write is atomic on @@unique([userId,
 * channel, dedupeKey]); the email reuses the same key against EmailLog's dedupe;
 * push reuses key + ":push". A user who logs in then quiets again only re-enters
 * the win-back funnel at a LATER window day (14 vs 30) with a distinct key — they
 * never get the same nudge twice.
 *
 * OPT-OUT: gated by the "lifecycleNudge" EMAIL preference (type "LIFECYCLE",
 * default ON) for email + the PUSH "LIFECYCLE" type for push. A user who turns
 * it off gets neither — the in-app feed write is also suppressed so the loop is
 * fully silenceable.
 *
 * TIMEZONE: "N days ago" is computed in the USER'S timezone (epoch-day math from
 * reminder-timezone), so a far-zone user isn't pulled in a day early/late.
 *
 * ACTIVITY SIGNAL: User has no lastLoginAt column. "Last seen" is the newest
 * UserLoginSession.lastActivity (refreshed on every authenticated request, set
 * at login), falling back to User.createdAt for users who never created a
 * session row. See apps/web/src/lib/user-auth.ts.
 *
 * US-only, honest copy: no fabricated urgency, no invented counts — the task
 * count shown is the real number of open tasks on the user's upcoming plan.
 *
 * Recommended schedule: once daily (cron.yml 06:00 batch).
 */

// Days-since-signup windows for the abandoned-setup nudge.
const ABANDONED_SETUP_DAYS = [3, 7];
// Days-since-last-seen windows for the inactive win-back nudge.
const INACTIVE_WINBACK_DAYS = [14, 30];

const OPEN_TASK_STATUSES_EXCLUDED = ["COMPLETED", "DISMISSED"];

type CandidateUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredLocale: string | null;
  createdAt: Date;
  timezone: string | null;
};

function displayName(user: { firstName: string | null; lastName: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
}

async function handleCron(request: NextRequest) {
  const guard = await guardCronRequest(request, "lifecycle-nudges");
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;

    let abandonedSent = 0;
    let winbackSent = 0;
    let mirrored = 0;
    let emailSent = 0;
    let pushSent = 0;
    const errors: string[] = [];

    // ──────────────────────────────────────────────────────────────────────
    // 1. ABANDONED SETUP
    // Users who signed up exactly 3 or 7 days ago (in their tz) and have NO
    // moving plan AND NO services. We bound the scan to a signup window with a
    // day of slack on each side, then match the exact day-since-signup per user
    // in their own timezone.
    // ──────────────────────────────────────────────────────────────────────
    const maxAbandoned = Math.max(...ABANDONED_SETUP_DAYS);
    const abandonedWindowStart = new Date(now.getTime() - (maxAbandoned + 2) * DAY_MS);
    const abandonedWindowEnd = new Date(now.getTime() - (Math.min(...ABANDONED_SETUP_DAYS) - 1) * DAY_MS);

    const abandonedCandidates = await prisma.user.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: abandonedWindowStart, lt: abandonedWindowEnd },
        // The behavioral signal: nothing set up yet. `none` on the relations is
        // the cheap DB-side filter; the soft-delete extension does NOT scope
        // nested relations, so we re-filter deleted plans/services below before
        // trusting "empty".
        movingPlans: { none: { deletedAt: null } },
        services: { none: { deletedAt: null } },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        preferredLocale: true,
        createdAt: true,
        profile: { select: { timezone: true } },
      },
      take: 1000,
    });

    const abandonedUsers: CandidateUser[] = abandonedCandidates.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      preferredLocale: u.preferredLocale,
      createdAt: u.createdAt,
      timezone: u.profile?.timezone ?? null,
    }));

    // ──────────────────────────────────────────────────────────────────────
    // 2. INACTIVE WIN-BACK
    // Users whose last activity was 14 or 30 days ago (in their tz) who STILL
    // have an upcoming move with open tasks. We start from users with an
    // upcoming, non-deleted plan that has at least one open task, then compute
    // each user's "last seen" from their newest login session.
    // ──────────────────────────────────────────────────────────────────────
    const todayUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const winbackPlanCandidates = await prisma.movingPlan.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PLANNING", "IN_PROGRESS"] },
        // Upcoming move only (moveDate is date-only at UTC midnight; today's
        // plans still count as "coming up").
        moveDate: { gte: todayUtcMidnight },
        user: { deletedAt: null },
        // At least one still-open task on the plan.
        moveTasks: { some: { deletedAt: null, status: { notIn: OPEN_TASK_STATUSES_EXCLUDED } } },
      },
      select: {
        id: true,
        moveDate: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            preferredLocale: true,
            createdAt: true,
            profile: { select: { timezone: true } },
          },
        },
        fromAddress: { select: { city: true, state: true } },
        toAddress: { select: { city: true, state: true } },
        _count: {
          select: {
            moveTasks: { where: { deletedAt: null, status: { notIn: OPEN_TASK_STATUSES_EXCLUDED } } },
          },
        },
      },
      orderBy: { moveDate: "asc" },
      take: 1000,
    });

    // One plan per user — the soonest upcoming plan represents the user for the
    // win-back funnel (prevents double-nudging a user with multiple plans).
    const winbackByUser = new Map<string, (typeof winbackPlanCandidates)[number]>();
    for (const plan of winbackPlanCandidates) {
      if (!plan.user) continue;
      if (!winbackByUser.has(plan.user.id)) winbackByUser.set(plan.user.id, plan);
    }

    // Newest login session per candidate user → "last seen". A user with no
    // session row at all (never logged in via the session flow) falls back to
    // their account createdAt.
    const winbackUserIds = [...winbackByUser.keys()];
    const lastSeenByUser = new Map<string, Date>();
    if (winbackUserIds.length > 0) {
      const grouped = await prisma.userLoginSession.groupBy({
        by: ["userId"],
        where: { userId: { in: winbackUserIds } },
        _max: { lastActivity: true },
      });
      for (const row of grouped) {
        if (row._max.lastActivity) lastSeenByUser.set(row.userId, row._max.lastActivity);
      }
    }

    // ── Preferences: one fetch covering every candidate across both funnels ──
    const allUserIds = [
      ...new Set([...abandonedUsers.map((u) => u.id), ...winbackUserIds]),
    ];
    const preferenceRecords = allUserIds.length > 0
      ? await prisma.notificationPreference.findMany({
          where: { userId: { in: allUserIds } },
          select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
        })
      : [];
    const preferencesByUser = groupNotificationPreferencesByUser(preferenceRecords);

    // Shared per-user gate. `lifecycleNudge` is the EMAIL toggle (default ON);
    // PUSH "LIFECYCLE" is its own type. Channels are independent — skip a user
    // only when BOTH are off.
    function resolveChannels(userId: string, hasEmail: boolean) {
      const prefs = preferencesByUser.get(userId) || [];
      const settings = buildWebNotificationSettings(prefs);
      const emailAllowed = Boolean(
        hasEmail && settings.config.emailEnabled && settings.prefs.lifecycleNudge,
      );
      const pushAllowed = isPushTypeEnabled(prefs, "LIFECYCLE");
      return { emailAllowed, pushAllowed };
    }

    // ── Fan out: ABANDONED SETUP ──
    for (const user of abandonedUsers) {
      const tz = resolveReminderTimeZone(user.timezone);
      // Local ~8am delivery gate (see reminder-timezone.ts). Per-(user, kind,
      // window-day) dedupe keys keep any cross-run overlap idempotent.
      if (!isReminderDeliveryHour(now, tz)) continue;
      const daysSinceSignup = epochDayInTimeZone(now, tz) - epochDayInTimeZone(user.createdAt, tz);
      if (!ABANDONED_SETUP_DAYS.includes(daysSinceSignup)) continue;

      const { emailAllowed, pushAllowed } = resolveChannels(user.id, Boolean(user.email));
      if (!emailAllowed && !pushAllowed) continue;

      const dedupeKey = `cron:lifecycle:abandoned-setup:${user.id}:${daysSinceSignup}`;
      const title = "Finish setting up your move";
      const body =
        "You created a LocateFlow account but haven't started a move yet. " +
        "Add your move date and the services you're bringing or switching, and " +
        "we'll build your checklist and reminders.";

      try {
        const created = await createInAppNotification({
          userId: user.id,
          type: "LIFECYCLE",
          title,
          body,
          href: "/moving",
          icon: "Sparkles",
          dedupeKey,
          metadata: {
            kind: "lifecycle-abandoned-setup",
            daysSinceSignup,
            channelMirror: emailAllowed ? "EMAIL" : pushAllowed ? "PUSH" : "IN_APP",
          },
        });
        if (!created) continue; // already nudged for this window — no spam
        mirrored++;

        if (emailAllowed && user.email) {
          const ok = await sendLifecycleNudgeEmail({
            userEmail: user.email,
            userName: displayName(user),
            kind: "abandoned-setup",
            subject: title,
            preheader: "Add your move date and services to get your checklist.",
            bodyLines: [
              "You created a LocateFlow account but haven't started a move yet.",
              "Add your move date and the services you're bringing or switching, and we'll build your moving checklist and send timely reminders so nothing slips.",
            ],
            cta: { href: "/moving", label: "Start your move" },
            userId: user.id,
            locale: user.preferredLocale,
            dedupeKey,
            metadata: { kind: "lifecycle-abandoned-setup", userId: user.id },
          });
          if (ok) {
            emailSent++;
            abandonedSent++;
          }
        }

        if (pushAllowed) {
          const pushed = await sendNotification({
            userId: user.id,
            type: "PUSH",
            subject: title,
            body,
            dedupeKey: `${dedupeKey}:push`,
            metadata: { kind: "lifecycle-abandoned-setup" },
          });
          if (pushed) {
            pushSent++;
            abandonedSent++;
          }
        }
      } catch (err) {
        errors.push(`abandoned-setup failed for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Fan out: INACTIVE WIN-BACK ──
    for (const userId of winbackUserIds) {
      const plan = winbackByUser.get(userId)!;
      const planUser = plan.user!;
      const tz = resolveReminderTimeZone(planUser.profile?.timezone ?? null);
      // Same local ~8am delivery gate as the abandoned-setup loop above.
      if (!isReminderDeliveryHour(now, tz)) continue;
      const lastSeen = lastSeenByUser.get(userId) ?? planUser.createdAt;
      const daysSinceSeen = epochDayInTimeZone(now, tz) - epochDayInTimeZone(lastSeen, tz);
      if (!INACTIVE_WINBACK_DAYS.includes(daysSinceSeen)) continue;

      const { emailAllowed, pushAllowed } = resolveChannels(userId, Boolean(planUser.email));
      if (!emailAllowed && !pushAllowed) continue;

      const openTasks = plan._count.moveTasks;
      if (openTasks <= 0) continue; // defensive — the query already requires some

      // Avoid same-morning double-notify: if the move is imminent, the move-reminder
      // cron (fires at <=7 days out with more specific copy) already covers this user.
      // Win-back is for the dormant-but-NOT-imminent case.
      const daysUntilMove = daysUntilDateOnly(plan.moveDate, now, tz);
      if (daysUntilMove >= 0 && daysUntilMove <= 7) continue;

      const dedupeKey = `cron:lifecycle:inactive-winback:${userId}:${daysSinceSeen}`;
      // moveDate is date-only at UTC midnight — format in UTC so the day is
      // stable across zones.
      const moveDateText = formatDateOnlyUtc(plan.moveDate, { month: "long", day: "numeric", year: "numeric" });
      const fromCity = [plan.fromAddress?.city, plan.fromAddress?.state].filter(Boolean).join(", ");
      const toCity = [plan.toAddress?.city, plan.toAddress?.state].filter(Boolean).join(", ");
      const route = fromCity && toCity ? `${fromCity} to ${toCity}` : fromCity || toCity || "your move";
      const taskLabel = `${openTasks} task${openTasks === 1 ? "" : "s"}`;
      const title = "Your move is coming up";
      const body = `Your move (${route}) is on ${moveDateText}, and you have ${taskLabel} still waiting. Pick up where you left off whenever you're ready.`;

      try {
        const created = await createInAppNotification({
          userId,
          type: "LIFECYCLE",
          title,
          body,
          href: `/moving/plan/${plan.id}`,
          icon: "CalendarClock",
          dedupeKey,
          metadata: {
            kind: "lifecycle-inactive-winback",
            movingPlanId: plan.id,
            openTasks,
            daysSinceSeen,
            channelMirror: emailAllowed ? "EMAIL" : pushAllowed ? "PUSH" : "IN_APP",
          },
        });
        if (!created) continue; // already nudged for this window — no spam
        mirrored++;

        if (emailAllowed && planUser.email) {
          const ok = await sendLifecycleNudgeEmail({
            userEmail: planUser.email,
            userName: displayName(planUser),
            kind: "inactive-winback",
            subject: `Your move is coming up — ${taskLabel} waiting`,
            preheader: `${route} on ${moveDateText}.`,
            bodyLines: [
              `Your move (${route}) is scheduled for ${moveDateText}.`,
              `You have ${taskLabel} still open on your checklist. Pick up where you left off whenever you're ready — we'll keep your reminders on track.`,
            ],
            details: [
              ["Move date", moveDateText],
              ["Open tasks", String(openTasks)],
            ],
            cta: { href: `/moving/plan/${plan.id}`, label: "View your checklist" },
            userId,
            locale: planUser.preferredLocale,
            dedupeKey,
            metadata: { kind: "lifecycle-inactive-winback", userId, movingPlanId: plan.id },
          });
          if (ok) {
            emailSent++;
            winbackSent++;
          }
        }

        if (pushAllowed) {
          const pushed = await sendNotification({
            userId,
            type: "PUSH",
            subject: title,
            body,
            dedupeKey: `${dedupeKey}:push`,
            metadata: { kind: "lifecycle-inactive-winback", movingPlanId: plan.id },
          });
          if (pushed) {
            pushSent++;
            winbackSent++;
          }
        }
      } catch (err) {
        errors.push(`inactive-winback failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      abandonedSetupCandidates: abandonedUsers.length,
      winbackCandidates: winbackUserIds.length,
      abandonedSent,
      winbackSent,
      mirrored,
      emailSent,
      pushSent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] lifecycle-nudges error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GitHub Actions / Vercel cron send GET; POST kept for parity with the others.
export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }

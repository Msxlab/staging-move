import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWeeklyDigestEmail } from "@/lib/email-service";
import { guardCronRequest } from "@/lib/cron-guard";
import {
  buildWebNotificationSettings,
  getDaysUntilDate,
  getNextBillingDate,
  groupNotificationPreferencesByUser,
} from "@/lib/notification-preferences";
import { getUserPlanForDefaultWorkspace } from "@/lib/plan-limits";
import { DEFAULT_US_TIME_ZONE, formatDateOnlyUtc, formatInUserTimeZone, planFeatures } from "@locateflow/shared";

// A local-midnight date (new Date(y, m, d)) reprojected onto its UTC calendar
// day so it formats in a tz-stable way (never leaks the server's process tz).
function formatLocalCalendarDay(date: Date, options: Intl.DateTimeFormatOptions) {
  return formatDateOnlyUtc(
    new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
    options,
  );
}

/**
 * GET /api/cron/weekly-digest
 * Sends weekly digest emails to all eligible users.
 * Intended to be called by a cron job once per week.
 * Protected by CRON_SECRET header.
 *
 * PERF-001: Uses bulk queries + groupBy instead of per-user round trips.
 * Query count is O(1) w.r.t. user count (was 3 per user).
 */
export async function GET(req: Request) {
  // Heavy fan-out cron: keeps to 2/min so a leaked secret can't trigger
  // mass digest emails.
  const guard = await guardCronRequest(req, "weekly-digest", { limit: 2 });
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // US-only product: render the run-global digest span + weekday in Eastern
    // (the app default) rather than the server's process tz, so "today" and the
    // window read as a US day even when the cron host is abroad. weekdayName
    // also gates digest-day eligibility — it must be a US weekday, not Turkey's.
    const weekStart = formatInUserTimeZone(weekAgo, DEFAULT_US_TIME_ZONE, { month: "short", day: "numeric" });
    const weekEnd = formatInUserTimeZone(now, DEFAULT_US_TIME_ZONE, { month: "short", day: "numeric" });
    const weekdayName = formatInUserTimeZone(now, DEFAULT_US_TIME_ZONE, { weekday: "long" });

    // ── STEP 1: Fetch all users + their preferences in 2 queries ──
    const users = await prisma.user.findMany({
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (users.length === 0) {
      return NextResponse.json({ ok: true, users: 0, sent: 0, timestamp: now.toISOString() });
    }
    const userIds = users.map((u) => u.id);

    const preferences = await prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
    });
    const preferencesByUser = groupNotificationPreferencesByUser(preferences);

    // ── STEP 2: Determine eligible users (today matches their digest day + email enabled) ──
    const eligibleUsers = users.filter((user) => {
      if (!user.email) return false;
      const notificationSettings = buildWebNotificationSettings(preferencesByUser.get(user.id) || []);
      if (!notificationSettings.config.emailEnabled || !notificationSettings.prefs.weeklySummary) return false;
      if (notificationSettings.config.digestDay !== weekdayName) return false;
      return true;
    });

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        ok: true, users: users.length, eligible: 0, sent: 0, timestamp: now.toISOString(),
      });
    }

    // ── STEP 2b: Plan gate (owner decision) ──
    // The weekly digest email is a paid `weatherDigest` feature (Individual and
    // up). Resolve the plan only for the already-narrowed digest-day-eligible
    // set (kept small by the day match), in parallel, and drop free/free-trial
    // users before any per-user data is fetched or any email is sent.
    const entitledFlags = await Promise.all(
      eligibleUsers.map((user) => getUserPlanForDefaultWorkspace(user.id).then((p) => planFeatures(p.plan).weatherDigest)),
    );
    const gatedEligibleUsers = eligibleUsers.filter((_, i) => entitledFlags[i]);
    if (gatedEligibleUsers.length === 0) {
      return NextResponse.json({
        ok: true, users: users.length, eligible: 0, sent: 0, timestamp: now.toISOString(),
      });
    }
    const eligibleUserIds = gatedEligibleUsers.map((u) => u.id);

    // ── STEP 3: Bulk-fetch all per-user data in parallel ──
    const [allServices, newServiceGroups] = await Promise.all([
      prisma.service.findMany({
        where: { userId: { in: eligibleUserIds }, isActive: true },
        select: { userId: true, providerName: true, monthlyCost: true, billingDay: true },
      }),
      prisma.service.groupBy({
        by: ["userId"],
        where: { userId: { in: eligibleUserIds }, createdAt: { gte: weekAgo } },
        _count: { _all: true },
      }),
    ]);

    // ── STEP 4: Index aggregations by userId for O(1) lookup ──
    const servicesByUser = new Map<string, typeof allServices>();
    for (const svc of allServices) {
      const list = servicesByUser.get(svc.userId) || [];
      list.push(svc);
      servicesByUser.set(svc.userId, list);
    }
    const newServicesByUser = new Map(newServiceGroups.map((g) => [g.userId, g._count._all]));

    // ── STEP 5: Send emails (I/O-bound, parallelized in batches) ──
    const BATCH_SIZE = 10;
    let sentCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < gatedEligibleUsers.length; i += BATCH_SIZE) {
      const batch = gatedEligibleUsers.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (user) => {
        try {
          const services = servicesByUser.get(user.id) || [];
          const totalExpenses = services.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);

          const upcomingBills = services
            .filter((s) => {
              if (!s.billingDay || !s.monthlyCost) return false;
              const dueDate = getNextBillingDate(s.billingDay, now);
              const daysUntilDue = getDaysUntilDate(dueDate, now);
              return daysUntilDue >= 0 && daysUntilDue <= 7;
            })
            .map((s) => ({
              name: s.providerName,
              amount: s.monthlyCost || 0,
              dueDate: formatLocalCalendarDay(getNextBillingDate(s.billingDay!, now), { month: "short", day: "numeric" }),
            }))
            .slice(0, 5);

          const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";

          const success = await sendWeeklyDigestEmail({
            userEmail: user.email!,
            userName,
            weekStart,
            weekEnd,
            upcomingBills,
            totalExpenses,
            newServices: newServicesByUser.get(user.id) || 0,
            userId: user.id,
            dedupeKey: `cron:weekly-digest:${user.id}:${weekStart}:${weekEnd}`,
            metadata: { userId: user.id },
          });

          if (success) sentCount++;
        } catch (err) {
          errors.push(`Failed for ${user.email}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }));
    }

    return NextResponse.json({
      ok: true,
      users: users.length,
      eligible: gatedEligibleUsers.length,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] weekly-digest error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

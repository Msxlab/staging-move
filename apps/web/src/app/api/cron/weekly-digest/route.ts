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

    const weekStart = weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const weekEnd = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const weekdayName = now.toLocaleDateString("en-US", { weekday: "long" });

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
    const eligibleUserIds = eligibleUsers.map((u) => u.id);

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

    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);
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
              dueDate: getNextBillingDate(s.billingDay!, now).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
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
      eligible: eligibleUsers.length,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] weekly-digest error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

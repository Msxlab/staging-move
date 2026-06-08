import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMonthlyReportEmail } from "@/lib/email-service";
import { guardCronRequest } from "@/lib/cron-guard";
import {
  buildWebNotificationSettings,
  groupNotificationPreferencesByUser,
} from "@/lib/notification-preferences";
import { formatDateOnlyUtc } from "@locateflow/shared";

function previousMonthWindow(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  // Format from the local calendar components reprojected to UTC so the month
  // label is stable regardless of the server's process tz (US-only product).
  const label = formatDateOnlyUtc(
    new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())),
    { month: "long", year: "numeric" },
  );
  return { start, end, key, label };
}

export async function GET(req: Request) {
  // Heavy fan-out (one mail per user): cap at 2/min so a leaked secret
  // can't trigger mass sends.
  const guard = await guardCronRequest(req, "monthly-report", { limit: 2 });
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();
    const { start, end, key, label } = previousMonthWindow(now);

    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true },
    });
    if (!users.length) {
      return NextResponse.json({ ok: true, users: 0, eligible: 0, sent: 0, timestamp: now.toISOString() });
    }

    const userIds = users.map((user) => user.id);
    const preferences = await prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
    });
    const preferencesByUser = groupNotificationPreferencesByUser(preferences);

    const eligibleUsers = users.filter((user) => {
      if (!user.email) return false;
      const settings = buildWebNotificationSettings(preferencesByUser.get(user.id) || []);
      return settings.config.emailEnabled && settings.prefs.monthlyReport;
    });

    if (!eligibleUsers.length) {
      return NextResponse.json({
        ok: true,
        users: users.length,
        eligible: 0,
        sent: 0,
        timestamp: now.toISOString(),
      });
    }

    const eligibleIds = eligibleUsers.map((user) => user.id);
    const [serviceGroups, completedTaskGroups] = await Promise.all([
      prisma.service.groupBy({
        by: ["userId"],
        where: { userId: { in: eligibleIds }, deletedAt: null, isActive: true },
        _count: { _all: true },
        _sum: { monthlyCost: true },
      }),
      prisma.moveTask.groupBy({
        by: ["userId"],
        where: {
          userId: { in: eligibleIds },
          deletedAt: null,
          completedAt: { gte: start, lt: end },
        },
        _count: { _all: true },
      }),
    ]);

    const servicesByUser = new Map(serviceGroups.map((group) => [group.userId, group]));
    const tasksByUser = new Map(completedTaskGroups.map((group) => [group.userId, group._count._all]));

    const BATCH_SIZE = 10;
    let sentCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (user) => {
        try {
          const serviceSummary = servicesByUser.get(user.id);
          const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
          const success = await sendMonthlyReportEmail({
            userEmail: user.email!,
            userName,
            month: label,
            totalSpend: serviceSummary?._sum.monthlyCost || 0,
            servicesCount: serviceSummary?._count._all || 0,
            tasksCompleted: tasksByUser.get(user.id) || 0,
            userId: user.id,
            locale: user.preferredLocale,
            dedupeKey: `cron:monthly-report:${user.id}:${key}`,
            metadata: { userId: user.id, month: key },
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
      errors: errors.length ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] monthly-report error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

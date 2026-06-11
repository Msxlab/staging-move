import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendLoggedEmail } from "@/lib/email-service";
import { escapeHtml, htmlToPlainText } from "@/lib/email";
import { guardCronRequest } from "@/lib/cron-guard";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { getAdminDigestConfig } from "@/lib/admin-digest-config";
import {
  generateMonthlyBusinessReportPdf,
  type MonthlyBusinessReportData,
} from "@/lib/pdf/monthly-business-report";
import {
  computeMrr,
  computeMrrMovement,
  computeMrrTrend,
  computeMonthlyChurnRate,
  type RevenueSub,
} from "@locateflow/shared";

/**
 * GET /api/cron/admin-monthly-report
 *
 * Owner's monthly business report: on the 1st of each month (the workflow's
 * existing "0 10 1 * *" slot) assemble last month's metrics — the same
 * Subscription rows + shared computeMrr/movement/churn helpers the
 * admin-daily-digest cron reads — render a 2-page PDF (KPI table, MRR
 * movement & trend, user growth, top service categories, integration health
 * from IntegrationDailyStat), and email it as an attachment to the digest's
 * recipient set.
 *
 * Operator-facing and English-only, like the daily digest.
 */

// pdfkit reads its font files with Node `fs`, so this can't run on edge.
export const runtime = "nodejs";

// Keep in sync with apps/web/src/app/api/cron/admin-daily-digest/route.ts —
// the minimal Subscription projection the shared revenue helpers price.
// (Deliberately duplicated: extracting it would couple two cron routes
// through a shared module for an 8-line constant.)
const REVENUE_SUB_SELECT = {
  plan: true,
  status: true,
  provider: true,
  accessType: true,
  billingInterval: true,
  createdAt: true,
  canceledAt: true,
  trialEndsAt: true,
} as const;

const TREND_MONTHS = 6;

/** Previous calendar month as a UTC [start, end) window. */
function previousMonthWindowUtc(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  const label = start.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { start, end, key, label };
}

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Collapse the month's IntegrationDailyStat rows (one statusCounts JSON per
 * source per day) into per-source totals. Status keys are free-form per
 * connector, so failure detection is heuristic: anything that *names* a
 * failure mode counts as one; everything else counts as success.
 * (Module-private: Next route files may only export route fields.)
 */
function summarizeIntegrationHealth(
  rows: Array<{ source: string; statusCounts: unknown }>,
): Array<{ source: string; total: number; failures: number }> {
  const bySource = new Map<string, { total: number; failures: number }>();
  for (const row of rows) {
    if (!row.statusCounts || typeof row.statusCounts !== "object" || Array.isArray(row.statusCounts)) {
      continue;
    }
    const agg = bySource.get(row.source) ?? { total: 0, failures: 0 };
    for (const [status, value] of Object.entries(row.statusCounts as Record<string, unknown>)) {
      const n = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
      agg.total += n;
      if (/error|fail|timeout|unavailable|reject/i.test(status)) agg.failures += n;
    }
    bySource.set(row.source, agg);
  }
  return [...bySource.entries()]
    .map(([source, agg]) => ({ source, ...agg }))
    .sort((a, b) => b.total - a.total);
}

export async function GET(request: Request) {
  // Single monthly send — a tight ceiling bounds abuse from a leaked secret.
  const guard = await guardCronRequest(request, "admin-monthly-report", { limit: 2 });
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();
    const { start, end, key, label } = previousMonthWindowUtc(now);

    // Recipients: every active admin UNION the configured alert address, MINUS
    // runtime-config opt-outs — the admin-daily-digest recipient set. Keep in
    // sync with apps/web/src/app/api/cron/admin-daily-digest/route.ts.
    const alertEmail =
      (await getRuntimeConfigValue("ADMIN_ALERT_EMAIL")) ||
      (await getRuntimeConfigValue("ALERT_EMAIL_TO"));
    const config = await getAdminDigestConfig();
    const activeAdmins = await prisma.adminUser
      .findMany({ where: { isActive: true }, select: { email: true } })
      .catch(() => [] as Array<{ email: string }>);
    const recipientSet = new Set<string>();
    if (alertEmail) recipientSet.add(alertEmail.trim().toLowerCase());
    for (const admin of activeAdmins) {
      if (admin.email) recipientSet.add(admin.email.trim().toLowerCase());
    }
    for (const excluded of config.excludeEmails) recipientSet.delete(excluded);
    const recipients = [...recipientSet].filter(Boolean);
    if (recipients.length === 0) {
      return NextResponse.json({
        ok: true,
        skipped: "no report recipients (ADMIN_ALERT_EMAIL unset and no active admins)",
      });
    }

    // Trend lookback: subs canceled before this never affect the trend window.
    const trendStart = new Date(Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth() - TREND_MONTHS,
      1,
    ));
    // Monthly signup buckets for the trailing TREND_MONTHS months (newest = the
    // reported month). Each entry is a [bucketStart, bucketEnd) UTC window.
    const userGrowthBuckets = Array.from({ length: TREND_MONTHS }, (_, i) => {
      const offset = TREND_MONTHS - 1 - i;
      const bucketStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - offset, 1));
      const bucketEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - offset + 1, 1));
      const month = `${bucketStart.getUTCFullYear()}-${String(bucketStart.getUTCMonth() + 1).padStart(2, "0")}`;
      return { month, bucketStart, bucketEnd };
    });
    const priorStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));

    const [
      activeSubs,
      canceledSubs,
      newUserCount,
      priorNewUserCount,
      totalUsers,
      supportTicketCount,
      newUsersPerMonth,
      categoryGroups,
      integrationStats,
    ] = await Promise.all([
      // Revenue inputs — same rows + shared pricing helpers as the daily digest.
      prisma.subscription.findMany({
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
        select: REVENUE_SUB_SELECT,
      }),
      prisma.subscription.findMany({
        where: { status: "CANCELED", canceledAt: { gte: trendStart } },
        select: REVENUE_SUB_SELECT,
      }),
      prisma.user.count({ where: { createdAt: { gte: start, lt: end }, deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: priorStart, lt: start }, deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { lt: end }, deletedAt: null } }),
      prisma.supportTicket.count({ where: { createdAt: { gte: start, lt: end } } }),
      Promise.all(
        userGrowthBuckets.map((bucket) =>
          prisma.user.count({
            where: { createdAt: { gte: bucket.bucketStart, lt: bucket.bucketEnd }, deletedAt: null },
          }),
        ),
      ),
      // Non-core sections degrade to empty rather than failing the report.
      prisma.service
        .groupBy({
          by: ["category"],
          where: { deletedAt: null, isActive: true },
          _count: { _all: true },
          _sum: { monthlyCost: true },
        })
        .catch(() => []),
      prisma.integrationDailyStat
        .findMany({
          where: { day: { gte: start, lt: end } },
          select: { source: true, statusCounts: true },
        })
        .catch(() => [] as Array<{ source: string; statusCounts: unknown }>),
    ]);

    const mrr = computeMrr(activeSubs as RevenueSub[]);
    const allRevenueSubs = [...activeSubs, ...canceledSubs] as RevenueSub[];
    const movement = computeMrrMovement({
      subs: allRevenueSubs,
      windowStart: start,
      windowEnd: end,
    });
    const canceledInMonth = (canceledSubs as RevenueSub[]).filter((s) => {
      const t = s.canceledAt ? new Date(s.canceledAt).getTime() : NaN;
      return Number.isFinite(t) && t >= start.getTime() && t < end.getTime();
    });
    const churnPct = computeMonthlyChurnRate({
      activeSubs: activeSubs as RevenueSub[],
      canceledInMonth,
      monthStart: start,
    });
    // Trend anchored INSIDE the reported month so the newest point IS the
    // reported month (running on the 1st, "now" is already the next month).
    // Mid-month rather than end-1ms because computeMrrTrend reads LOCAL
    // calendar components — mid-month is the same month in every timezone.
    const trendAnchor = new Date(end.getTime() - 15 * 24 * 60 * 60 * 1000);
    const mrrTrend = computeMrrTrend({
      subs: allRevenueSubs,
      now: trendAnchor,
      months: TREND_MONTHS,
    });

    const topCategories = (categoryGroups as Array<{
      category: string;
      _count: { _all: number };
      _sum: { monthlyCost: number | null };
    }>)
      .map((group) => ({
        category: group.category,
        services: group._count._all,
        monthlyCost: Number(group._sum.monthlyCost) || 0,
      }))
      .sort((a, b) => b.services - a.services)
      .slice(0, 8);

    const integrationHealth = summarizeIntegrationHealth(integrationStats);

    const reportData: MonthlyBusinessReportData = {
      monthLabel: label,
      kpis: {
        mrr,
        newMrr: movement.newMrr,
        churnedMrr: movement.churnedMrr,
        netMrr: movement.netMrr,
        churnPct,
        activeSubscriptions: activeSubs.length,
        newUsers: newUserCount,
        priorMonthNewUsers: priorNewUserCount,
        totalUsers,
        canceledSubscriptions: canceledInMonth.length,
        supportTickets: supportTicketCount,
      },
      mrrTrend,
      userGrowth: userGrowthBuckets.map((bucket, i) => ({
        month: bucket.month,
        newUsers: newUsersPerMonth[i] ?? 0,
      })),
      topCategories,
      integrationHealth,
    };

    // Graceful degradation: if pdfkit fails (font files, memory), still send
    // the KPI summary email rather than dropping the month entirely.
    let pdfBase64: string | null = null;
    try {
      const pdfBuffer = await generateMonthlyBusinessReportPdf(reportData);
      pdfBase64 = pdfBuffer.toString("base64");
    } catch (error) {
      console.error("[CRON] admin-monthly-report PDF generation failed:", error);
    }

    const netMrrText = `${movement.netMrr >= 0 ? "+" : "−"}${fmtUsd(Math.abs(movement.netMrr))}`;
    const kpiRow = (k: string, v: string) =>
      `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">${escapeHtml(k)}</td>` +
      `<td align="right" style="padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:600;">${escapeHtml(v)}</td></tr>`;
    const html = `<div style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;max-width:560px;">
  <h1 style="margin:0 0 6px;font-size:22px;color:#0f172a;">LocateFlow monthly report — ${escapeHtml(label)}</h1>
  <p style="margin:0 0 16px;font-size:13px;color:#64748b;">${
    pdfBase64
      ? "The full business report is attached as a PDF."
      : "PDF generation failed this run — headline numbers below; check the server logs."
  }</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
    ${kpiRow("MRR", fmtUsd(mrr))}
    ${kpiRow("Net new MRR", netMrrText)}
    ${kpiRow("Churn", `${churnPct.toFixed(1)}%`)}
    ${kpiRow("New users", String(newUserCount))}
    ${kpiRow("Canceled subscriptions", String(canceledInMonth.length))}
    ${kpiRow("Support tickets", String(supportTicketCount))}
  </table>
</div>`;
    const text = htmlToPlainText(html);
    const subject = `LocateFlow monthly report — ${label}`;
    const attachments = pdfBase64
      ? [{ filename: `locateflow-monthly-report-${key}.pdf`, content: pdfBase64, contentType: "application/pdf" }]
      : undefined;

    // Per-admin fan-out. dedupeKey is the audited admin-monthly-report:<yyyy-mm>
    // namespace plus the recipient — emailLog.dedupeKey is unique, so a shared
    // key would let only the first recipient through.
    const sendResults = await Promise.all(
      recipients.map((to) =>
        sendLoggedEmail({
          to,
          subject,
          html,
          text,
          attachments,
          dedupeKey: `admin-monthly-report:${key}:${to}`,
          metadata: { kind: "admin-monthly-report", month: key },
        }).catch(() => ({ success: false, skipped: false })),
      ),
    );
    const sent = sendResults.filter((r) => r.success).length;

    return NextResponse.json({
      ok: sent > 0,
      month: key,
      recipients: recipients.length,
      sent,
      pdfAttached: Boolean(pdfBase64),
      kpis: {
        mrr: Math.round(mrr * 100) / 100,
        netNewMrr: movement.netMrr,
        churnPct: Math.round(churnPct * 10) / 10,
        newUsers: newUserCount,
        canceledSubscriptions: canceledInMonth.length,
        supportTickets: supportTicketCount,
        integrationSources: integrationHealth.length,
      },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] admin-monthly-report error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

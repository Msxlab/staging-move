export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import {
  computeArpuByPlan,
  computeMonthlyChurnRate,
  computeMrr,
  computeMrrMovement,
  computeMrrTrend,
  computeTrialConversion,
  monthlyEquivalentUsd,
  type RevenueSub,
} from "@/lib/billing-metrics";

/**
 * Read-only MRR / CHURN drill-down for the Subscriptions module.
 *
 * Everything here is COMPUTED FROM LOCAL Subscription rows (no Stripe call):
 *   - MRR trend (trailing 12 months, estimated),
 *   - new vs churned MRR (this month + last month),
 *   - ARPU by plan,
 *   - trial → paid conversion (this month + last month).
 *
 * The money math lives in the pure helpers in lib/billing-metrics so it is
 * unit-tested and shares ONE definition of "monthly equivalent revenue" with
 * the dashboard. ADMIN floor, mirroring the /api/billing dashboard (the same
 * aggregate revenue surface). Strictly read-only — never mutates anything.
 */

const TREND_MONTHS = 12;

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("subscriptions", "canRead", { minimumRole: "ADMIN" });
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Only the fields the revenue helpers read. No PII, no provider secrets.
    const rows = (await prisma.subscription.findMany({
      select: {
        plan: true,
        status: true,
        provider: true,
        accessType: true,
        billingInterval: true,
        createdAt: true,
        canceledAt: true,
        trialEndsAt: true,
        updatedAt: true,
      },
    })) as RevenueSub[];

    const activeSubs = rows.filter((s) => ["ACTIVE", "TRIALING"].includes(s.status));
    const canceledThisMonth = rows.filter(
      (s) => s.status === "CANCELED" && s.canceledAt && new Date(s.canceledAt) >= thisMonth,
    );
    const canceledLastMonth = rows.filter(
      (s) =>
        s.status === "CANCELED" &&
        s.canceledAt &&
        new Date(s.canceledAt) >= lastMonth &&
        new Date(s.canceledAt) < thisMonth,
    );

    const mrr = computeMrr(rows);
    const arr = mrr * 12;

    const churnRate = computeMonthlyChurnRate({
      activeSubs,
      canceledInMonth: canceledThisMonth,
      monthStart: thisMonth,
    });
    const lastMonthChurn = computeMonthlyChurnRate({
      activeSubs,
      canceledInMonth: canceledLastMonth,
      monthStart: lastMonth,
    });

    const arpuByPlan = computeArpuByPlan(rows);

    const movementThisMonth = computeMrrMovement({
      subs: rows,
      windowStart: thisMonth,
      windowEnd: now,
    });
    const movementLastMonth = computeMrrMovement({
      subs: rows,
      windowStart: lastMonth,
      windowEnd: thisMonth,
    });

    const conversionThisMonth = computeTrialConversion({
      subs: rows,
      windowStart: thisMonth,
      windowEnd: now,
    });
    const conversionLastMonth = computeTrialConversion({
      subs: rows,
      windowStart: lastMonth,
      windowEnd: thisMonth,
    });

    const mrrTrend = computeMrrTrend({ subs: rows, now, months: TREND_MONTHS });

    const payingActiveCount = activeSubs.filter((s) => monthlyEquivalentUsd(s) > 0).length;

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_ANALYTICS_VIEWED",
      entityType: "Subscription",
      entityId: "analytics",
      metadata: {
        operation: "subscription_analytics_view",
        status: "success",
        totalSubscriptions: rows.length,
        activeSubscriptions: activeSubs.length,
      },
      request: getAuditRequestMeta(request),
    });

    return NextResponse.json({
      generatedAt: now.toISOString(),
      totals: {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        totalSubscriptions: rows.length,
        activeSubscriptions: activeSubs.length,
        payingSubscriptions: payingActiveCount,
        churnRate: Math.round(churnRate * 100) / 100,
        lastMonthChurn: Math.round(lastMonthChurn * 100) / 100,
      },
      mrrMovement: {
        thisMonth: movementThisMonth,
        lastMonth: movementLastMonth,
      },
      arpuByPlan,
      trialConversion: {
        thisMonth: conversionThisMonth,
        lastMonth: conversionLastMonth,
      },
      mrrTrend,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Subscription analytics failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json({ error: "Failed to compute subscription analytics." }, { status: 500 });
  }
}

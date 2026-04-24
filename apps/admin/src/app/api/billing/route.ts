export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getMonthlyPlanPrice } from "@/lib/billing";

const MOBILE_BILLING_PROVIDERS = new Set(["APP_STORE", "PLAY_STORE"]);

function hasMissingStoreIdentifier(subscription: any) {
  if (subscription.provider === "APP_STORE") {
    return !(subscription.latestTransactionId || subscription.originalTransactionId);
  }

  if (subscription.provider === "PLAY_STORE") {
    return !subscription.purchaseToken;
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission("subscriptions", "canRead", { minimumRole: "ADMIN" });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const staleValidationThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const allSubs = await prisma.subscription.findMany({
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, createdAt: true } } },
    }) as any[];

    const planPrices: Record<string, number> = {
      FREE_TRIAL: 0,
      INDIVIDUAL: getMonthlyPlanPrice("INDIVIDUAL"),
    };

    const activeSubs = allSubs.filter((s) => ["ACTIVE", "TRIALING"].includes(s.status));
    const canceledSubs = allSubs.filter((s) => s.status === "CANCELED");
    const mobileSubs = allSubs.filter((s) => MOBILE_BILLING_PROVIDERS.has(s.provider));
    const activeMobileSubs = mobileSubs.filter((s) => ["ACTIVE", "TRIALING"].includes(s.status));
    const canceledThisMonth = canceledSubs.filter((s) => s.canceledAt && new Date(s.canceledAt) >= thisMonth);
    const canceledLastMonth = canceledSubs.filter((s) => s.canceledAt && new Date(s.canceledAt) >= lastMonth && new Date(s.canceledAt) < thisMonth);
    const staleMobileSubs = mobileSubs.filter((s) => !s.lastValidatedAt || new Date(s.lastValidatedAt) < staleValidationThreshold);
    const missingStoreIdentifiers = mobileSubs.filter((s) => hasMissingStoreIdentifier(s));

    const mrr = activeSubs.reduce((sum, s) => sum + (planPrices[s.plan] || 0), 0);
    const arr = mrr * 12;

    const planDistribution = allSubs.reduce((acc: Record<string, { total: number; active: number; revenue: number }>, s) => {
      if (!acc[s.plan]) acc[s.plan] = { total: 0, active: 0, revenue: 0 };
      acc[s.plan].total++;
      if (["ACTIVE", "TRIALING"].includes(s.status)) {
        acc[s.plan].active++;
        acc[s.plan].revenue += planPrices[s.plan] || 0;
      }
      return acc;
    }, {});

    const statusDistribution = allSubs.reduce((acc: Record<string, number>, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    const providerDistribution = allSubs.reduce((acc: Record<string, number>, s) => {
      const key = s.provider || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const platformDistribution = allSubs.reduce((acc: Record<string, number>, s) => {
      const key = s.platform || "unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const activeStart = activeSubs.filter((s) => new Date(s.createdAt) < thisMonth).length;
    const churnRate = activeStart > 0 ? (canceledThisMonth.length / activeStart) * 100 : 0;
    const lastMonthActiveStart = activeSubs.filter((s) => new Date(s.createdAt) < lastMonth).length;
    const lastMonthChurn = lastMonthActiveStart > 0 ? (canceledLastMonth.length / lastMonthActiveStart) * 100 : 0;

    const newSubsThisMonth = allSubs.filter((s) => new Date(s.createdAt) >= thisMonth).length;
    const newSubsLastMonth = allSubs.filter((s) => new Date(s.createdAt) >= lastMonth && new Date(s.createdAt) < thisMonth).length;

    const upgrades = allSubs.filter((s) => {
      if (!s.updatedAt || !s.createdAt) return false;
      return new Date(s.updatedAt) >= thirtyDaysAgo && new Date(s.updatedAt).getTime() !== new Date(s.createdAt).getTime();
    });

    const trialExpiring = allSubs.filter((s) => {
      if (s.status !== "TRIALING" || !s.trialEndsAt) return false;
      const daysLeft = Math.ceil((new Date(s.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 7;
    });

    const recentCancellations = canceledSubs
      .filter((s) => s.canceledAt && new Date(s.canceledAt) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.canceledAt!).getTime() - new Date(a.canceledAt!).getTime())
      .slice(0, 10);

    const dailyRevenue: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const subsOnDay = allSubs.filter((s) => new Date(s.createdAt) <= d && (s.status === "ACTIVE" || s.status === "TRIALING" || (s.canceledAt && new Date(s.canceledAt) > d)));
      dailyRevenue[key] = subsOnDay.reduce((sum, s) => sum + ((planPrices[s.plan] || 0) / 30), 0);
    }

    return NextResponse.json({
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      totalSubscriptions: allSubs.length,
      activeSubscriptions: activeSubs.length,
      churnRate: Math.round(churnRate * 100) / 100,
      lastMonthChurn: Math.round(lastMonthChurn * 100) / 100,
      newSubsThisMonth,
      newSubsLastMonth,
      planDistribution,
      statusDistribution,
      providerDistribution,
      platformDistribution,
      trialExpiring: trialExpiring.map((s) => ({ ...s, daysLeft: Math.ceil((new Date(s.trialEndsAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) })),
      recentCancellations,
      dailyRevenue,
      mobileOps: {
        totalSubscriptions: mobileSubs.length,
        activeSubscriptions: activeMobileSubs.length,
        staleValidationCount: staleMobileSubs.length,
        missingReceiptIdentifierCount: missingStoreIdentifiers.length,
        neverValidatedCount: mobileSubs.filter((s) => !s.lastValidatedAt).length,
        pendingValidationCount: mobileSubs.filter((s) => s.status === "PENDING_VALIDATION" || s.status === "UNKNOWN").length,
        appStoreSubscriptions: mobileSubs.filter((s) => s.provider === "APP_STORE").length,
        playStoreSubscriptions: mobileSubs.filter((s) => s.provider === "PLAY_STORE").length,
      },
      staleMobileSubscriptions: staleMobileSubs
        .sort((a, b) => {
          const left = a.lastValidatedAt ? new Date(a.lastValidatedAt).getTime() : 0;
          const right = b.lastValidatedAt ? new Date(b.lastValidatedAt).getTime() : 0;
          return left - right;
        })
        .slice(0, 10)
        .map((s) => ({
          id: s.id,
          user: s.user,
          provider: s.provider,
          platform: s.platform,
          plan: s.plan,
          status: s.status,
          lastValidatedAt: s.lastValidatedAt,
          lastSyncedAt: s.lastSyncedAt,
          missingReceiptIdentifier: hasMissingStoreIdentifier(s),
        })),
      avgRevenuePerUser: activeSubs.length > 0 ? Math.round((mrr / activeSubs.length) * 100) / 100 : 0,
      ltv: churnRate > 0 ? Math.round(((mrr / activeSubs.length) / (churnRate / 100)) * 100) / 100 : 0,
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

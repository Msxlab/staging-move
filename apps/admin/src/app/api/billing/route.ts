export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { BILLING_PLAN_DEFINITIONS } from "@/lib/shared-billing";
import { computeLtv, computeMonthlyChurnRate } from "@/lib/billing-metrics";

const MOBILE_BILLING_PROVIDERS = new Set(["APP_STORE", "PLAY_STORE"]);

// Compute the monthly-equivalent revenue contribution of a single
// subscription. Annual plans are amortized to monthly. Admin-granted Free
// Access (provider=ADMIN, accessType=FREE_ACCESS) generates no revenue and
// must not inflate MRR.
function monthlyEquivalent(sub: any): number {
  if (sub.accessType === "FREE_ACCESS") return 0;
  if (sub.provider === "ADMIN" || sub.provider === "TRIAL") return 0;
  // Trials are committed pipeline, not realized revenue — the subscriber has
  // not been charged yet. Exclude them from MRR for the same reason as
  // admin-granted/free access. (Trial counts still show up in
  // statusDistribution / trialExpiring, so the pipeline isn't lost.)
  if (sub.status === "TRIALING" || sub.accessType === "FREE_TRIAL") return 0;
  const def = (BILLING_PLAN_DEFINITIONS as any)[sub.plan];
  if (!def) return 0;
  if (sub.billingInterval === "YEAR") {
    if (typeof def.yearlyPriceUsd === "number") return def.yearlyPriceUsd / 12;
    return (def.monthlyPriceUsd || 0);
  }
  return def.monthlyPriceUsd || 0;
}

function hasMissingStoreIdentifier(subscription: any) {
  if (subscription.provider === "APP_STORE") {
    return !(subscription.latestTransactionId || subscription.originalTransactionId);
  }

  if (subscription.provider === "PLAY_STORE") {
    return !(subscription.purchaseTokenEncrypted || subscription.purchaseTokenHash || subscription.purchaseToken);
  }

  return false;
}

function redactDeletedBillingUser(user: any) {
  if (!user) return null;
  if (user.deletedAt) {
    return {
      id: user.id,
      email: null,
      firstName: null,
      lastName: null,
      createdAt: user.createdAt,
      deleted: true,
    };
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
  };
}

function sanitizeBillingSubscription(subscription: any) {
  const safeSubscription = { ...subscription };
  delete safeSubscription.purchaseToken;
  delete safeSubscription.purchaseTokenEncrypted;
  delete safeSubscription.purchaseTokenHash;
  delete safeSubscription.campaignSnapshot;
  delete safeSubscription.checkoutConsentSnapshot;
  delete safeSubscription.premiumNote;
  return {
    ...safeSubscription,
    purchaseTokenPresent: Boolean(
      subscription.purchaseTokenEncrypted || subscription.purchaseTokenHash || subscription.purchaseToken,
    ),
    user: redactDeletedBillingUser(subscription.user),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("subscriptions", "canRead", { minimumRole: "ADMIN" });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const staleValidationThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const allSubs = await prisma.subscription.findMany({
      select: {
        id: true,
        userId: true,
        plan: true,
        status: true,
        provider: true,
        platform: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        stripeCurrentPeriodEnd: true,
        billingProductId: true,
        originalTransactionId: true,
        latestTransactionId: true,
        purchaseTokenEncrypted: true,
        purchaseTokenHash: true,
        currentPeriodEndsAt: true,
        gracePeriodEndsAt: true,
        lastValidatedAt: true,
        lastSyncedAt: true,
        accessType: true,
        billingInterval: true,
        freeAccessEndsAt: true,
        cancelAtPeriodEnd: true,
        firstChargeAt: true,
        firstChargeAmount: true,
        autoRenew: true,
        campaignId: true,
        campaignCode: true,
        trialEndsAt: true,
        canceledAt: true,
        premiumUntil: true,
        premiumGrantedBy: true,
        premiumGrantedAt: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, createdAt: true, deletedAt: true } },
      },
    }) as any[];

    const activeSubs = allSubs.filter((s) => ["ACTIVE", "TRIALING"].includes(s.status));
    const canceledSubs = allSubs.filter((s) => s.status === "CANCELED");
    const mobileSubs = allSubs.filter((s) => MOBILE_BILLING_PROVIDERS.has(s.provider));
    const activeMobileSubs = mobileSubs.filter((s) => ["ACTIVE", "TRIALING"].includes(s.status));
    const canceledThisMonth = canceledSubs.filter((s) => s.canceledAt && new Date(s.canceledAt) >= thisMonth);
    const canceledLastMonth = canceledSubs.filter((s) => s.canceledAt && new Date(s.canceledAt) >= lastMonth && new Date(s.canceledAt) < thisMonth);
    const staleMobileSubs = mobileSubs.filter((s) => !s.lastValidatedAt || new Date(s.lastValidatedAt) < staleValidationThreshold);
    const missingStoreIdentifiers = mobileSubs.filter((s) => hasMissingStoreIdentifier(s));

    const mrr = activeSubs.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
    const arr = mrr * 12;
    // Per-user revenue metrics (ARPU, LTV) must divide by *paying* subs only.
    // Admin-granted premium (provider ADMIN / accessType FREE_ACCESS) and
    // trials generate no revenue — they're already excluded from MRR by
    // monthlyEquivalent, so including them in the denominator would dilute
    // ARPU/LTV. "Paying" = contributes a non-zero monthly equivalent.
    const payingActiveSubs = activeSubs.filter((s) => monthlyEquivalent(s) > 0);

    const planDistribution = allSubs.reduce((acc: Record<string, { total: number; active: number; revenue: number }>, s) => {
      if (!acc[s.plan]) acc[s.plan] = { total: 0, active: 0, revenue: 0 };
      acc[s.plan].total++;
      if (["ACTIVE", "TRIALING"].includes(s.status)) {
        acc[s.plan].active++;
        acc[s.plan].revenue += monthlyEquivalent(s);
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

    // Churn is measured against the start-of-month cohort (survivors +
    // those who canceled during the month). See computeMonthlyChurnRate —
    // the denominator now includes the churned subs instead of dividing by
    // survivors alone, which previously inflated the reported rate.
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

    // Approximate 30-day revenue trend — an estimate, not a ledger. It prices
    // every past day with each subscription's *current* plan/interval (we do
    // not snapshot historical price), and a subscription that lapsed without
    // an explicit canceledAt (EXPIRED/PAST_DUE) isn't placed on the timeline.
    // Fine for a trend sparkline; not for accounting/reconciliation.
    const dailyRevenue: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const subsOnDay = allSubs.filter((s) => new Date(s.createdAt) <= d && (s.status === "ACTIVE" || s.status === "TRIALING" || (s.canceledAt && new Date(s.canceledAt) > d)));
      dailyRevenue[key] = subsOnDay.reduce((sum, s) => sum + (monthlyEquivalent(s) / 30), 0);
    }

    await writeAdminAudit(session, {
      action: "BILLING_DASHBOARD_VIEWED",
      entityType: "Subscription",
      entityId: "dashboard",
      metadata: {
        operation: "billing_dashboard_view",
        status: "success",
        totalSubscriptions: allSubs.length,
        activeSubscriptions: activeSubs.length,
        mobileSubscriptions: mobileSubs.length,
        staleMobileSubscriptions: staleMobileSubs.length,
      },
      request: getAuditRequestMeta(req),
    });

    return NextResponse.json({
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      totalSubscriptions: allSubs.length,
      activeSubscriptions: activeSubs.length,
      // Active subs that actually generate revenue (excludes admin-granted
      // premium, free access, and trials). MRR/ARPU/LTV are based on these.
      payingSubscriptions: payingActiveSubs.length,
      churnRate: Math.round(churnRate * 100) / 100,
      lastMonthChurn: Math.round(lastMonthChurn * 100) / 100,
      newSubsThisMonth,
      newSubsLastMonth,
      planDistribution,
      statusDistribution,
      providerDistribution,
      platformDistribution,
      trialExpiring: trialExpiring.map((s) => ({
        ...sanitizeBillingSubscription(s),
        daysLeft: Math.ceil((new Date(s.trialEndsAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      recentCancellations: recentCancellations.map(sanitizeBillingSubscription),
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
          user: redactDeletedBillingUser(s.user),
          provider: s.provider,
          platform: s.platform,
          plan: s.plan,
          status: s.status,
          lastValidatedAt: s.lastValidatedAt,
          lastSyncedAt: s.lastSyncedAt,
          missingReceiptIdentifier: hasMissingStoreIdentifier(s),
        })),
      avgRevenuePerUser: payingActiveSubs.length > 0 ? Math.round((mrr / payingActiveSubs.length) * 100) / 100 : 0,
      ltv: Math.round(computeLtv({ mrr, activeCount: payingActiveSubs.length, churnRatePct: churnRate }) * 100) / 100,
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

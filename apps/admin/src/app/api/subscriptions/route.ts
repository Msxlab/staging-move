import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { parsePaginationParams } from "@/lib/pagination";
import { canSeeRawBillingIds, maskEmail, redactBillingIds } from "@/lib/privacy";

function redactSubscriptionUser(user: any, showRawBillingIds: boolean) {
  if (!user) return null;
  if (user.deletedAt) {
    return {
      id: user.id,
      email: null,
      firstName: null,
      lastName: null,
      deleted: true,
    };
  }

  return {
    id: user.id,
    email: showRawBillingIds ? user.email : maskEmail(user.email),
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

function redactSubscriptionRow(subscription: any, showRawBillingIds: boolean) {
  return {
    id: subscription.id,
    userId: subscription.userId,
    plan: subscription.plan,
    status: subscription.status,
    provider: subscription.provider,
    platform: subscription.platform,
    billingInterval: subscription.billingInterval,
    accessType: subscription.accessType,
    ...redactBillingIds(subscription, showRawBillingIds),
    stripeCurrentPeriodEnd: subscription.stripeCurrentPeriodEnd,
    purchaseTokenPresent: Boolean(
      subscription.purchaseTokenEncrypted || subscription.purchaseTokenHash || subscription.purchaseToken,
    ),
    currentPeriodEndsAt: subscription.currentPeriodEndsAt,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt,
    lastValidatedAt: subscription.lastValidatedAt,
    lastSyncedAt: subscription.lastSyncedAt,
    freeAccessEndsAt: subscription.freeAccessEndsAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    firstChargeAt: subscription.firstChargeAt,
    firstChargeAmount: subscription.firstChargeAmount,
    autoRenew: subscription.autoRenew,
    campaignId: subscription.campaignId,
    campaignCode: subscription.campaignCode,
    trialEndsAt: subscription.trialEndsAt,
    canceledAt: subscription.canceledAt,
    premiumUntil: subscription.premiumUntil,
    premiumGrantedBy: subscription.premiumGrantedBy,
    premiumGrantedAt: subscription.premiumGrantedAt,
    version: subscription.version,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    user: redactSubscriptionUser(subscription.user, showRawBillingIds),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" });
    const showRawBillingIds = canSeeRawBillingIds(session.role);
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = parsePaginationParams(searchParams, {
      defaultPerPage: 20,
    });
    const search = searchParams.get("search") || "";
    const plan = searchParams.get("plan") || "";
    const status = searchParams.get("status") || "";
    const provider = searchParams.get("provider") || "";
    const platform = searchParams.get("platform") || "";
    const accessType = searchParams.get("accessType") || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: any = {};
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      };
    }
    if (plan) where.plan = plan;
    // "PAST_DUE" from the dunning KPI card means the whole payment-recovery
    // group, not just the literal PAST_DUE status, so it matches the card count.
    if (status === "PAST_DUE") where.status = { in: ["PAST_DUE", "GRACE_PERIOD", "UNPAID"] };
    else if (status) where.status = status;
    if (provider) where.provider = provider;
    if (platform) where.platform = platform === "unassigned" ? null : platform;
    if (accessType) where.accessType = accessType === "none" ? null : accessType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59Z");
    }

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      subscriptions,
      total,
      totalAll,
      activeCount,
      trialingCount,
      canceledCount,
      pastDueCount,
      newThisMonth,
      planCounts,
      statusCounts,
      providerCounts,
      platformCounts,
      accessTypeCounts,
    ] = await Promise.all([
      prisma.subscription.findMany({
        where,
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
          user: { select: { id: true, email: true, firstName: true, lastName: true, deletedAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: perPage,
        skip,
      }),
      prisma.subscription.count({ where }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIALING" } }),
      prisma.subscription.count({ where: { status: "CANCELED" } }),
      // Dunning surface: payment-recovery states an operator should act on.
      prisma.subscription.count({ where: { status: { in: ["PAST_DUE", "GRACE_PERIOD", "UNPAID"] } } }),
      prisma.subscription.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.subscription.groupBy({ by: ["plan"], _count: { id: true } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.subscription.groupBy({ by: ["provider"], _count: { id: true } }),
      prisma.subscription.groupBy({ by: ["platform"], _count: { id: true } }),
      prisma.subscription.groupBy({ by: ["accessType"], _count: { id: true } }),
    ]);

    const planMap: Record<string, number> = {};
    planCounts.forEach((p: any) => { planMap[p.plan] = p._count.id; });

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: any) => { statusMap[s.status] = s._count.id; });

    const providerMap: Record<string, number> = {};
    providerCounts.forEach((p: any) => { providerMap[p.provider || "UNKNOWN"] = p._count.id; });

    const platformMap: Record<string, number> = {};
    platformCounts.forEach((p: any) => { platformMap[p.platform || "unassigned"] = p._count.id; });

    const accessTypeMap: Record<string, number> = {};
    accessTypeCounts.forEach((a: any) => { accessTypeMap[a.accessType || "none"] = a._count.id; });

    const sanitizedSubscriptions = subscriptions.map((subscription: any) =>
      redactSubscriptionRow(subscription, showRawBillingIds),
    );

    await writeAdminAudit(session, {
      action: "SUBSCRIPTIONS_LIST_VIEWED",
      entityType: "Subscription",
      entityId: "list",
      metadata: {
        operation: "subscriptions_list_view",
        status: "success",
        page,
        perPage,
        filters: {
          searchPresent: Boolean(search),
          plan: plan || null,
          status: status || null,
          provider: provider || null,
          platform: platform || null,
          accessType: accessType || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
        resultCount: sanitizedSubscriptions.length,
        total,
      },
      request: getAuditRequestMeta(request),
    });

    return NextResponse.json({
      subscriptions: sanitizedSubscriptions, total, page, perPage,
      stats: { totalAll, activeCount, trialingCount, canceledCount, pastDueCount, newThisMonth, planMap, statusMap, providerMap, platformMap, accessTypeMap },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}

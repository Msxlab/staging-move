import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { parsePaginationParams } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" });
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = parsePaginationParams(searchParams, {
      defaultPerPage: 20,
    });
    const search = searchParams.get("search") || "";
    const plan = searchParams.get("plan") || "";
    const status = searchParams.get("status") || "";
    const provider = searchParams.get("provider") || "";
    const platform = searchParams.get("platform") || "";
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
    if (status) where.status = status;
    if (provider) where.provider = provider;
    if (platform) where.platform = platform === "unassigned" ? null : platform;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59Z");
    }

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [subscriptions, total, totalAll, activeCount, trialingCount, canceledCount, newThisMonth, planCounts, statusCounts, providerCounts, platformCounts] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
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
      prisma.subscription.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.subscription.groupBy({ by: ["plan"], _count: { id: true } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.subscription.groupBy({ by: ["provider"], _count: { id: true } }),
      prisma.subscription.groupBy({ by: ["platform"], _count: { id: true } }),
    ]);

    const planMap: Record<string, number> = {};
    planCounts.forEach((p: any) => { planMap[p.plan] = p._count.id; });

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: any) => { statusMap[s.status] = s._count.id; });

    const providerMap: Record<string, number> = {};
    providerCounts.forEach((p: any) => { providerMap[p.provider || "UNKNOWN"] = p._count.id; });

    const platformMap: Record<string, number> = {};
    platformCounts.forEach((p: any) => { platformMap[p.platform || "unassigned"] = p._count.id; });

    return NextResponse.json({
      subscriptions, total, page, perPage,
      stats: { totalAll, activeCount, trialingCount, canceledCount, newThisMonth, planMap, statusMap, providerMap, platformMap },
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

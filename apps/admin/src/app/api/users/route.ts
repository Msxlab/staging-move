import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users", "canRead", { minimumRole: "VIEWER" });
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "20");
    const search = searchParams.get("search") || "";
    const plan = searchParams.get("plan") || "";
    const subStatus = searchParams.get("subStatus") || "";
    const hasReviews = searchParams.get("hasReviews");
    const hasMoving = searchParams.get("hasMoving");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = searchParams.get("sortDir") || "desc";

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }
    if (plan) {
      where.subscription = { plan };
    }
    if (subStatus) {
      where.subscription = { ...where.subscription, status: subStatus };
    }
    if (hasReviews === "true") where.providerReviews = { some: {} };
    if (hasMoving === "true") where.movingPlans = { some: {} };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59Z");
    }

    const orderBy: any = {};
    if (sortBy === "name") orderBy.firstName = sortDir;
    else if (sortBy === "email") orderBy.email = sortDir;
    else orderBy.createdAt = sortDir;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeek = new Date(sevenDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [users, total, totalAll, newThisWeek, newPrevWeek, activeSubCount, planCounts] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          subscription: { select: { plan: true, status: true, trialEndsAt: true } },
          profile: { select: { familyStatus: true, hasChildren: true } },
          _count: {
            select: {
              addresses: true,
              services: true,
              providerReviews: true,
              movingPlans: true,
            },
          },
        },
        orderBy,
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: prevWeek, lt: sevenDaysAgo } } }),
      prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
      prisma.subscription.groupBy({ by: ["plan"], _count: { id: true } }),
    ]);

    const planMap: Record<string, number> = {};
    planCounts.forEach((p: any) => { planMap[p.plan] = p._count.id; });

    const weeklyTrend = newPrevWeek > 0
      ? Math.round(((newThisWeek - newPrevWeek) / newPrevWeek) * 100)
      : newThisWeek > 0 ? 100 : 0;

    return NextResponse.json({
      users, total, page, perPage,
      stats: { totalAll, newThisWeek, weeklyTrend, activeSubCount, planMap },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requirePermission("users", "canDelete", { minimumRole: "ADMIN" });
    const { ids, confirmPassword } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No user IDs provided" }, { status: 400 });
    }

    // Step-up auth: bulk user deletion is the highest-blast-radius admin action.
    const confirm = await requirePasswordConfirm(session, confirmPassword);
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true },
        { status: 403 },
      );
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      include: { subscription: true },
    });

    let queued = 0;

    for (const user of users) {
      const existingRequest = await prisma.gDPRRequest.findFirst({
        where: {
          userId: user.id,
          type: "DELETE",
          status: { in: ["PENDING", "PROCESSING"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!existingRequest) {
        await prisma.gDPRRequest.create({
          data: {
            userId: user.id,
            type: "DELETE",
            status: "PENDING",
            requestData: JSON.stringify({
              source: "admin_bulk",
              initiatedByAdminId: session.adminId,
              email: user.email,
              stripeSubscriptionId: user.subscription?.stripeSubscriptionId || null,
              initiatedAt: new Date().toISOString(),
              cleanup: {
                stripeCanceled: false,
                clerkDeleted: false,
                userDeleted: false,
                attempts: 0,
                lastAttemptAt: null,
                lastError: null,
              },
            }),
          },
        });
        queued += 1;
      }

      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "BULK_DELETE_USER",
          entityType: "User",
          entityId: user.id,
          changes: JSON.stringify({ email: user.email, queued: !existingRequest }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      });
    }

    return NextResponse.json({
      queued,
      total: users.length,
      message: queued > 0
        ? `${queued} user deletion request(s) queued for staged processing.`
        : "Selected users already have deletion requests in progress.",
    }, { status: 202 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to delete users" }, { status: 500 });
  }
}

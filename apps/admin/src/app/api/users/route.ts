import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { parsePaginationParams } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users", "canRead", { minimumRole: "VIEWER" });
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = parsePaginationParams(searchParams, {
      defaultPerPage: 20,
    });
    const search = searchParams.get("search") || "";
    const plan = searchParams.get("plan") || "";
    const subStatus = searchParams.get("subStatus") || "";
    const hasReviews = searchParams.get("hasReviews");
    const hasMoving = searchParams.get("hasMoving");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = searchParams.get("sortDir") || "desc";

    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const statusFilter = searchParams.get("status");
    const deletedScope =
      statusFilter === "deleted" || statusFilter === "all"
        ? statusFilter
        : includeDeleted
          ? "all"
          : "active";
    const deletedWhere =
      deletedScope === "all"
        ? {}
        : deletedScope === "deleted"
          ? { deletedAt: { not: null } }
          : { deletedAt: null };
    const where: any = { ...deletedWhere };
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
    if (hasReviews === "true") {
      where.services = { some: { personalReview: { not: null } } };
    }
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
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          deletedAt: true,
          subscription: { select: { plan: true, status: true, trialEndsAt: true } },
          profile: { select: { familyStatus: true, hasChildren: true } },
          _count: {
            select: {
              addresses: true,
              services: true,
              movingPlans: true,
            },
          },
          services: { select: { personalReview: true } },
        },
        orderBy,
        take: perPage,
        skip,
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: deletedWhere }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo }, ...deletedWhere } }),
      prisma.user.count({ where: { createdAt: { gte: prevWeek, lt: sevenDaysAgo }, ...deletedWhere } }),
      prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
      prisma.subscription.groupBy({ by: ["plan"], _count: { id: true } }),
    ]);

    const usersWithReviewCounts = users.map((user: any) => {
      const reviewCount = user.services.filter((service: any) =>
        Boolean(service.personalReview),
      ).length;
      const { services, ...rest } = user;
      return {
        ...rest,
        _count: {
          ...rest._count,
          providerReviews: reviewCount,
        },
      };
    });

    const planMap: Record<string, number> = {};
    planCounts.forEach((p: any) => { planMap[p.plan] = p._count.id; });

    const weeklyTrend = newPrevWeek > 0
      ? Math.round(((newThisWeek - newPrevWeek) / newPrevWeek) * 100)
      : newThisWeek > 0 ? 100 : 0;

    return NextResponse.json({
      users: usersWithReviewCounts, total, page, perPage,
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
    const requestedIds = Array.isArray(ids)
      ? Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)))
      : [];
    if (requestedIds.length === 0) {
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
      where: { id: { in: requestedIds } },
      include: { subscription: true },
    });
    const usersById = new Map(users.map((user: any) => [user.id, user]));

    let deleted = 0;
    let queued = 0;
    let alreadyQueued = 0;
    let skippedProcessing = 0;
    const skipped: Array<{ id: string; reason: string }> = [];
    const deletedIds: string[] = [];

    for (const id of requestedIds) {
      if (id === session.adminId) {
        skipped.push({ id, reason: "Self-delete is not allowed from this screen" });
        continue;
      }

      const user = usersById.get(id);
      if (!user) {
        skipped.push({ id, reason: "User not found" });
        continue;
      }
      if (user.deletedAt) {
        skipped.push({ id, reason: "User is already deleted" });
        continue;
      }

      const existingRequest = await prisma.gDPRRequest.findFirst({
        where: {
          userId: user.id,
          type: "DELETE",
          status: { in: ["PENDING", "PROCESSING"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingRequest?.status === "PROCESSING") {
        skippedProcessing += 1;
        skipped.push({ id: user.id, reason: "DELETE request already processing" });
        continue;
      }

      const now = new Date();
      await prisma.$transaction(async (tx: any) => {
        const softDelete = await tx.user.updateMany({
          where: { id: user.id, deletedAt: null },
          data: { deletedAt: now },
        });
        if (softDelete.count !== 1) {
          throw new Error("USER_DELETE_SKIPPED");
        }

        await Promise.all([
          tx.userLoginSession.updateMany({
            where: { userId: user.id, isActive: true },
            data: { isActive: false, lastActivity: now },
          }),
          tx.userSession.updateMany({
            where: { userId: user.id, isActive: true },
            data: { isActive: false, sessionEnd: now, lastActivity: now },
          }),
        ]);

        if (!existingRequest) {
          await tx.gDPRRequest.create({
            data: {
              userId: user.id,
              type: "DELETE",
              status: "PENDING",
              requestData: JSON.stringify({
                source: "admin_bulk",
                initiatedByAdminId: session.adminId,
                email: user.email,
                stripeSubscriptionId: user.subscription?.stripeSubscriptionId || null,
                initiatedAt: now.toISOString(),
                cleanup: {
                  stripeCanceled: false,
                  userDeleted: false,
                  attempts: 0,
                  lastAttemptAt: null,
                  lastError: null,
                },
              }),
            },
          });
        }

        await tx.adminAuditLog.create({
          data: {
            adminUserId: session.adminId,
            action: "BULK_DELETE_USER",
            entityType: "User",
            entityId: user.id,
            changes: JSON.stringify({
              email: user.email,
              softDeletedAt: now.toISOString(),
              gdprRequestStatus: existingRequest?.status || "PENDING",
              queuedCleanup: !existingRequest,
            }),
            ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          },
        });
      });

      deleted += 1;
      deletedIds.push(user.id);
      if (existingRequest) alreadyQueued += 1;
      else queued += 1;
    }

    return NextResponse.json({
      deleted,
      queued,
      alreadyQueued,
      skippedProcessing,
      skippedCount: skipped.length,
      skipped,
      deletedIds,
      total: requestedIds.length,
      message: deleted > 0
        ? `${deleted} user${deleted === 1 ? "" : "s"} deleted from the active list. GDPR cleanup is queued for staged processing.`
        : "No users were deleted.",
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message === "USER_DELETE_SKIPPED") {
      return NextResponse.json({ error: "User could not be deleted because its state changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Failed to delete users:", error);
    return NextResponse.json({ error: "Failed to delete users" }, { status: 500 });
  }
}

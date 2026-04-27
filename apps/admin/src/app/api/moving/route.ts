import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { parsePaginationParams } from "@/lib/pagination";
import {
  CANCELED_MOVING_PLAN_STATUSES,
  isCanceledMovingPlanStatus,
  normalizeMovingPlanStatus,
} from "@locateflow/shared";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("moving_plans", "canRead", { minimumRole: "VIEWER" });
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";
    const fromState = searchParams.get("fromState") || "";
    const toState = searchParams.get("toState") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const { page, perPage, skip } = parsePaginationParams(searchParams, {
      defaultPerPage: 50,
    });

    const where: any = {};
    if (status) {
      const normalizedStatus = normalizeMovingPlanStatus(status);
      where.status = isCanceledMovingPlanStatus(normalizedStatus)
        ? { in: [...CANCELED_MOVING_PLAN_STATUSES] }
        : normalizedStatus;
    }
    if (fromState) where.fromAddress = { state: fromState };
    if (toState) where.toAddress = { state: toState };
    if (dateFrom || dateTo) {
      where.moveDate = {};
      if (dateFrom) where.moveDate.gte = new Date(dateFrom);
      if (dateTo) where.moveDate.lte = new Date(dateTo);
    }
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      };
    }

    const [plans, total, statusCounts] = await Promise.all([
      prisma.movingPlan.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          fromAddress: {
            select: {
              street: true,
              city: true,
              state: true,
              zip: true,
              _count: { select: { services: true } },
            },
          },
          toAddress: {
            select: {
              street: true,
              city: true,
              state: true,
              zip: true,
              _count: { select: { services: true } },
            },
          },
          moveTasks: {
            where: { deletedAt: null },
            select: {
              id: true,
              actionType: true,
              status: true,
              confidence: true,
              title: true,
              dueDate: true,
              provider: { select: { id: true, name: true, scope: true } },
              customProvider: { select: { id: true, name: true, providerType: true } },
              destinationProvider: { select: { id: true, name: true, scope: true } },
            },
            orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
            take: 8,
          },
          _count: { select: { moveTasks: true } },
        },
        orderBy: { moveDate: "desc" },
        take: perPage,
        skip,
      }),
      prisma.movingPlan.count({ where }),
      prisma.movingPlan.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    const nextMonth = new Date(thisMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const thisMonthCount = await prisma.movingPlan.count({
      where: { moveDate: { gte: thisMonth, lt: nextMonth } },
    });

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: any) => { statusMap[s.status] = s._count.id; });

    return NextResponse.json({
      plans: plans.map((plan) => ({ ...plan, status: normalizeMovingPlanStatus(plan.status) })),
      total,
      page,
      perPage,
      stats: {
        total,
        planning: statusMap["PLANNING"] || 0,
        inProgress: statusMap["IN_PROGRESS"] || 0,
        completed: statusMap["COMPLETED"] || 0,
        cancelled: (statusMap["CANCELED"] || 0) + (statusMap["CANCELLED"] || 0),
        thisMonth: thisMonthCount,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to fetch moving plans:", error);
    return NextResponse.json({ error: "Failed to fetch moving plans" }, { status: 500 });
  }
}

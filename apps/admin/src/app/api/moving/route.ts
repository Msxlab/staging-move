import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

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
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "50");

    const where: any = {};
    if (status) where.status = status;
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
        },
        orderBy: { moveDate: "desc" },
        take: perPage,
        skip: (page - 1) * perPage,
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
      plans,
      total,
      page,
      perPage,
      stats: {
        total,
        planning: statusMap["PLANNING"] || 0,
        inProgress: statusMap["IN_PROGRESS"] || 0,
        completed: statusMap["COMPLETED"] || 0,
        cancelled: statusMap["CANCELLED"] || 0,
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { taskSchema } from "@/lib/validators";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";

// GET /api/tasks
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const movingPlanId = searchParams.get("movingPlanId");
    const completed = searchParams.get("completed");

    const where: any = { userId };
    if (movingPlanId) where.movingPlanId = movingPlanId;
    if (completed !== null) where.completed = completed === "true";

    const pagination = parsePaginationParams(searchParams);
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({ tasks, ...buildPaginatedResponse(tasks, total, pagination) });
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// POST /api/tasks
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // Rate limit: 60 writes per minute
    const rlKey = getRateLimitKey(request, "task:create");
    const rl = await rateLimit(rlKey, { limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json();
    const validated = taskSchema.parse(body);

    if (validated.movingPlanId) {
      const plan = await prisma.movingPlan.findUnique({ where: { id: validated.movingPlanId } });
      if (!plan || plan.userId !== userId) {
        return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
      }
    }

    const task = await prisma.task.create({
      data: {
        ...validated,
        userId,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

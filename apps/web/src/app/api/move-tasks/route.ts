import { NextRequest, NextResponse } from "next/server";
import { buildMoveTaskLifecyclePatch } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { canGenerateMoveTasks } from "@/lib/plan-limits";
import { syncSuggestedMoveTasks } from "@/lib/move-task-generation";
import { completeMoveTaskWithLocalEffect } from "@/lib/move-task-local-effects";

function includeTaskContext() {
  return {
    service: { select: { id: true, providerName: true, category: true, isActive: true, addressId: true } },
    provider: { select: { id: true, name: true, slug: true, category: true } },
    customProvider: { select: { id: true, name: true, category: true, providerType: true, trustStatus: true } },
    destinationProvider: { select: { id: true, name: true, slug: true, category: true } },
    originAddress: { select: { id: true, nickname: true, city: true, state: true, zip: true } },
    destinationAddress: { select: { id: true, nickname: true, city: true, state: true, zip: true } },
  };
}

async function recordMoveTaskEvent(userId: string, event: string, metadata: Record<string, unknown>) {
  await prisma.userEvent.create({
    data: {
      userId,
      event: event.slice(0, 50),
      page: "/moving",
      metadata: JSON.stringify(metadata),
    },
  }).catch(() => null);
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const movingPlanId = searchParams.get("movingPlanId") || undefined;
    const status = searchParams.get("status") || undefined;

    const tasks = await prisma.moveTask.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(movingPlanId ? { movingPlanId } : {}),
        ...(status ? { status } : {}),
      },
      include: includeTaskContext(),
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({
      tasks,
      metadata: {
        localOnly: true,
        noExternalAutomation: true,
        completionMeaning: "Task completion updates LocateFlow only.",
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch move tasks:", error);
    return NextResponse.json({ error: "Failed to fetch move tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const rlKey = getRateLimitKey(request, "move-task:generate");
    const rl = await rateLimit(rlKey, { limit: 20, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const entitlement = await canGenerateMoveTasks(userId);
    if (!entitlement.allowed) {
      return NextResponse.json(
        { error: entitlement.reason, code: entitlement.code, upgradeRequired: entitlement.upgradeRequired },
        { status: 403 },
      );
    }

    const body = await request.json();
    const movingPlanId = typeof body?.movingPlanId === "string" ? body.movingPlanId : null;
    if (!movingPlanId) {
      return NextResponse.json({ error: "movingPlanId is required" }, { status: 400 });
    }

    const result = await syncSuggestedMoveTasks(userId, movingPlanId);
    const tasks = await prisma.moveTask.findMany({
      where: { userId, movingPlanId, deletedAt: null },
      include: includeTaskContext(),
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "TASK_GENERATED",
      entityType: "MovingPlan",
      entityId: movingPlanId,
      changes: { generated: result.generated.length, skipped: result.skipped.length },
      ...meta,
    });
    await recordMoveTaskEvent(userId, "MOVE_TASK_GENERATED", {
      movingPlanId,
      generated: result.generated.length,
      skipped: result.skipped.length,
      localOnly: true,
    });

    return NextResponse.json({
      tasks,
      generatedCount: result.generated.length,
      skippedCount: result.skipped.length,
      metadata: {
        localOnly: true,
        noExternalAutomation: true,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "Moving plan not found") {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }
    if (error?.message === "Plan addresses must have state info") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error?.message === "MOVE_TASK_GENERATION_NOT_ENTITLED") {
      return NextResponse.json({ error: "Subscription required to generate move tasks", upgradeRequired: true }, { status: 403 });
    }
    console.error("Failed to generate move tasks:", error);
    return NextResponse.json({ error: "Failed to generate move tasks" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const rlKey = getRateLimitKey(request, "move-task:update");
    const rl = await rateLimit(rlKey, { limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : null;
    const event = typeof body?.event === "string" ? body.event.toUpperCase() : null;
    const notes = typeof body?.notes === "string" ? body.notes.slice(0, 2000) : undefined;
    const selectedDestinationProviderId =
      typeof body?.selectedDestinationProviderId === "string"
        ? body.selectedDestinationProviderId
        : undefined;
    const selectedCustomProviderId =
      typeof body?.selectedCustomProviderId === "string"
        ? body.selectedCustomProviderId
        : undefined;
    if (!id || !["ACCEPT", "START", "COMPLETE", "DISMISS", "REOPEN"].includes(event || "")) {
      return NextResponse.json({ error: "id and valid event are required" }, { status: 400 });
    }

    const existing = await prisma.moveTask.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Move task not found" }, { status: 404 });
    }

    const task =
      event === "COMPLETE"
        ? (
            await completeMoveTaskWithLocalEffect(userId, id, {
              notes,
              selectedDestinationProviderId,
              selectedCustomProviderId,
            })
          ).task
        : await prisma.moveTask.update({
            where: { id },
            data: {
              ...buildMoveTaskLifecyclePatch(existing as any, event as any),
              ...(notes !== undefined ? { notes } : {}),
            },
            include: includeTaskContext(),
          });

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "TASK_STATUS",
      entityType: "MoveTask",
      entityId: id,
      changes: {
        event,
        status: task.status,
        selectedDestinationProviderId: selectedDestinationProviderId || null,
        selectedCustomProviderId: selectedCustomProviderId || null,
        localOnly: true,
      },
      ...meta,
    });
    await recordMoveTaskEvent(userId, `MOVE_TASK_${event}`, {
      moveTaskId: id,
      status: task.status,
      actionType: task.actionType,
      selectedDestinationProviderId: selectedDestinationProviderId || null,
      selectedCustomProviderId: selectedCustomProviderId || null,
      localOnly: true,
      noExternalAutomation: true,
    });

    return NextResponse.json({
      task,
      metadata: {
        localOnly: true,
        noExternalAutomation: true,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "INVALID_MOVE_TASK_STATUS_TRANSITION") {
      return NextResponse.json({ error: "Invalid move task status transition" }, { status: 400 });
    }
    console.error("Failed to update move task:", error);
    return NextResponse.json({ error: "Failed to update move task" }, { status: 500 });
  }
}

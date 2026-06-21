import { NextRequest, NextResponse } from "next/server";
import { buildMoveTaskLifecyclePatch } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { canGenerateMoveTasks } from "@/lib/plan-limits";
import { syncSuggestedMoveTasks } from "@/lib/move-task-generation";
import { completeMoveTaskWithLocalEffect } from "@/lib/move-task-local-effects";
import { apiGateErrorResponse } from "@/lib/api-gates";
import {
  assertWorkspaceAction,
  planLimitScopeForDataScope,
  resolveWorkspaceDataScope,
  type WorkspaceDataScope,
} from "@/lib/workspace-data-scope";

function includeTaskContext() {
  return {
    service: { select: { id: true, providerName: true, category: true, isActive: true, addressId: true } },
    provider: { select: { id: true, name: true, slug: true, category: true } },
    customProvider: { select: { id: true, name: true, category: true, providerType: true, trustStatus: true } },
    destinationProvider: { select: { id: true, name: true, slug: true, category: true, affiliateActive: true } },
    originAddress: { select: { id: true, nickname: true, city: true, state: true, zip: true } },
    destinationAddress: { select: { id: true, nickname: true, city: true, state: true, zip: true } },
    // Assignee (Family/Pro). Only id + name fields — enough to render an
    // avatar/initials; null when unassigned. The client derives initials.
    assignedTo: { select: { id: true, firstName: true, lastName: true } },
  };
}

function assigneeSummary(
  assignedTo: { id: string; firstName: string | null; lastName: string | null } | null | undefined,
) {
  if (!assignedTo) return null;
  const name = [assignedTo.firstName, assignedTo.lastName].filter(Boolean).join(" ") || null;
  const initials =
    ((assignedTo.firstName?.charAt(0) || "") + (assignedTo.lastName?.charAt(0) || "")).toUpperCase() || "U";
  return { id: assignedTo.id, name, initials };
}

/** Shape a task for the response: replace the raw `assignedTo` user with a compact summary. */
function shapeTask<T extends { assignedTo?: { id: string; firstName: string | null; lastName: string | null } | null }>(
  task: T,
) {
  const { assignedTo, ...rest } = task as any;
  return { ...rest, assignee: assigneeSummary(assignedTo) };
}

/**
 * The ACTIVE members of the workspace that owns `planWorkspaceId`, as a picker
 * source. Empty for solo/legacy (no workspaceId) and for single-member
 * workspaces — the UI uses `length > 1` to decide whether to show assignment at
 * all. Names + initials only; emails are never exposed here.
 */
async function activeWorkspaceMembers(workspaceId: string | null) {
  if (!workspaceId) return [] as { userId: string; name: string | null; initials: string }[];
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: { userId: true, user: { select: { firstName: true, lastName: true } } },
  });
  return members.map((m) => {
    const name = [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || null;
    const initials = ((m.user.firstName?.charAt(0) || "") + (m.user.lastName?.charAt(0) || "")).toUpperCase() || "U";
    return { userId: m.userId, name, initials };
  });
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

function moveTaskWhereForScope(scope: WorkspaceDataScope, extra: Record<string, unknown> = {}) {
  const base = scope.workspaceId
    ? {
        movingPlan: { workspaceId: scope.workspaceId, deletedAt: null },
        ...(scope.memberRole === "CHILD" ? { userId: scope.actorUserId } : {}),
      }
    : { userId: scope.actorUserId };
  return { ...base, deletedAt: null, ...extra };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const scope = await resolveWorkspaceDataScope(request, userId);
    assertWorkspaceAction(scope, "address.view", { resourceUserId: userId });
    const { searchParams } = new URL(request.url);
    const movingPlanId = searchParams.get("movingPlanId") || undefined;
    const status = searchParams.get("status") || undefined;

    const tasks = await prisma.moveTask.findMany({
      where: moveTaskWhereForScope(scope, {
        ...(movingPlanId ? { movingPlanId } : {}),
        ...(status ? { status } : {}),
      }),
      include: includeTaskContext(),
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    // Workspace member picker source. Only populated for a true multi-member
    // workspace request — solo/Individual (no workspaceId) gets an empty list,
    // so the UI never surfaces assignment there.
    const workspaceMembers = await activeWorkspaceMembers(scope.workspaceId);
    const assignmentEnabled = workspaceMembers.length > 1;

    return NextResponse.json({
      tasks: tasks.map(shapeTask),
      // Member picker + a convenience flag the clients gate the Assign UI on.
      // `assignmentEnabled` is true only when there are 2+ ACTIVE members.
      workspaceMembers,
      assignmentEnabled,
      metadata: {
        localOnly: true,
        noExternalAutomation: true,
        completionMeaning: "Task completion updates LocateFlow only.",
      },
    });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
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
    const scope = await resolveWorkspaceDataScope(request, userId);
    assertWorkspaceAction(scope, "address.edit", { resourceUserId: userId });
    const rlKey = getRateLimitKey(request, "move-task:generate", { userId });
    const rl = await rateLimit(rlKey, { limit: 20, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const entitlement = await canGenerateMoveTasks(userId, planLimitScopeForDataScope(scope));
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

    const plan = await prisma.movingPlan.findFirst({
      where: {
        id: movingPlanId,
        deletedAt: null,
        ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : { userId }),
      },
      select: { id: true, userId: true, workspaceId: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }
    assertWorkspaceAction(scope, "address.edit", {
      resourceUserId: plan.userId,
      message: "No permission to generate move tasks for this plan.",
    });

    const result = await syncSuggestedMoveTasks(plan.userId, movingPlanId);
    const tasks = await prisma.moveTask.findMany({
      where: moveTaskWhereForScope(scope, { movingPlanId }),
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
      tasks: tasks.map(shapeTask),
      generatedCount: result.generated.length,
      skippedCount: result.skipped.length,
      metadata: {
        localOnly: true,
        noExternalAutomation: true,
      },
    });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
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
    const scope = await resolveWorkspaceDataScope(request, userId);
    const rlKey = getRateLimitKey(request, "move-task:update", { userId });
    const rl = await rateLimit(rlKey, { limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : null;
    const event = typeof body?.event === "string" ? body.event.toUpperCase() : null;
    const hasEvent = event !== null;
    const notes = typeof body?.notes === "string" ? body.notes.slice(0, 2000) : undefined;
    const selectedDestinationProviderId =
      typeof body?.selectedDestinationProviderId === "string"
        ? body.selectedDestinationProviderId
        : undefined;
    const selectedCustomProviderId =
      typeof body?.selectedCustomProviderId === "string"
        ? body.selectedCustomProviderId
        : undefined;

    // Assignment is an independent, optional operation. We distinguish:
    //   key absent          → leave the assignee untouched
    //   value null/""       → unassign (set null)
    //   value string        → assign to that user (validated below)
    // `assignChanged` gates whether we run the assignment path at all.
    const assignKeyPresent = Object.prototype.hasOwnProperty.call(body ?? {}, "assignedToUserId");
    const rawAssignee = body?.assignedToUserId;
    const wantsAssign =
      assignKeyPresent && typeof rawAssignee === "string" && rawAssignee.length > 0
        ? rawAssignee
        : null;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (hasEvent && !["ACCEPT", "START", "COMPLETE", "DISMISS", "REOPEN"].includes(event)) {
      return NextResponse.json({ error: "valid event is required" }, { status: 400 });
    }
    // Must do SOMETHING: a lifecycle event or an assignment change.
    if (!hasEvent && !assignKeyPresent) {
      return NextResponse.json({ error: "id and valid event are required" }, { status: 400 });
    }

    const entitlement = await canGenerateMoveTasks(userId, planLimitScopeForDataScope(scope));
    if (!entitlement.allowed) {
      return NextResponse.json(
        { error: entitlement.reason, code: entitlement.code, upgradeRequired: entitlement.upgradeRequired },
        { status: 403 },
      );
    }

    const existing = await prisma.moveTask.findFirst({
      where: moveTaskWhereForScope(scope, { id }),
      include: { movingPlan: { select: { workspaceId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Move task not found" }, { status: 404 });
    }
    // Permission: any ACTIVE member may update/assign within their workspace.
    // assertWorkspaceAction("address.edit") already encodes that — a SUSPENDED
    // or VIEW_ONLY member is rejected, an ACTIVE OWNER/ADMIN/MEMBER passes.
    assertWorkspaceAction(scope, "address.edit", {
      resourceUserId: existing.userId,
      message: "No permission to update this move task.",
    });

    // Validate + resolve the assignment target before any write. The assignee
    // must be an ACTIVE member of the SAME workspace that owns this task (the
    // workspace is resolved via the task's movingPlan). null = unassign and is
    // always allowed. A target outside the workspace is rejected (not silently
    // dropped) so the caller learns the assignment failed.
    let assigneeUpdate: { assignedToUserId: string | null } | null = null;
    if (assignKeyPresent) {
      if (wantsAssign === null) {
        assigneeUpdate = { assignedToUserId: null };
      } else {
        const planWorkspaceId = existing.movingPlan?.workspaceId ?? null;
        if (!planWorkspaceId) {
          // Solo/Individual (no workspace) can't assign to anyone but the owner;
          // there is no member list. Reject anything other than unassign.
          return NextResponse.json(
            { error: "Task assignment requires a shared workspace." },
            { status: 400 },
          );
        }
        const member = await prisma.workspaceMember.findFirst({
          where: { workspaceId: planWorkspaceId, userId: wantsAssign, status: "ACTIVE" },
          select: { userId: true },
        });
        if (!member) {
          return NextResponse.json(
            { error: "Assignee must be an active member of this workspace." },
            { status: 400 },
          );
        }
        assigneeUpdate = { assignedToUserId: member.userId };
      }
    }

    let task;
    if (event === "COMPLETE") {
      // COMPLETE runs its own local-effect pipeline; fold the assignment in as a
      // follow-up update so both land on one request.
      const completed = (
        await completeMoveTaskWithLocalEffect(existing.userId, id, {
          notes,
          selectedDestinationProviderId,
          selectedCustomProviderId,
          workspaceId: scope.workspaceId,
          completedByUserId: userId,
        })
      ).task;
      task = assigneeUpdate
        ? await prisma.moveTask.update({ where: { id }, data: assigneeUpdate, include: includeTaskContext() })
        : completed;
    } else if (hasEvent) {
      task = await prisma.moveTask.update({
        where: { id },
        data: {
          ...buildMoveTaskLifecyclePatch(existing as any, event as any),
          ...(notes !== undefined ? { notes } : {}),
          ...(assigneeUpdate ?? {}),
        },
        include: includeTaskContext(),
      });
    } else {
      // Assignment-only PATCH (no lifecycle event).
      task = await prisma.moveTask.update({
        where: { id },
        data: { ...(assigneeUpdate ?? {}), ...(notes !== undefined ? { notes } : {}) },
        include: includeTaskContext(),
      });
    }

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: hasEvent ? "TASK_STATUS" : "TASK_ASSIGN",
      entityType: "MoveTask",
      entityId: id,
      changes: {
        ...(hasEvent ? { event } : {}),
        status: task.status,
        ...(assigneeUpdate ? { assignedToUserId: assigneeUpdate.assignedToUserId } : {}),
        selectedDestinationProviderId: selectedDestinationProviderId || null,
        selectedCustomProviderId: selectedCustomProviderId || null,
        localOnly: true,
      },
      ...meta,
    });
    await recordMoveTaskEvent(userId, hasEvent ? `MOVE_TASK_${event}` : "MOVE_TASK_ASSIGN", {
      moveTaskId: id,
      status: task.status,
      actionType: task.actionType,
      ...(assigneeUpdate ? { assignedToUserId: assigneeUpdate.assignedToUserId } : {}),
      selectedDestinationProviderId: selectedDestinationProviderId || null,
      selectedCustomProviderId: selectedCustomProviderId || null,
      localOnly: true,
      noExternalAutomation: true,
    });

    return NextResponse.json({
      task: shapeTask(task as any),
      metadata: {
        localOnly: true,
        noExternalAutomation: true,
      },
    });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
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

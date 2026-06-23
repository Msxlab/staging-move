import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { z } from "zod";
import { syncMoveTasksForPlans } from "@/lib/move-task-sync";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import { normalizeMovingPlanStatus } from "@locateflow/shared";
import {
  assertScopedRecordAction,
  resolveWorkspaceDataScope,
} from "@/lib/workspace-data-scope";

const MOVING_STATUS_VALUES = ["PLANNING", "IN_PROGRESS", "COMPLETED", "CANCELED"] as const;
const movingStatusSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeMovingPlanStatus(value) : value),
  z.enum(MOVING_STATUS_VALUES),
);

const movingPatchSchema = z.object({
  moveDate: z.string().optional(),
  status: movingStatusSchema.optional(),
  isTemporary: z.boolean().optional(),
  estimatedDuration: z.number().min(1).optional(),
});

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  PLANNING: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
};

// GET /api/moving/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const scope = await resolveWorkspaceDataScope(request, userId);
    const { id } = await params;
    const plan = await prisma.movingPlan.findUnique({
      where: { id },
      include: {
        fromAddress: true,
        toAddress: true,
      },
    });

    if (!plan || plan.deletedAt) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }
    assertScopedRecordAction(plan, scope, "address.view", { notFoundMessage: "Moving plan not found" });

    return NextResponse.json({ plan: { ...plan, status: normalizeMovingPlanStatus(plan.status) } });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to fetch moving plan:", error);
    return NextResponse.json({ error: "Failed to fetch moving plan" }, { status: 500 });
  }
}

// PATCH /api/moving/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireAppMutationUser();
    const scope = await resolveWorkspaceDataScope(request, userId);

    const existing = await prisma.movingPlan.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }
    assertScopedRecordAction(existing, scope, "address.edit", { notFoundMessage: "Moving plan not found" });

    const body = await request.json();
    const validated = movingPatchSchema.parse(body);

    // Enforce state machine transitions
    if (validated.status) {
      const currentStatus = normalizeMovingPlanStatus(existing.status);
      const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowedTransitions.includes(validated.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentStatus} to ${validated.status}. Allowed: ${allowedTransitions.join(", ") || "none (terminal state)"}` },
          { status: 400 }
        );
      }
    }

    const plan = await prisma.movingPlan.update({
      where: { id },
      data: {
        ...(validated.moveDate && { moveDate: new Date(validated.moveDate) }),
        ...(validated.status && { status: validated.status }),
        ...(validated.isTemporary !== undefined && { isTemporary: validated.isTemporary }),
        ...(validated.estimatedDuration !== undefined && { estimatedDuration: validated.estimatedDuration }),
      },
    });
    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "UPDATE", entityType: "MovingPlan", entityId: id, route: `/api/moving/${id}` });

    // Keep move tasks consistent with the plan's lifecycle. The global
    // move-task feed (GET /api/move-tasks with no movingPlanId filter) is NOT
    // filtered by plan status, so a terminal plan must not leave — or worse,
    // regenerate — machine-suggested tasks behind:
    //   - CANCELED: retire the plan's CLASSIFIER (suggested) tasks, mirroring
    //     the DELETE cascade, so they stop surfacing. The previous
    //     unconditional syncMoveTasksForPlans actively RE-CREATED tasks for a
    //     just-canceled move.
    //   - COMPLETED: don't spawn fresh suggestions for a finished move; leave
    //     existing tasks intact as history.
    //   - otherwise (PLANNING / IN_PROGRESS, e.g. a moveDate edit): re-sync.
    // Keyed off the effective post-update status so editing an already-canceled
    // plan can't reintroduce suggestions either. syncMoveTasksForAddress
    // already skips COMPLETED + CANCELED for the same reason.
    const effectiveStatus = normalizeMovingPlanStatus(plan.status);
    let moveTaskSync: unknown;
    if (effectiveStatus === "CANCELED") {
      const retired = await prisma.moveTask.updateMany({
        where: {
          movingPlanId: plan.id,
          ...(scope.workspaceId ? {} : { userId }),
          source: "CLASSIFIER",
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
      moveTaskSync = { retiredSuggestedTasks: retired.count };
    } else if (effectiveStatus === "COMPLETED") {
      moveTaskSync = { skipped: "plan_completed" };
    } else {
      moveTaskSync = scope.workspaceId
        ? await syncMoveTasksForPlans(userId, [plan.id], { workspaceId: scope.workspaceId })
        : await syncMoveTasksForPlans(userId, [plan.id]);
    }

    return NextResponse.json({ plan, moveTaskSync });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }
    console.error("Failed to update moving plan:", error);
    return NextResponse.json({ error: "Failed to update moving plan" }, { status: 500 });
  }
}

// DELETE /api/moving/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireAppMutationUser();
    const scope = await resolveWorkspaceDataScope(request, userId);

    const existing = await prisma.movingPlan.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }
    assertScopedRecordAction(existing, scope, "address.delete", { notFoundMessage: "Moving plan not found" });

    // Replicate the schema's MoveTask.movingPlan onDelete: Cascade, which never
    // fires for our soft deletes: soft-delete the plan's move tasks in the same
    // transaction so they stop surfacing in the global task feed once the user
    // removes the plan they belong to.
    const now = new Date();
    const [moveTasksResult] = await prisma.$transaction([
      prisma.moveTask.updateMany({
        where: { movingPlanId: id, ...(scope.workspaceId ? {} : { userId }), deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.movingPlan.update({ where: { id }, data: { deletedAt: now } }),
    ]);

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "DELETE",
      entityType: "MovingPlan",
      entityId: id,
      changes: { moveTasksDeleted: moveTasksResult.count },
      ...meta,
    });
    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "DELETE", entityType: "MovingPlan", entityId: id, route: `/api/moving/${id}` });

    return NextResponse.json({ success: true });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to delete moving plan:", error);
    return NextResponse.json({ error: "Failed to delete moving plan" }, { status: 500 });
  }
}

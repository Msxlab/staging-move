import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { z } from "zod";
import { syncMoveTasksForPlans } from "@/lib/move-task-sync";
import { normalizeMovingPlanStatus } from "@locateflow/shared";

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
    const { id } = await params;
    const plan = await prisma.movingPlan.findUnique({
      where: { id },
      include: {
        fromAddress: true,
        toAddress: true,
      },
    });

    if (!plan || plan.userId !== userId || plan.deletedAt) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }

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

    const existing = await prisma.movingPlan.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId || existing.deletedAt) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }

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

    const moveTaskSync = await syncMoveTasksForPlans(userId, [plan.id]);

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

    const existing = await prisma.movingPlan.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId || existing.deletedAt) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }

    await prisma.movingPlan.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to delete moving plan:", error);
    return NextResponse.json({ error: "Failed to delete moving plan" }, { status: 500 });
  }
}

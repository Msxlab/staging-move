import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { z } from "zod";

const movingPatchSchema = z.object({
  moveDate: z.string().optional(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "COMPLETED", "CANCELED"]).optional(),
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

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Failed to fetch moving plan:", error);
    return NextResponse.json({ error: "Failed to fetch moving plan" }, { status: 500 });
  }
}

// PATCH /api/moving/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireDbUserId();

    const existing = await prisma.movingPlan.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId || existing.deletedAt) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = movingPatchSchema.parse(body);

    // Enforce state machine transitions
    if (validated.status) {
      const currentStatus = existing.status;
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

    return NextResponse.json({ plan });
  } catch (error: any) {
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
    const userId = await requireDbUserId();

    const existing = await prisma.movingPlan.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId || existing.deletedAt) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }

    await prisma.movingPlan.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete moving plan:", error);
    return NextResponse.json({ error: "Failed to delete moving plan" }, { status: 500 });
  }
}

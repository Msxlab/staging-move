import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { z } from "zod";

const taskPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().optional(),
  completed: z.boolean().optional(),
  assignedTo: z.string().optional().nullable(),
});

// PATCH /api/tasks/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;
    const body = await request.json();
    const validated = taskPatchSchema.parse(body);

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(validated.title && { title: validated.title }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.priority && { priority: validated.priority }),
        ...(validated.dueDate && { dueDate: new Date(validated.dueDate) }),
        ...(validated.completed !== undefined && {
          completed: validated.completed,
          completedAt: validated.completed ? new Date() : null,
        }),
        ...(validated.assignedTo !== undefined && { assignedTo: validated.assignedTo }),
      },
    });

    // Update MovingPlan counter when task completion changes
    if (validated.completed !== undefined && task.movingPlanId) {
      try {
        const completedCount = await prisma.task.count({
          where: { movingPlanId: task.movingPlanId, completed: true },
        });
        const totalCount = await prisma.task.count({
          where: { movingPlanId: task.movingPlanId },
        });
        const updateData: any = { completedTasks: completedCount };
        // Auto-complete plan when all tasks are done
        if (completedCount >= totalCount && totalCount > 0) {
          updateData.status = "COMPLETED";
        }
        await prisma.movingPlan.update({
          where: { id: task.movingPlanId },
          data: updateData,
        });
      } catch (counterErr) {
        console.error("MovingPlan counter update failed (non-blocking):", counterErr);
      }
    }

    return NextResponse.json({ task });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

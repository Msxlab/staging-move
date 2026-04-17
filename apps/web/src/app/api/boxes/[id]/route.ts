import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { z } from "zod";

const boxPatchSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  room: z.string().max(100).optional(),
  contents: z.string().max(500).optional(),
  isFragile: z.boolean().optional(),
  isPacked: z.boolean().optional(),
});

// PATCH /api/boxes/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireDbUserId();
    const body = await request.json();
    const validated = boxPatchSchema.parse(body);

    const existing = await prisma.movingBox.findUnique({
      where: { id },
      include: { movingPlan: { select: { userId: true } } },
    });
    if (!existing || existing.movingPlan.userId !== userId) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    const box = await prisma.movingBox.update({
      where: { id },
      data: {
        ...(validated.label && { label: validated.label }),
        ...(validated.room !== undefined && { room: validated.room }),
        ...(validated.contents !== undefined && { contents: validated.contents }),
        ...(validated.isFragile !== undefined && { isFragile: validated.isFragile }),
        ...(validated.isPacked !== undefined && {
          isPacked: validated.isPacked,
          packedAt: validated.isPacked ? new Date() : null,
        }),
      },
    });

    return NextResponse.json({ box });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to update box:", error);
    return NextResponse.json({ error: "Failed to update box" }, { status: 500 });
  }
}

// DELETE /api/boxes/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await requireDbUserId();

    const existing = await prisma.movingBox.findUnique({
      where: { id },
      include: { movingPlan: { select: { userId: true } } },
    });
    if (!existing || existing.movingPlan.userId !== userId) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    await prisma.movingBox.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }
    console.error("Failed to delete box:", error);
    return NextResponse.json({ error: "Failed to delete box" }, { status: 500 });
  }
}

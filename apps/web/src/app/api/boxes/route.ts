import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const boxCreateSchema = z.object({
  movingPlanId: z.string().min(1),
  boxNumber: z.number().int().min(1),
  label: z.string().min(1).max(100),
  room: z.string().max(100).optional().default(""),
  contents: z.string().max(500).optional().default(""),
  isFragile: z.boolean().optional().default(false),
});

// POST /api/boxes
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // Rate limit: 30 writes per minute
    const rlKey = getRateLimitKey(request, "box:create");
    const rl = await rateLimit(rlKey, { limit: 30, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json();
    const validated = boxCreateSchema.parse(body);

    // Verify ownership of the moving plan
    const plan = await prisma.movingPlan.findUnique({ where: { id: validated.movingPlanId } });
    if (!plan || plan.userId !== userId) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }

    const box = await prisma.movingBox.create({
      data: {
        movingPlanId: validated.movingPlanId,
        boxNumber: validated.boxNumber,
        label: validated.label,
        room: validated.room || "",
        contents: validated.contents || "",
        isFragile: validated.isFragile || false,
        qrCode: crypto.randomUUID(),
      },
    });

    return NextResponse.json({ box }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create box:", error);
    return NextResponse.json({ error: "Failed to create box" }, { status: 500 });
  }
}

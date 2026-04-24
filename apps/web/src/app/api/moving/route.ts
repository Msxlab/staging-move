import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { movingPlanSchema } from "@/lib/validators";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { canCreateAddress, canCreateMovingPlan } from "@/lib/plan-limits";
import { encrypt } from "@/lib/shared-encryption";
import { syncMoveTasksForPlans } from "@/lib/move-task-sync";

function normalizeAddressValue(value?: string | null) {
  return (value || "").trim().toUpperCase();
}

function addressesMatch(
  left: { street: string; city: string; state: string; zip: string },
  right: { street: string; city: string; state: string; zip: string }
) {
  return normalizeAddressValue(left.street) === normalizeAddressValue(right.street)
    && normalizeAddressValue(left.city) === normalizeAddressValue(right.city)
    && normalizeAddressValue(left.state) === normalizeAddressValue(right.state)
    && normalizeAddressValue(left.zip) === normalizeAddressValue(right.zip);
}

// GET /api/moving
export async function GET() {
  try {
    const userId = await requireDbUserId();
    const plans = await prisma.movingPlan.findMany({
      where: { userId, deletedAt: null },
      include: {
        fromAddress: { select: { street: true, city: true, state: true, zip: true } },
        toAddress: { select: { street: true, city: true, state: true, zip: true } },
      },
      orderBy: { moveDate: "desc" },
    });
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Failed to fetch moving plans:", error);
    return NextResponse.json({ error: "Failed to fetch moving plans" }, { status: 500 });
  }
}

// POST /api/moving
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // Rate limit: 10 plans per minute
    const rlKey = getRateLimitKey(request, "moving:create");
    const rl = await rateLimit(rlKey, { limit: 10, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json();
    const validated = movingPlanSchema.parse(body);
    const needsNewDestinationAddress = Boolean(validated.destinationAddress);

    // Plan limit check
    const limitCheck = await canCreateMovingPlan(userId);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 403 });
    }
    if (needsNewDestinationAddress) {
      const addressLimitCheck = await canCreateAddress(userId);
      if (!addressLimitCheck.allowed) {
        return NextResponse.json({ error: addressLimitCheck.reason }, { status: 403 });
      }
    }

    // Prevent same-address moving plan
    if (validated.fromAddressId === validated.toAddressId) {
      return NextResponse.json({ error: "Origin and destination addresses cannot be the same" }, { status: 400 });
    }

    const fromAddress = await prisma.address.findUnique({ where: { id: validated.fromAddressId } });
    if (!fromAddress || fromAddress.userId !== userId || fromAddress.deletedAt) {
      return NextResponse.json({ error: "Origin address not found" }, { status: 404 });
    }

    let toAddress: { id?: string; street: string; city: string; state: string; zip: string } | null = null;
    if (validated.toAddressId) {
      const existingDestination = await prisma.address.findUnique({ where: { id: validated.toAddressId } });
      if (!existingDestination || existingDestination.userId !== userId || existingDestination.deletedAt) {
        return NextResponse.json({ error: "Destination address not found" }, { status: 404 });
      }
      if (addressesMatch(fromAddress, existingDestination)) {
        return NextResponse.json({ error: "Origin and destination addresses cannot be the same" }, { status: 400 });
      }
      toAddress = existingDestination;
    } else if (validated.destinationAddress) {
      if (addressesMatch(fromAddress, validated.destinationAddress)) {
        return NextResponse.json({ error: "Origin and destination addresses cannot be the same" }, { status: 400 });
      }
      toAddress = {
        street: validated.destinationAddress.street,
        city: validated.destinationAddress.city,
        state: validated.destinationAddress.state,
        zip: validated.destinationAddress.zip,
      };
    }

    if (!toAddress) {
      return NextResponse.json({ error: "Destination address not found" }, { status: 404 });
    }

    const { plan, destinationAddressId } = await prisma.$transaction(async (tx: any) => {
      let destinationAddressId = validated.toAddressId;

      if (!destinationAddressId && validated.destinationAddress) {
        const destinationAddress = await tx.address.create({
          data: {
            ...validated.destinationAddress,
            formattedAddress: validated.destinationAddress.formattedAddress
              ? encrypt(validated.destinationAddress.formattedAddress)
              : validated.destinationAddress.formattedAddress,
            isPrimary: false,
            userId,
            startDate: new Date(validated.destinationAddress.startDate),
            endDate: validated.destinationAddress.endDate ? new Date(validated.destinationAddress.endDate) : undefined,
          },
        });
        destinationAddressId = destinationAddress.id;
      }

      if (!destinationAddressId) {
        throw new Error("Destination address could not be created");
      }

      const created = await tx.movingPlan.create({
        data: {
          userId,
          fromAddressId: validated.fromAddressId,
          toAddressId: destinationAddressId,
          moveDate: new Date(validated.moveDate),
          isTemporary: validated.isTemporary,
          estimatedDuration: validated.estimatedDuration,
        },
      });

      return { plan: created, destinationAddressId };
    });

    const moveTaskSync = await syncMoveTasksForPlans(userId, [plan.id]);

    return NextResponse.json({ plan, destinationAddressId, moveTaskSync }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (typeof error?.message === "string" && error.message.startsWith("AUTH_NOT_CONFIGURED")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error("Failed to create moving plan:", error);
    const details = process.env.NODE_ENV !== "production" && typeof error?.message === "string"
      ? error.message
      : undefined;
    return NextResponse.json(
      details ? { error: "Failed to create moving plan", details } : { error: "Failed to create moving plan" },
      { status: 500 },
    );
  }
}

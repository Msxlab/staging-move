import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { addressSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { decrypt, encrypt } from "@/lib/shared-encryption";
import { syncMoveTasksForAddress } from "@/lib/move-task-sync";

// GET /api/addresses/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;
    const address = await prisma.address.findUnique({
      where: { id },
      include: {
        services: true,
        budgets: true,
      },
    });

    if (!address || address.userId !== userId || address.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    return NextResponse.json({
      address: {
        ...address,
        formattedAddress: address.formattedAddress ? decrypt(address.formattedAddress) : address.formattedAddress,
      },
    });
  } catch (error) {
    console.error("Failed to fetch address:", error);
    return NextResponse.json({ error: "Failed to fetch address" }, { status: 500 });
  }
}

// PATCH /api/addresses/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId || existing.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = addressSchema.partial().parse(body);

    // If setting as primary, unset all other primary addresses for this user
    if (validated.isPrimary) {
      await prisma.address.updateMany({
        where: { userId, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    }

    const address = await prisma.address.update({
      where: { id },
      data: {
        ...validated,
        ...(validated.formattedAddress !== undefined && {
          formattedAddress: validated.formattedAddress ? encrypt(validated.formattedAddress) : validated.formattedAddress,
        }),
        startDate: validated.startDate ? new Date(validated.startDate) : undefined,
        endDate: validated.endDate ? new Date(validated.endDate) : undefined,
      },
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({ userId, action: "UPDATE", entityType: "Address", entityId: id, changes: validated, ...meta });

    const moveTaskSync = await syncMoveTasksForAddress(userId, id);

    return NextResponse.json({
      address: {
        ...address,
        formattedAddress: address.formattedAddress ? decrypt(address.formattedAddress) : address.formattedAddress,
      },
      moveTaskSync,
    });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    console.error("Failed to update address:", error);
    return NextResponse.json({ error: "Failed to update address" }, { status: 500 });
  }
}

// DELETE /api/addresses/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId || existing.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    await prisma.address.update({ where: { id }, data: { deletedAt: new Date() } });

    const meta = extractRequestMeta(request);
    await createAuditLog({ userId, action: "DELETE", entityType: "Address", entityId: id, changes: { nickname: existing.nickname }, ...meta });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    console.error("Failed to delete address:", error);
    return NextResponse.json({ error: "Failed to delete address" }, { status: 500 });
  }
}

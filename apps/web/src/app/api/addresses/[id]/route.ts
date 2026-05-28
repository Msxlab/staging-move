import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { addressSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { decrypt, encrypt } from "@/lib/shared-encryption";
import { syncMoveTasksForAddress } from "@/lib/move-task-sync";
import { activeTrackedServiceWhere } from "@/lib/service-active";
import { decryptServiceSensitiveFields } from "@/lib/service-sensitive-fields";

// GET /api/addresses/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;
    const address = await prisma.address.findUnique({
      where: { id },
      include: {
        services: {
          where: activeTrackedServiceWhere(userId),
          include: {
            provider: { select: { id: true, name: true, logoUrl: true } },
            customProvider: { select: { id: true, name: true, category: true, website: true, phone: true, email: true, providerType: true, trustStatus: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        budgets: true,
      },
    });

    if (!address || address.userId !== userId || address.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    return NextResponse.json({
      address: {
        ...address,
        services: address.services.map((service: any) => decryptServiceSensitiveFields(service)),
        formattedAddress: address.formattedAddress ? decrypt(address.formattedAddress) : address.formattedAddress,
      },
    });
  } catch (error) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to fetch address:", error);
    return NextResponse.json({ error: "Failed to fetch address" }, { status: 500 });
  }
}

// PATCH /api/addresses/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAppMutationUser();
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
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
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
    const userId = await requireAppMutationUser();
    const { id } = await params;

    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId || existing.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    // Cascade the soft-delete to the address's services AND budgets in one
    // transaction. The schema's onDelete: SetNull never fires for our soft
    // deletes, so without this the services keep isActive=true and the budgets
    // keep deletedAt=null, both surfacing in their list endpoints while
    // pointing at an address the user just removed.
    const now = new Date();
    const [servicesResult, budgetsResult] = await prisma.$transaction([
      prisma.service.updateMany({
        where: { addressId: id, userId, deletedAt: null },
        data: { isActive: false, deactivatedAt: now, deletedAt: now },
      }),
      prisma.budget.updateMany({
        where: { addressId: id, userId, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.address.update({ where: { id }, data: { deletedAt: now } }),
    ]);

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "DELETE",
      entityType: "Address",
      entityId: id,
      changes: {
        nickname: existing.nickname,
        servicesDeactivated: servicesResult.count,
        budgetsDeleted: budgetsResult.count,
      },
      ...meta,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    console.error("Failed to delete address:", error);
    return NextResponse.json({ error: "Failed to delete address" }, { status: 500 });
  }
}

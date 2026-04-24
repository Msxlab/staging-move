import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { serviceSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { encrypt, decrypt } from "@/lib/shared-encryption";

// GET /api/services/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        address: true,
        reminders: true,
        provider: { select: { id: true, name: true, slug: true, website: true, phone: true, scope: true } },
        customProvider: { select: { id: true, name: true, category: true, phone: true, website: true, email: true, providerType: true, trustStatus: true } },
      },
    });

    if (!service || service.userId !== userId || service.deletedAt) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Decrypt sensitive fields
    const decrypted = {
      ...service,
      accountNumber: service.accountNumber ? decrypt(service.accountNumber) : service.accountNumber,
      username: service.username ? decrypt(service.username) : service.username,
      phone: (service as any).phone ? decrypt((service as any).phone) : (service as any).phone,
      notes: (service as any).notes ? decrypt((service as any).notes) : (service as any).notes,
    };

    return NextResponse.json({ service: decrypted });
  } catch (error) {
    console.error("Failed to fetch service:", error);
    return NextResponse.json({ error: "Failed to fetch service" }, { status: 500 });
  }
}

// PATCH /api/services/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.deletedAt || existing.userId !== userId) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = serviceSchema.partial().parse(body);

    if (validated.providerId && validated.customProviderId) {
      return NextResponse.json({ error: "Choose either a listed provider or a custom provider, not both" }, { status: 400 });
    }

    if (validated.addressId) {
      const address = await prisma.address.findUnique({ where: { id: validated.addressId } });
      if (!address || address.userId !== userId) {
        return NextResponse.json({ error: "Address not found" }, { status: 404 });
      }
    }

    if (validated.providerId) {
      const provider = await prisma.serviceProvider.findUnique({ where: { id: validated.providerId } });
      if (!provider || provider.deletedAt) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 });
      }
    }

    if (validated.customProviderId) {
      const customProvider = await prisma.userCustomProvider.findFirst({
        where: { id: validated.customProviderId, userId, deletedAt: null },
      });
      if (!customProvider) {
        return NextResponse.json({ error: "Custom provider not found" }, { status: 404 });
      }
    }

    // Encrypt sensitive fields if provided
    const encryptedData = {
      ...validated,
      ...(validated.accountNumber !== undefined && { accountNumber: validated.accountNumber ? encrypt(validated.accountNumber) : validated.accountNumber }),
      ...(validated.username !== undefined && { username: validated.username ? encrypt(validated.username) : validated.username }),
      ...((validated as any).phone !== undefined && { phone: (validated as any).phone ? encrypt((validated as any).phone) : (validated as any).phone }),
      ...((validated as any).notes !== undefined && { notes: (validated as any).notes ? encrypt((validated as any).notes) : (validated as any).notes }),
    };

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...encryptedData,
        contractEndDate: validated.contractEndDate ? new Date(validated.contractEndDate) : undefined,
      },
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({ userId, action: "UPDATE", entityType: "Service", entityId: id, changes: validated, ...meta });

    return NextResponse.json({ service });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    console.error("Failed to update service:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

// DELETE /api/services/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing || existing.deletedAt || existing.userId !== userId) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    await prisma.service.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });

    if (existing.providerId && existing.isActive) {
      try {
        await prisma.serviceProvider.update({
          where: { id: existing.providerId },
          data: { userCount: { decrement: 1 } },
        });
      } catch (statsErr) {
        console.error("Provider stats decrement failed (non-blocking):", statsErr);
      }
    }

    const meta = extractRequestMeta(request);
    await createAuditLog({ userId, action: "DELETE", entityType: "Service", entityId: id, changes: { provider: existing.providerName }, ...meta });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    console.error("Failed to delete service:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}

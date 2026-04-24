import { NextRequest, NextResponse } from "next/server";
import { getProviderTrustPresentation } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { customProviderSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";

function cleanText(value: string | undefined): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  return trimmed.replace(/[<>]/g, "");
}

function normalizeState(value: string | undefined): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.toUpperCase() : null;
}

function presentCustomProvider(provider: any) {
  return {
    ...provider,
    trust: getProviderTrustPresentation("USER_CUSTOM"),
    manualTrackingOnly: true,
    availabilityCaveat:
      "This is your private provider record. Confirm details directly with the provider.",
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;
    const provider = await prisma.userCustomProvider.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        linkedServiceProvider: { select: { id: true, name: true, slug: true, category: true } },
        services: { where: { deletedAt: null }, select: { id: true, providerName: true, category: true, addressId: true, isActive: true } },
      },
    });

    if (!provider) {
      return NextResponse.json({ error: "Custom provider not found" }, { status: 404 });
    }

    return NextResponse.json({ provider: presentCustomProvider(provider) });
  } catch (error) {
    console.error("Failed to fetch custom provider:", error);
    return NextResponse.json({ error: "Failed to fetch custom provider" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;
    const existing = await prisma.userCustomProvider.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Custom provider not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = customProviderSchema.partial().parse(body);

    const provider = await prisma.userCustomProvider.update({
      where: { id },
      data: {
        ...(validated.name !== undefined && { name: cleanText(validated.name)! }),
        ...(validated.category !== undefined && { category: cleanText(validated.category)! }),
        ...(validated.description !== undefined && { description: cleanText(validated.description) }),
        ...(validated.website !== undefined && { website: cleanText(validated.website) }),
        ...(validated.phone !== undefined && { phone: cleanText(validated.phone) }),
        ...(validated.email !== undefined && { email: cleanText(validated.email) }),
        ...(validated.addressLine1 !== undefined && { addressLine1: cleanText(validated.addressLine1) }),
        ...(validated.addressLine2 !== undefined && { addressLine2: cleanText(validated.addressLine2) }),
        ...(validated.city !== undefined && { city: cleanText(validated.city) }),
        ...(validated.state !== undefined && { state: normalizeState(validated.state) }),
        ...(validated.zipCode !== undefined && { zipCode: cleanText(validated.zipCode) }),
        ...(validated.notes !== undefined && { notes: cleanText(validated.notes) }),
        ...(validated.providerType !== undefined && { providerType: validated.providerType }),
        adminReviewStatus:
          existing.adminReviewStatus === "REVIEWED"
            ? "NEEDS_REVIEW"
            : existing.adminReviewStatus,
      },
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "UPDATE",
      entityType: "UserCustomProvider",
      entityId: provider.id,
      changes: { updatedFields: Object.keys(validated) },
      ...meta,
    });

    return NextResponse.json({ provider: presentCustomProvider(provider) });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to update custom provider:", error);
    return NextResponse.json({ error: "Failed to update custom provider" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;
    const existing = await prisma.userCustomProvider.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Custom provider not found" }, { status: 404 });
    }

    await prisma.userCustomProvider.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "DELETE",
      entityType: "UserCustomProvider",
      entityId: id,
      changes: { name: existing.name, category: existing.category },
      ...meta,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete custom provider:", error);
    return NextResponse.json({ error: "Failed to delete custom provider" }, { status: 500 });
  }
}

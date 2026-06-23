import { NextRequest, NextResponse } from "next/server";
import { getProviderTrustPresentation } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { customProviderSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import {
  findDuplicateCustomProvider,
  findListedProviderNameConflict,
} from "@/lib/custom-provider-duplicate-guard";

function cleanText(value: string | undefined): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  return trimmed.replace(/[<>]/g, "");
}

function normalizeState(value: string | undefined): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.toUpperCase() : null;
}

function cleanCategory(value: string | undefined): string {
  return (cleanText(value) || "OTHER").toUpperCase();
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
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to fetch custom provider:", error);
    return NextResponse.json({ error: "Failed to fetch custom provider" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAppMutationUser();
    const rlKey = getRateLimitKey(request, "custom-provider:update", { userId });
    const rl = await rateLimit(rlKey, { limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }
    const { id } = await params;
    const existing = await prisma.userCustomProvider.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Custom provider not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = customProviderSchema.partial().parse(body);
    const nextName = validated.name !== undefined ? cleanText(validated.name)! : existing.name;
    const nextCategory = validated.category !== undefined ? cleanCategory(validated.category) : existing.category;

    if (validated.name !== undefined || validated.category !== undefined) {
      const duplicate = await findDuplicateCustomProvider(prisma, {
        userId,
        name: nextName,
        category: nextCategory,
        ignoreCustomProviderId: existing.id,
      });
      if (duplicate) {
        return NextResponse.json(
          {
            error: "You already have a private provider with this name and category.",
            existingProviderId: duplicate.id,
          },
          { status: 409 },
        );
      }

      const listedConflict = await findListedProviderNameConflict(prisma, {
        name: nextName,
        category: nextCategory,
      });
      if (listedConflict) {
        return NextResponse.json(
          {
            error: "A listed provider already matches this name and category. Add the listed provider instead, or use a more specific private provider name.",
            listedProviderId: listedConflict.id,
            listedProviderSlug: listedConflict.slug,
          },
          { status: 409 },
        );
      }
    }

    const provider = await prisma.userCustomProvider.update({
      where: { id },
      data: {
        ...(validated.name !== undefined && { name: nextName }),
        ...(validated.category !== undefined && { category: nextCategory }),
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

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "UPDATE", entityType: "UserCustomProvider", entityId: provider.id, route: "/api/custom-providers/[id]" });

    return NextResponse.json({ provider: presentCustomProvider(provider) });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to update custom provider:", error);
    return NextResponse.json({ error: "Failed to update custom provider" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAppMutationUser();
    const rlKey = getRateLimitKey(request, "custom-provider:delete", { userId });
    const rl = await rateLimit(rlKey, { limit: 30, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }
    const { id } = await params;
    const existing = await prisma.userCustomProvider.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Custom provider not found" }, { status: 404 });
    }

    // Replicate the schema's onDelete: SetNull, which never fires for our soft
    // deletes: detach the user's services and move tasks from this provider in
    // the same transaction so they stop rendering a record the user just
    // removed. The rows survive (services keep their denormalized providerName).
    const now = new Date();
    const [servicesResult, moveTasksResult] = await prisma.$transaction([
      prisma.service.updateMany({
        where: { customProviderId: id, userId, deletedAt: null },
        data: { customProviderId: null },
      }),
      prisma.moveTask.updateMany({
        where: { customProviderId: id, userId, deletedAt: null },
        data: { customProviderId: null },
      }),
      prisma.userCustomProvider.update({
        where: { id },
        data: { deletedAt: now },
      }),
    ]);

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "DELETE",
      entityType: "UserCustomProvider",
      entityId: id,
      changes: {
        name: existing.name,
        category: existing.category,
        servicesDetached: servicesResult.count,
        moveTasksDetached: moveTasksResult.count,
      },
      ...meta,
    });

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "DELETE", entityType: "UserCustomProvider", entityId: id, route: "/api/custom-providers/[id]" });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to delete custom provider:", error);
    return NextResponse.json({ error: "Failed to delete custom provider" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import {
  rebuildProviderCoverage,
  updateWithVersion,
  isOptimisticLockError,
} from "@locateflow/db";
import { findProviderConflicts, normalizeProviderRecord } from "@locateflow/shared";

function getConflictMessage(conflictType: string, name: string, slug: string) {
  if (conflictType === "slug") {
    return `Provider slug already exists: ${slug}`;
  }
  if (conflictType === "website-category") {
    return `Provider website already exists in this category: ${name}`;
  }
  return `Provider already exists in this category: ${name}`;
}

function buildNormalizedCandidate(existing: any, patch: Record<string, unknown>) {
  return normalizeProviderRecord({
    id: existing.id,
    name: typeof patch.name === "string" ? patch.name.trim() : existing.name,
    slug: typeof patch.slug === "string" && patch.slug.trim() ? patch.slug.trim() : existing.slug,
    category: typeof patch.category === "string" ? patch.category.trim().toUpperCase() : existing.category,
    subCategory: patch.subCategory !== undefined
      ? (typeof patch.subCategory === "string" && patch.subCategory.trim() ? patch.subCategory.trim() : null)
      : existing.subCategory,
    description: patch.description !== undefined
      ? (typeof patch.description === "string" && patch.description.trim() ? patch.description.trim() : null)
      : existing.description,
    website: patch.website !== undefined
      ? (typeof patch.website === "string" && patch.website.trim() ? patch.website.trim() : null)
      : existing.website,
    phone: patch.phone !== undefined
      ? (typeof patch.phone === "string" && patch.phone.trim() ? patch.phone.trim() : null)
      : existing.phone,
    logoUrl: patch.logoUrl !== undefined
      ? (typeof patch.logoUrl === "string" && patch.logoUrl.trim() ? patch.logoUrl.trim() : null)
      : existing.logoUrl,
    scope: typeof patch.scope === "string" ? patch.scope : existing.scope,
    states: patch.states !== undefined ? patch.states as string[] | string | null : existing.states,
    zipCodes: patch.zipCodes !== undefined ? patch.zipCodes as string[] | string | null : existing.zipCodes,
    tags: patch.tags !== undefined ? patch.tags as string[] | string | null : existing.tags,
    popularityScore: patch.popularityScore !== undefined ? Number(patch.popularityScore) || 0 : existing.popularityScore,
    isActive: patch.isActive !== undefined ? patch.isActive !== "false" && patch.isActive !== false : existing.isActive,
    displayOrder: patch.displayOrder !== undefined ? Number(patch.displayOrder) || 0 : existing.displayOrder,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;

    const provider = await prisma.serviceProvider.findUnique({ where: { id } });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({ provider });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch provider" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("providers", "canUpdate", { minimumRole: "MODERATOR" });
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.serviceProvider.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const normalized = buildNormalizedCandidate(existing, body);
    const comparableProviders = await prisma.serviceProvider.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        website: true,
      },
    });
    const conflicts = findProviderConflicts(comparableProviders, normalized, { ignoreId: id });
    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      return NextResponse.json(
        { error: getConflictMessage(firstConflict.type, firstConflict.existingName, firstConflict.existingSlug) },
        { status: 409 }
      );
    }

    const updateData: any = {};
    const scalarFields = [
      "name",
      "slug",
      "category",
      "subCategory",
      "description",
      "website",
      "phone",
      "logoUrl",
      "scope",
      "popularityScore",
      "isActive",
      "displayOrder",
    ] as const;

    for (const field of scalarFields) {
      if (body[field] === undefined) continue;
      updateData[field] = normalized[field];
    }

    const coverageChanged =
      body.states !== undefined || body.zipCodes !== undefined || body.scope !== undefined;

    if (body.states !== undefined) updateData.states = JSON.stringify(normalized.states);
    if (body.zipCodes !== undefined) updateData.zipCodes = JSON.stringify(normalized.zipCodes);
    if (body.tags !== undefined) updateData.tags = JSON.stringify(normalized.tags);

    // Optimistic concurrency: admins editing the same provider in two
    // tabs at the same time must NOT silently last-write-wins. The
    // client passes `version` (the integer it read); we compare-and-swap
    // and throw OptimisticLockError on mismatch. Clients surface that as
    // a 409 and prompt the operator to re-read and re-apply.
    const expectedVersion =
      typeof body.version === "number" ? body.version : existing.version;

    const provider = await prisma.$transaction(async (tx) => {
      await updateWithVersion(
        tx.serviceProvider,
        { id, version: expectedVersion },
        updateData,
      );
      if (coverageChanged) {
        await rebuildProviderCoverage(tx, {
          providerId: id,
          scope: normalized.scope,
          states: normalized.states,
          zipCodes: normalized.zipCodes,
        });
      }
      return tx.serviceProvider.findUnique({ where: { id } });
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE_PROVIDER",
        entityType: "ServiceProvider",
        entityId: id,
        changes: JSON.stringify(updateData),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    revalidateTag("providers", "default");

    return NextResponse.json({ provider });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isOptimisticLockError(error)) {
      return NextResponse.json(
        {
          error:
            "This provider was modified by another admin while you were editing. Refresh to load the latest version and re-apply your changes.",
          code: "OPTIMISTIC_LOCK_CONFLICT",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to update provider" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("providers", "canDelete", { minimumRole: "ADMIN" });
    const { id } = await params;

    // Step-up auth: provider deletion is destructive and affects user matches.
    let confirmPassword: string | undefined;
    try {
      const body = await request.json();
      confirmPassword = body?.confirmPassword;
    } catch {
      /* no body is fine — password will be required and the 403 response tells the client */
    }
    const confirm = await requirePasswordConfirm(session, confirmPassword);
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true },
        { status: 403 },
      );
    }

    const provider = await prisma.serviceProvider.findUnique({ where: { id } });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    await prisma.serviceProvider.delete({ where: { id } });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "DELETE_PROVIDER",
        entityType: "ServiceProvider",
        entityId: id,
        changes: JSON.stringify({ name: provider.name }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    revalidateTag("providers", "default");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to delete provider" }, { status: 500 });
  }
}

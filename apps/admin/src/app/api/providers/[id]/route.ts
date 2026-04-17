import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { rebuildProviderCoverage } from "@locateflow/db";

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
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

    const updateData: any = {};
    const fields = ["name", "slug", "category", "subCategory", "description", "website", "phone", "logoUrl", "scope", "popularityScore", "isActive", "displayOrder"];
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const coverageChanged =
      body.states !== undefined || body.zipCodes !== undefined || body.scope !== undefined;
    const nextStates = body.states !== undefined ? parseArray(body.states) : parseArray(existing.states);
    const nextZipCodes = body.zipCodes !== undefined ? parseArray(body.zipCodes) : parseArray(existing.zipCodes);
    const nextScope = body.scope !== undefined ? body.scope : existing.scope;

    if (body.states !== undefined) updateData.states = JSON.stringify(nextStates);
    if (body.zipCodes !== undefined) updateData.zipCodes = JSON.stringify(nextZipCodes);
    if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);

    const provider = await prisma.$transaction(async (tx) => {
      const prov = await tx.serviceProvider.update({
        where: { id },
        data: updateData,
      });
      if (coverageChanged) {
        await rebuildProviderCoverage(tx, {
          providerId: id,
          scope: nextScope,
          states: nextStates,
          zipCodes: nextZipCodes,
        });
      }
      return prov;
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

    revalidateTag("providers");

    return NextResponse.json({ provider });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    revalidateTag("providers");

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

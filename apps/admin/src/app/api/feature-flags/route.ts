export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const flags = await prisma.featureFlag.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ flags });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canCreate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { name, description, enabled, targetType, targetValue, confirmPassword } = await req.json();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const confirm = await requirePasswordConfirm(session, confirmPassword, { operation: "feature_flag_write" });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const existing = await prisma.featureFlag.findUnique({ where: { name } });
    if (existing) return NextResponse.json({ error: "Flag already exists" }, { status: 409 });

    const flag = await prisma.featureFlag.create({
      data: { name, description, enabled: enabled ?? false, targetType: targetType || "ALL", targetValue: targetValue ? JSON.stringify(targetValue) : null, createdBy: session.adminId },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE_FEATURE_FLAG",
        entityType: "FeatureFlag",
        entityId: flag.id,
        changes: JSON.stringify({
          name: flag.name,
          enabled: flag.enabled,
          targetType: flag.targetType,
        }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json(flag);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { id, enabled, description, targetType, targetValue, confirmPassword } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const confirm = await requirePasswordConfirm(session, confirmPassword, { operation: "feature_flag_write" });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }
    const existing = await prisma.featureFlag.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

    const flag = await prisma.featureFlag.update({
      where: { id },
      data: { enabled, description, targetType, targetValue: targetValue ? JSON.stringify(targetValue) : undefined, updatedBy: session.adminId },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE_FEATURE_FLAG",
        entityType: "FeatureFlag",
        entityId: flag.id,
        changes: JSON.stringify({
          before: {
            enabled: existing.enabled,
            description: existing.description,
            targetType: existing.targetType,
          },
          after: {
            enabled: flag.enabled,
            description: flag.description,
            targetType: flag.targetType,
          },
        }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json(flag);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canDelete", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { id, confirmPassword } = await req.json();
    const confirm = await requirePasswordConfirm(session, confirmPassword, { operation: "feature_flag_write" });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }
    const existing = await prisma.featureFlag.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    await prisma.featureFlag.delete({ where: { id } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "DELETE_FEATURE_FLAG",
        entityType: "FeatureFlag",
        entityId: id,
        changes: JSON.stringify({
          name: existing.name,
          enabled: existing.enabled,
          targetType: existing.targetType,
        }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

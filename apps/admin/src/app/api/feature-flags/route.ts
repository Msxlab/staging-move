export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

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
    const { name, description, enabled, targetType, targetValue } = await req.json();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const existing = await prisma.featureFlag.findUnique({ where: { name } });
    if (existing) return NextResponse.json({ error: "Flag already exists" }, { status: 409 });

    const flag = await prisma.featureFlag.create({
      data: { name, description, enabled: enabled ?? false, targetType: targetType || "ALL", targetValue: targetValue ? JSON.stringify(targetValue) : null, createdBy: session.adminId },
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
    const { id, enabled, description, targetType, targetValue } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const flag = await prisma.featureFlag.update({
      where: { id },
      data: { enabled, description, targetType, targetValue: targetValue ? JSON.stringify(targetValue) : undefined, updatedBy: session.adminId },
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
    await requirePermission("settings", "canDelete", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { id } = await req.json();
    await prisma.featureFlag.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

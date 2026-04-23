export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const templates = await prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { emailLogs: true } } } });
    const logs = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { template: { select: { name: true, slug: true } } } });
    const stats = {
      totalTemplates: templates.length,
      activeTemplates: templates.filter((t: any) => t.isActive).length,
      totalSent: await prisma.emailLog.count({ where: { status: "SENT" } }),
      totalFailed: await prisma.emailLog.count({ where: { status: "FAILED" } }),
    };
    return NextResponse.json({ templates, logs, stats });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canCreate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { slug, name, subject, body, category, variables, isActive } = await req.json();
    if (!slug || !name || !subject || !body) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const existing = await prisma.emailTemplate.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });

    const template = await prisma.emailTemplate.create({
      data: { slug, name, subject, body, category: category || "SYSTEM", variables: variables ? JSON.stringify(variables) : null, isActive: isActive ?? true, createdBy: session.adminId },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE_EMAIL_TEMPLATE",
        entityType: "EmailTemplate",
        entityId: template.id,
        changes: JSON.stringify({ slug: template.slug, name: template.name, isActive: template.isActive }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json(template);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { id, name, subject, body, category, variables, isActive } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: { name, subject, body, category, variables: variables ? JSON.stringify(variables) : undefined, isActive, updatedBy: session.adminId },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE_EMAIL_TEMPLATE",
        entityType: "EmailTemplate",
        entityId: template.id,
        changes: JSON.stringify({
          before: { name: existing.name, subject: existing.subject, isActive: existing.isActive },
          after: { name: template.name, subject: template.subject, isActive: template.isActive },
        }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json(template);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canDelete", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { id } = await req.json();
    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    await prisma.emailTemplate.delete({ where: { id } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "DELETE_EMAIL_TEMPLATE",
        entityType: "EmailTemplate",
        entityId: id,
        changes: JSON.stringify({ slug: existing.slug, name: existing.name }),
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

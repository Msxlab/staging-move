export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { maskEmail } from "@/lib/privacy";

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function emailDomain(email: string | null | undefined) {
  if (!email || !email.includes("@")) return null;
  return email.split("@").pop() || null;
}

function isConfigFailure(log: { error?: string | null; metadata?: string | null }) {
  const metadata = parseMetadata(log.metadata);
  if (metadata.configError === true) return true;
  return /RESEND_API_KEY|EMAIL_FROM|NEXT_PUBLIC_APP_URL|SUPPORT_EMAIL|EMAIL_REPLY_TO|missing|invalid/i.test(log.error || "");
}

function safeEmailError(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/\bre_[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .slice(0, 500);
}

const REQUIRED_TEMPLATE_SLUGS = new Set([
  "email-verify",
  "password-reset",
  "welcome",
  "bill-reminder",
  "weekly-digest",
  "contract-reminder",
  "subscription-activated",
  "subscription-canceled",
  "payment-failed",
]);

function isRequiredEmailTemplate(template: { slug?: string | null; isDefault?: boolean | null }) {
  const slug = template.slug || "";
  return Boolean(template.isDefault) || REQUIRED_TEMPLATE_SLUGS.has(slug) || slug.startsWith("security-");
}

function presentEmailLog(log: any) {
  const metadata = parseMetadata(log.metadata);
  const configError = isConfigFailure(log);
  const error = safeEmailError(log.error);
  const resendApiError = Boolean(metadata.resendApiError === true || (log.status === "FAILED" && error && !configError));
  return {
    id: log.id,
    to: maskEmail(log.to),
    toDomain: emailDomain(log.to),
    subject: log.subject,
    status: log.status,
    error,
    safeErrorReason: error,
    providerMessageId: log.providerMessageId,
    templateId: log.templateId,
    templateIdPresent: Boolean(log.templateId),
    template: log.template,
    fromAddress: typeof metadata.fromAddress === "string" ? metadata.fromAddress : null,
    missingConfig: configError,
    dedupeConflict: false,
    resendApiError,
    retryAvailable: log.status === "FAILED",
    createdAt: log.createdAt,
    sentAt: log.sentAt,
    failedAt: log.status === "FAILED" ? log.createdAt : null,
  };
}

export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const templates = await prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" } });
    const groupedCounts = await prisma.emailLog.groupBy({
      by: ["templateId", "status"],
      _count: { _all: true },
    });
    const countsByTemplate = new Map<string, { sent: number; failed: number; total: number }>();
    for (const row of groupedCounts) {
      if (!row.templateId) continue;
      const current = countsByTemplate.get(row.templateId) || { sent: 0, failed: 0, total: 0 };
      current.total += row._count._all;
      if (row.status === "SENT") current.sent += row._count._all;
      if (row.status === "FAILED") current.failed += row._count._all;
      countsByTemplate.set(row.templateId, current);
    }
    const templatesWithCounts = templates.map((template: any) => {
      const sendCounts = countsByTemplate.get(template.id) || { sent: 0, failed: 0, total: 0 };
      return {
        ...template,
        sendCounts,
        _count: { emailLogs: sendCounts.sent },
      };
    });
    const logs = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { template: { select: { name: true, slug: true } } } });
    const stats = {
      totalTemplates: templates.length,
      activeTemplates: templates.filter((t: any) => t.isActive).length,
      totalSent: await prisma.emailLog.count({ where: { status: "SENT" } }),
      totalFailed: await prisma.emailLog.count({ where: { status: "FAILED" } }),
    };
    return NextResponse.json({ templates: templatesWithCounts, logs: logs.map(presentEmailLog), stats });
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
    if (isRequiredEmailTemplate(existing)) {
      return NextResponse.json(
        {
          error: "Required transactional templates cannot be hard-deleted. Deactivate only after replacing the required flow.",
          code: "REQUIRED_TEMPLATE_DELETE_BLOCKED",
        },
        { status: 409 },
      );
    }
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

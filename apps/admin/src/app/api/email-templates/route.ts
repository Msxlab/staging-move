export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { writeAdminAudit, getAuditRequestMeta } from "@/lib/audit";
import { maskEmail } from "@/lib/privacy";
import {
  sanitizeEmailHtml,
  sanitizeEmailSubject,
} from "@/lib/email-template-sanitizer";

// Mass-assignment hardening. POST and PUT bodies both go through these
// allowlists — `id`, `slug` (on PUT), `createdAt`, `createdBy`, and any
// other server-managed column must never be settable from the client.
// Variables is a JSON document; we don't peek inside it because legacy
// templates use varied shapes, but we cap the serialized size.
const variablesSchema = z
  .union([
    z.array(z.unknown()).max(200),
    z.record(z.unknown()),
  ])
  .optional();

const templateCategorySchema = z.enum([
  "SYSTEM",
  "TRANSACTIONAL",
  "MARKETING",
  "NOTIFICATION",
]).optional();

const templateCreateSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    name: z.string().trim().min(1).max(200),
    subject: z.string().trim().min(1).max(255),
    body: z.string().min(1).max(200_000),
    category: templateCategorySchema,
    variables: variablesSchema,
    isActive: z.boolean().optional(),
  })
  .strict();

// Slug is intentionally omitted from update — renaming a template slug
// silently breaks every send-by-slug call site. Slug rename should be a
// dedicated migration, not a stealth field on the regular PUT.
const templateUpdateSchema = templateCreateSchema.omit({ slug: true }).partial().strict();

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
    const raw = await req.json().catch(() => null);
    const parsed = templateCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid template payload" }, { status: 400 });
    }
    const { slug, name, subject, body, category, variables, isActive } = parsed.data;
    // Sanitize at write time so the stored row is never a stored-XSS
    // primitive — a future change to the renderer or a preview iframe
    // can't accidentally execute scripts that snuck through. Render
    // paths should still escape, but defense-in-depth.
    const safeSubject = sanitizeEmailSubject(subject);
    const safeBody = sanitizeEmailHtml(body);

    const existing = await prisma.emailTemplate.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "Slug already exists" }, { status: 409 });

    const template = await prisma.emailTemplate.create({
      data: {
        slug,
        name,
        subject: safeSubject,
        body: safeBody,
        category: category ?? "SYSTEM",
        variables: variables !== undefined ? JSON.stringify(variables) : null,
        isActive: isActive ?? true,
        createdBy: session.adminId,
      },
    });
    await writeAdminAudit(session, {
      action: "CREATE_EMAIL_TPL",
      entityType: "EmailTemplate",
      entityId: template.id,
      after: { slug: template.slug, name: template.name, isActive: template.isActive },
      request: getAuditRequestMeta(req),
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
    const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { id, ...rest } = raw as { id?: unknown } & Record<string, unknown>;
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }
    const parsed = templateUpdateSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid template payload" }, { status: 400 });
    }
    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const { variables, subject, body, ...updateRest } = parsed.data;
    // Sanitize body/subject on update — same rationale as POST.
    const safeUpdate: Record<string, unknown> = { ...updateRest };
    if (subject !== undefined) safeUpdate.subject = sanitizeEmailSubject(subject);
    if (body !== undefined) safeUpdate.body = sanitizeEmailHtml(body);
    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...safeUpdate,
        ...(variables !== undefined ? { variables: JSON.stringify(variables) } : {}),
        updatedBy: session.adminId,
      },
    });
    await writeAdminAudit(session, {
      action: "UPDATE_EMAIL_TPL",
      entityType: "EmailTemplate",
      entityId: template.id,
      before: { name: existing.name, subject: existing.subject, isActive: existing.isActive },
      after: { name: template.name, subject: template.subject, isActive: template.isActive },
      request: getAuditRequestMeta(req),
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
    await writeAdminAudit(session, {
      action: "DELETE_EMAIL_TPL",
      entityType: "EmailTemplate",
      entityId: id,
      before: { slug: existing.slug, name: existing.name },
      request: getAuditRequestMeta(req),
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

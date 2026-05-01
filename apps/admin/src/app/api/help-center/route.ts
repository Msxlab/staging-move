export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { writeAdminAudit, getAuditRequestMeta } from "@/lib/audit";

// Mass-assignment hardening: every mutation goes through a Zod schema
// that picks ONLY the fields the route is allowed to write. Spread of
// the raw body is forbidden — `id`, `slug` (on update), `createdAt`,
// `createdBy`, and any future ownership column must never be settable
// from the client. The schemas below are the canonical allow-list.

const tagsSchema = z.array(z.string().trim().min(1).max(50)).max(20).optional();

const faqCreateSchema = z
  .object({
    question: z.string().trim().min(3).max(500),
    answer: z.string().trim().min(1).max(10_000),
    category: z.string().trim().min(1).max(80).optional(),
    order: z.number().int().min(0).max(100_000).optional(),
    isPublished: z.boolean().optional(),
  })
  .strict();

const faqUpdateSchema = faqCreateSchema.partial().strict();

const articleCreateSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().trim().min(1).max(255),
    content: z.string().min(1).max(200_000),
    excerpt: z.string().max(500).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    tags: tagsSchema,
    order: z.number().int().min(0).max(100_000).optional(),
    isPublished: z.boolean().optional(),
  })
  .strict();

// Updates intentionally do NOT include `slug` — slug is the user-facing
// permalink and changing it silently breaks every existing inbound link
// and SEO. If the editorial team needs to rename a slug, that must be
// an explicit migration, not a stealth field on a regular PUT.
const articleUpdateSchema = articleCreateSchema.omit({ slug: true }).partial().strict();

export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const [articles, faqs] = await Promise.all([
      prisma.helpArticle.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }),
      prisma.fAQ.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }),
    ]);
    return NextResponse.json({ articles, faqs });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canCreate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { entityType, ...rest } = body as { entityType?: string } & Record<string, unknown>;

    if (entityType === "faq") {
      const parsed = faqCreateSchema.safeParse(rest);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid FAQ payload" }, { status: 400 });
      }
      const faq = await prisma.fAQ.create({
        data: {
          question: parsed.data.question,
          answer: parsed.data.answer,
          category: parsed.data.category ?? "General",
          order: parsed.data.order ?? 0,
          isPublished: parsed.data.isPublished ?? true,
        },
      });
      await writeAdminAudit(session, {
        action: "CREATE_FAQ",
        entityType: "FAQ",
        entityId: faq.id,
        after: { question: faq.question, category: faq.category, isPublished: faq.isPublished },
        request: getAuditRequestMeta(req),
      });
      return NextResponse.json(faq);
    }

    const parsed = articleCreateSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid article payload" }, { status: 400 });
    }
    const article = await prisma.helpArticle.create({
      data: {
        slug: parsed.data.slug,
        title: parsed.data.title,
        content: parsed.data.content,
        excerpt: parsed.data.excerpt,
        category: parsed.data.category ?? "General",
        tags: parsed.data.tags ? JSON.stringify(parsed.data.tags) : "[]",
        order: parsed.data.order ?? 0,
        isPublished: parsed.data.isPublished ?? false,
        createdBy: session.adminId,
      },
    });
    await writeAdminAudit(session, {
      action: "CREATE_HELP_ARTICLE",
      entityType: "HelpArticle",
      entityId: article.id,
      after: { slug: article.slug, title: article.title, isPublished: article.isPublished },
      request: getAuditRequestMeta(req),
    });
    return NextResponse.json(article);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { id, entityType, ...rest } = body as { id?: string; entityType?: string } & Record<string, unknown>;
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    if (entityType === "faq") {
      const parsed = faqUpdateSchema.safeParse(rest);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid FAQ payload" }, { status: 400 });
      }
      const existingFaq = await prisma.fAQ.findUnique({ where: { id } });
      if (!existingFaq) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
      const faq = await prisma.fAQ.update({ where: { id }, data: parsed.data });
      await writeAdminAudit(session, {
        action: "UPDATE_FAQ",
        entityType: "FAQ",
        entityId: faq.id,
        before: { question: existingFaq.question, isPublished: existingFaq.isPublished, category: existingFaq.category },
        after: { question: faq.question, isPublished: faq.isPublished, category: faq.category },
        request: getAuditRequestMeta(req),
      });
      return NextResponse.json(faq);
    }

    const parsed = articleUpdateSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid article payload" }, { status: 400 });
    }
    const existingArticle = await prisma.helpArticle.findUnique({ where: { id } });
    if (!existingArticle) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    const { tags, ...articleRest } = parsed.data;
    const article = await prisma.helpArticle.update({
      where: { id },
      data: {
        ...articleRest,
        ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
        updatedBy: session.adminId,
      },
    });
    await writeAdminAudit(session, {
      action: "UPDATE_HELP_ARTICLE",
      entityType: "HelpArticle",
      entityId: article.id,
      before: { title: existingArticle.title, isPublished: existingArticle.isPublished, category: existingArticle.category },
      after: { title: article.title, isPublished: article.isPublished, category: article.category },
      request: getAuditRequestMeta(req),
    });
    return NextResponse.json(article);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canDelete", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { id, entityType } = await req.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    if (entityType === "faq") {
      const existingFaq = await prisma.fAQ.findUnique({ where: { id } });
      if (!existingFaq) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
      await prisma.fAQ.delete({ where: { id } });
      await writeAdminAudit(session, {
        action: "DELETE_FAQ",
        entityType: "FAQ",
        entityId: id,
        before: { question: existingFaq.question, category: existingFaq.category },
        request: getAuditRequestMeta(req),
      });
    } else {
      const existingArticle = await prisma.helpArticle.findUnique({ where: { id } });
      if (!existingArticle) return NextResponse.json({ error: "Article not found" }, { status: 404 });
      await prisma.helpArticle.delete({ where: { id } });
      await writeAdminAudit(session, {
        action: "DELETE_HELP_ARTICLE",
        entityType: "HelpArticle",
        entityId: id,
        before: { slug: existingArticle.slug, title: existingArticle.title },
        request: getAuditRequestMeta(req),
      });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

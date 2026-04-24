export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

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
    const body = await req.json();
    const { entityType, ...data } = body;

    if (entityType === "faq") {
      const faq = await prisma.fAQ.create({ data: { question: data.question, answer: data.answer, category: data.category || "General", order: data.order || 0, isPublished: data.isPublished ?? true } });
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "CREATE_FAQ",
          entityType: "FAQ",
          entityId: faq.id,
          changes: JSON.stringify({ question: faq.question, category: faq.category, isPublished: faq.isPublished }),
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        },
      });
      return NextResponse.json(faq);
    }

    if (!data.slug || !data.title || !data.content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const article = await prisma.helpArticle.create({
      data: { slug: data.slug, title: data.title, content: data.content, excerpt: data.excerpt, category: data.category || "General", tags: data.tags ? JSON.stringify(data.tags) : "[]", order: data.order || 0, isPublished: data.isPublished ?? false, createdBy: session.adminId },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE_HELP_ARTICLE",
        entityType: "HelpArticle",
        entityId: article.id,
        changes: JSON.stringify({ slug: article.slug, title: article.title, isPublished: article.isPublished }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
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
    const body = await req.json();
    const { id, entityType, ...data } = body;

    if (entityType === "faq") {
      const existingFaq = await prisma.fAQ.findUnique({ where: { id } });
      if (!existingFaq) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
      const faq = await prisma.fAQ.update({ where: { id }, data });
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "UPDATE_FAQ",
          entityType: "FAQ",
          entityId: faq.id,
          changes: JSON.stringify({
            before: { question: existingFaq.question, isPublished: existingFaq.isPublished, category: existingFaq.category },
            after: { question: faq.question, isPublished: faq.isPublished, category: faq.category },
          }),
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        },
      });
      return NextResponse.json(faq);
    }

    const existingArticle = await prisma.helpArticle.findUnique({ where: { id } });
    if (!existingArticle) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    const article = await prisma.helpArticle.update({ where: { id }, data: { ...data, tags: data.tags ? JSON.stringify(data.tags) : undefined, updatedBy: session.adminId } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE_HELP_ARTICLE",
        entityType: "HelpArticle",
        entityId: article.id,
        changes: JSON.stringify({
          before: { title: existingArticle.title, isPublished: existingArticle.isPublished, category: existingArticle.category },
          after: { title: article.title, isPublished: article.isPublished, category: article.category },
        }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
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
    if (entityType === "faq") {
      const existingFaq = await prisma.fAQ.findUnique({ where: { id } });
      if (!existingFaq) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
      await prisma.fAQ.delete({ where: { id } });
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "DELETE_FAQ",
          entityType: "FAQ",
          entityId: id,
          changes: JSON.stringify({ question: existingFaq.question, category: existingFaq.category }),
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        },
      });
    } else {
      const existingArticle = await prisma.helpArticle.findUnique({ where: { id } });
      if (!existingArticle) return NextResponse.json({ error: "Article not found" }, { status: 404 });
      await prisma.helpArticle.delete({ where: { id } });
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "DELETE_HELP_ARTICLE",
          entityType: "HelpArticle",
          entityId: id,
          changes: JSON.stringify({ slug: existingArticle.slug, title: existingArticle.title }),
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

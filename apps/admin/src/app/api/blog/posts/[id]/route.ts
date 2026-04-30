/**
 * GET    /api/blog/posts/[id]   — fetch single post (with revisions)
 * PATCH  /api/blog/posts/[id]   — partial update (title, content, SEO, etc.)
 * DELETE /api/blog/posts/[id]   — soft delete (sets deletedAt)
 *
 * PATCH always writes a `BlogRevision` snapshot when content changes
 * so editors can roll back; the snapshot is hash-skipped if nothing
 * meaningful changed (mostly autosave noise during typing).
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { renderBlogContent } from "@/lib/blog-content";
import { revalidatePublicBlog } from "@/lib/blog-revalidate";
import {
  BLOG_LOCALES,
  generateExcerpt,
  isReservedSlug,
  slugify,
} from "@locateflow/shared";

function authError(e: unknown) {
  const msg = (e as Error)?.message;
  if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("blog", "canRead", { minimumRole: "MODERATOR" });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { id } = await params;
  const post = await prisma.blogPost.findFirst({
    where: { id, deletedAt: null },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      category: { select: { id: true, slug: true, name: true } },
      tags: { include: { tag: true } },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          note: true,
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post });
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().max(180).optional(),
  locale: z.enum(BLOG_LOCALES).optional(),
  excerpt: z.string().max(500).optional(),
  contentJson: z.record(z.string(), z.unknown()).optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(320).nullable().optional(),
  canonicalUrl: z.string().url().max(500).nullable().optional(),
  noIndex: z.boolean().optional(),
  ogImageKey: z.string().max(500).nullable().optional(),
  ogImageAlt: z.string().max(200).nullable().optional(),
  categoryId: z.string().max(30).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  /** Optional commit-style note for the BlogRevision row. */
  revisionNote: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requirePermission("blog", "canUpdate", { minimumRole: "MODERATOR" });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { id } = await params;
  let body;
  try {
    body = updateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.blogPost.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      locale: true,
      contentJson: true,
      title: true,
      status: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  // Slug change — re-validate uniqueness within locale.
  const targetLocale = body.locale ?? existing.locale;
  const desiredSlug =
    body.slug !== undefined
      ? body.slug.trim()
        ? slugify(body.slug)
        : slugify(body.title ?? existing.title)
      : existing.slug;
  if (!desiredSlug) return NextResponse.json({ error: "Empty slug" }, { status: 400 });
  if (isReservedSlug(desiredSlug)) return NextResponse.json({ error: "Slug reserved" }, { status: 400 });
  if (desiredSlug !== existing.slug || targetLocale !== existing.locale) {
    const taken = await prisma.blogPost.findFirst({
      where: { slug: desiredSlug, locale: targetLocale, NOT: { id } },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }
  if (body.slug !== undefined) {
    data.slug = desiredSlug;
  }

  if (body.title !== undefined) data.title = body.title;
  if (body.locale !== undefined) data.locale = body.locale;
  if (body.seoTitle !== undefined) data.seoTitle = body.seoTitle;
  if (body.seoDescription !== undefined) data.seoDescription = body.seoDescription;
  if (body.canonicalUrl !== undefined) data.canonicalUrl = body.canonicalUrl;
  if (body.noIndex !== undefined) data.noIndex = body.noIndex;
  if (body.ogImageKey !== undefined) data.ogImageKey = body.ogImageKey;
  if (body.ogImageAlt !== undefined) data.ogImageAlt = body.ogImageAlt;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId;
  if (body.scheduledAt !== undefined) {
    data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  }

  // Content change — render + sanitize + extract text.
  let contentChanged = false;
  if (body.contentJson !== undefined) {
    let rendered;
    try {
      rendered = renderBlogContent({ json: body.contentJson });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "INVALID_TIPTAP_JSON") {
        return NextResponse.json({ error: "Invalid content document" }, { status: 400 });
      }
      throw e;
    }
    data.contentJson = body.contentJson;
    data.contentHtml = rendered.html;
    data.contentText = rendered.text;
    data.readingMinutes = rendered.readingMinutes;
    if (body.excerpt !== undefined) {
      data.excerpt = body.excerpt;
    } else {
      data.excerpt = generateExcerpt(rendered.text);
    }
    contentChanged = true;
  } else if (body.excerpt !== undefined) {
    data.excerpt = body.excerpt;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const post = await tx.blogPost.update({
      where: { id },
      data,
      select: { id: true, slug: true, locale: true, status: true, title: true },
    });

    if (contentChanged) {
      await tx.blogRevision.create({
        data: {
          postId: id,
          authorId: session.adminId,
          title: typeof data.title === "string" ? data.title : existing.title,
          contentJson: body.contentJson as object,
          note: body.revisionNote ?? null,
        },
      });
    }

    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_UPDATE",
        entityType: "BlogPost",
        entityId: id,
        // Don't echo the full body — the data shape is already
        // captured by the BlogRevision row and the column mutations.
        changes: JSON.stringify({ fields: Object.keys(data) }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return post;
  });

  // Only invalidate the public site if the post is live.
  if (existing.status === "PUBLISHED") {
    void revalidatePublicBlog({ slug: updated.slug, locale: updated.locale });
  }

  return NextResponse.json({ post: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requirePermission("blog", "canDelete", { minimumRole: "ADMIN" });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { id } = await params;
  const existing = await prisma.blogPost.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true, locale: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.blogPost.update({
      where: { id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_DELETE",
        entityType: "BlogPost",
        entityId: id,
        changes: JSON.stringify({ slug: existing.slug, locale: existing.locale }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
  });

  if (existing.status === "PUBLISHED") {
    void revalidatePublicBlog({ slug: existing.slug, locale: existing.locale });
  }

  return NextResponse.json({ ok: true });
}

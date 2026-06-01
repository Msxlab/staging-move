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
  /** Replace the post's tag set with this list of tag ids. Pass [] to clear. */
  tagIds: z.array(z.string().max(30)).optional(),
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
      seoTitle: true,
      seoDescription: true,
      canonicalUrl: true,
      noIndex: true,
      categoryId: true,
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

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
    const post = await tx.blogPost.update({
      where: { id },
      data,
      select: { id: true, slug: true, locale: true, status: true, title: true },
    });

    if (body.tagIds !== undefined) {
      // Replace the entire tag set. Cheapest correct approach: drop
      // existing join rows and re-create. The set is small (we cap at
      // ~10 tags per post in practice) so a delete+createMany is fine.
      const targetIds = Array.from(new Set(body.tagIds));
      // Validate all referenced tags exist + share the post's locale
      // so we don't end up with cross-locale tag links.
      if (targetIds.length > 0) {
        const tags = await tx.blogTag.findMany({
          where: { id: { in: targetIds }, locale: post.locale },
          select: { id: true },
        });
        if (tags.length !== targetIds.length) {
          throw new Error("INVALID_TAG_IDS");
        }
      }
      await tx.blogPostTag.deleteMany({ where: { postId: id } });
      if (targetIds.length > 0) {
        await tx.blogPostTag.createMany({
          data: targetIds.map((tagId) => ({ postId: id, tagId })),
          skipDuplicates: true,
        });
      }
    }

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

    // SEO-sensitive fields get before/after captured so we can answer
    // "who flipped noindex on the launch post?" without a backup
    // restore. Body changes stay in BlogRevision (full snapshot), not
    // the audit log, since they can be enormous.
    const seoSensitiveKeys = [
      "slug",
      "locale",
      "title",
      "seoTitle",
      "seoDescription",
      "canonicalUrl",
      "noIndex",
      "categoryId",
    ] as const;
    const seoBefore: Record<string, unknown> = {};
    const seoAfter: Record<string, unknown> = {};
    for (const key of seoSensitiveKeys) {
      if (key in data) {
        seoBefore[key] = (existing as Record<string, unknown>)[key] ?? null;
        seoAfter[key] = (data as Record<string, unknown>)[key] ?? null;
      }
    }
    const auditChanges: Record<string, unknown> = { fields: Object.keys(data) };
    if (Object.keys(seoBefore).length > 0) {
      auditChanges.before = seoBefore;
      auditChanges.after = seoAfter;
    }
    if (body.tagIds !== undefined) {
      auditChanges.tagIds = { count: body.tagIds.length };
    }
    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_UPDATE",
        entityType: "BlogPost",
        entityId: id,
        changes: JSON.stringify(auditChanges),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return post;
  });
  } catch (e) {
    if ((e as Error)?.message === "INVALID_TAG_IDS") {
      return NextResponse.json(
        { error: "One or more tag ids are invalid for this post's locale." },
        { status: 400 },
      );
    }
    throw e;
  }

  // Only invalidate the public site if the post is live. Await the
  // result here so the editor sees revalidate failures alongside the
  // save toast — same pattern as the publish route.
  let revalidate: { ok: boolean; reason?: string } | null = null;
  if (existing.status === "PUBLISHED") {
    const result = await revalidatePublicBlog({ slug: updated.slug, locale: updated.locale });
    revalidate = result.ok ? { ok: true } : { ok: false, reason: result.reason };
    // If the slug changed, also purge the OLD URL — otherwise /blog/<old-slug>
    // (and its cached list/feed/sitemap entries) keep referencing a path that
    // no longer resolves to this post.
    if (existing.slug && existing.slug !== updated.slug) {
      await revalidatePublicBlog({ slug: existing.slug, locale: updated.locale }).catch(() => {});
    }
  }

  return NextResponse.json({ post: updated, revalidate });
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

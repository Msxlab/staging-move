/**
 * GET  /api/blog/posts         — list (filter by status/locale)
 * POST /api/blog/posts         — create draft
 *
 * The list response is small enough to ship in one shot for the admin
 * UI (pagination lives client-side). The create endpoint accepts
 * minimum-viable input (title + locale) and returns the new post; the
 * editor then PATCHes it as the user types.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta } from "@/lib/audit";
import { renderBlogContent } from "@/lib/blog-content";
import {
  BLOG_LOCALES,
  isReservedSlug,
  slugify,
} from "@locateflow/shared";

function authError(e: unknown) {
  const msg = (e as Error)?.message;
  if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission("blog", "canRead", { minimumRole: "MODERATOR" });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // DRAFT | SCHEDULED | PUBLISHED | ARCHIVED
  const locale = searchParams.get("locale"); // en | es

  const where: Record<string, unknown> = { deletedAt: null };
  if (status) where.status = status;
  if (locale) where.locale = locale;

  const posts = await prisma.blogPost.findMany({
    where,
    select: {
      id: true,
      slug: true,
      locale: true,
      title: true,
      status: true,
      publishedAt: true,
      scheduledAt: true,
      updatedAt: true,
      author: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ posts });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  locale: z.enum(BLOG_LOCALES).default("en"),
  slug: z.string().max(180).optional(),
});

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requirePermission("blog", "canCreate", { minimumRole: "MODERATOR" });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  let body;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Auto-slug from title if not provided. Reject reserved slugs even
  // when the editor types them deliberately — those collide with
  // route handlers (/api, /admin, etc.).
  const baseSlug = body.slug ? slugify(body.slug) : slugify(body.title);
  if (!baseSlug) {
    return NextResponse.json({ error: "Title produced an empty slug" }, { status: 400 });
  }
  if (isReservedSlug(baseSlug)) {
    return NextResponse.json({ error: "Slug is reserved" }, { status: 400 });
  }

  // Slug uniqueness is enforced per-locale; if it's taken, append a
  // short suffix until we find an opening. Three retries are enough
  // in practice — any author who hits four collisions on the same
  // title within seconds is almost certainly trying to abuse this.
  let finalSlug = baseSlug;
  for (let i = 0; i < 4; i++) {
    const exists = await prisma.blogPost.findFirst({
      where: { slug: finalSlug, locale: body.locale },
      select: { id: true },
    });
    if (!exists) break;
    finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Empty Tiptap document — the editor will replace this on first save.
  const emptyDoc = { type: "doc", content: [{ type: "paragraph" }] };
  const rendered = renderBlogContent({ json: emptyDoc });

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.blogPost.create({
      data: {
        title: body.title,
        slug: finalSlug,
        locale: body.locale,
        excerpt: "",
        contentJson: emptyDoc,
        contentHtml: rendered.html,
        contentText: rendered.text,
        readingMinutes: rendered.readingMinutes,
        status: "DRAFT",
        authorId: session.adminId,
      },
      select: { id: true, slug: true, locale: true, title: true, status: true },
    });

    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_CREATE",
        entityType: "BlogPost",
        entityId: created.id,
        changes: JSON.stringify({ title: created.title, slug: created.slug, locale: created.locale }),
        ipAddress: getAuditRequestMeta(req).ipAddress || "unknown",
      },
    });

    return created;
  });

  return NextResponse.json(post);
}

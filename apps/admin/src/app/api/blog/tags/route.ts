/**
 * GET  /api/blog/tags  — list tags (filterable by locale)
 * POST /api/blog/tags  — create or reuse a tag (auto-slug)
 *
 * Tags exist in the schema (BlogTag, BlogPostTag) and are rendered on
 * the public detail page, but until now there was no admin entry point
 * to create them — so the post tag list was always empty. This route
 * mirrors the categories shape so the editor can manage both alongside
 * each other.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta } from "@/lib/audit";
import { BLOG_LOCALES, slugify } from "@locateflow/shared";

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
  const localeRaw = searchParams.get("locale");
  const locale = localeRaw && (BLOG_LOCALES as readonly string[]).includes(localeRaw) ? localeRaw : undefined;

  const tags = await prisma.blogTag.findMany({
    where: locale ? { locale } : undefined,
    select: {
      id: true,
      slug: true,
      name: true,
      locale: true,
      _count: { select: { posts: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json({
    tags: tags.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      locale: t.locale,
      postCount: t._count.posts,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  locale: z.enum(BLOG_LOCALES).default("en"),
  slug: z.string().max(100).optional(),
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

  const slug = slugify(body.slug || body.name);
  if (!slug) return NextResponse.json({ error: "Empty slug" }, { status: 400 });

  // Reuse existing on collision so the editor can be optimistic about
  // creating tags inline — the post relation just attaches to whatever
  // row is already there.
  const existing = await prisma.blogTag.findFirst({
    where: { slug, locale: body.locale },
    select: { id: true, slug: true, name: true, locale: true },
  });
  if (existing) {
    return NextResponse.json({ tag: existing, reused: true });
  }

  const requestMeta = getAuditRequestMeta(req);
  const created = await prisma.$transaction(async (tx) => {
    const tag = await tx.blogTag.create({
      data: { name: body.name.trim(), slug, locale: body.locale },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_TAG_CREATE",
        entityType: "BlogTag",
        entityId: tag.id,
        changes: JSON.stringify({ slug: tag.slug, locale: tag.locale, name: tag.name }),
        ipAddress: requestMeta.ipAddress,
      },
    });
    return tag;
  });

  return NextResponse.json({ tag: created, reused: false });
}

/**
 * GET  /api/blog/categories         — list categories (filtered by locale)
 * POST /api/blog/categories         — create a new category (auto-slug)
 *
 * Used by the post editor's category selector. The list is intentionally
 * unpaginated (admins rarely need more than a few dozen) and orders by
 * `order` ASC then `name` so editor-curated taxonomy stays predictable.
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

  const categories = await prisma.blogCategory.findMany({
    where: locale ? { locale } : undefined,
    select: {
      id: true,
      slug: true,
      name: true,
      locale: true,
      description: true,
      order: true,
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ categories });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  locale: z.enum(BLOG_LOCALES).default("en"),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
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

  // (slug, locale) is unique — if it already exists, surface the
  // existing row so the editor can adopt it instead of erroring.
  const existing = await prisma.blogCategory.findFirst({
    where: { slug, locale: body.locale },
  });
  if (existing) {
    return NextResponse.json({ category: existing, reused: true });
  }

  const requestMeta = getAuditRequestMeta(req);
  const created = await prisma.$transaction(async (tx) => {
    const category = await tx.blogCategory.create({
      data: {
        name: body.name.trim(),
        slug,
        locale: body.locale,
        description: body.description?.trim() || null,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_CATEGORY_CREATE",
        entityType: "BlogCategory",
        entityId: category.id,
        changes: JSON.stringify({ slug: category.slug, locale: category.locale, name: category.name }),
        ipAddress: requestMeta.ipAddress,
      },
    });
    return category;
  });

  return NextResponse.json({ category: created, reused: false });
}

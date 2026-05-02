/**
 * PATCH  /api/blog/categories/[id] — rename / re-slug / reorder
 * DELETE /api/blog/categories/[id] — delete (refuses if any post uses it)
 *
 * Categories are visible on every blog post card and surfaced in the
 * public sitemap, so editorial wants to be able to fix typos and
 * reorder navigation without dropping into the DB. Slug changes
 * follow the same `slugify` + uniqueness rules as the create route.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta } from "@/lib/audit";
import { slugify } from "@locateflow/shared";

function authError(e: unknown) {
  const msg = (e as Error)?.message;
  if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  order: z.number().int().min(0).max(10_000).optional(),
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
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.blogCategory.findUnique({
    where: { id },
    select: { id: true, slug: true, locale: true, name: true, description: true, order: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.order !== undefined) data.order = body.order;
  if (body.slug !== undefined) {
    const next = slugify(body.slug);
    if (!next) return NextResponse.json({ error: "Empty slug" }, { status: 400 });
    if (next !== existing.slug) {
      const taken = await prisma.blogCategory.findFirst({
        where: { slug: next, locale: existing.locale, NOT: { id } },
        select: { id: true },
      });
      if (taken) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
      data.slug = next;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ category: existing, unchanged: true });
  }

  const requestMeta = getAuditRequestMeta(req);
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.blogCategory.update({ where: { id }, data });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_CATEGORY_UPDATE",
        entityType: "BlogCategory",
        entityId: id,
        changes: JSON.stringify({
          before: {
            slug: existing.slug,
            name: existing.name,
            order: existing.order,
            description: existing.description,
          },
          after: data,
        }),
        ipAddress: requestMeta.ipAddress,
      },
    });
    return next;
  });

  return NextResponse.json({ category: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requirePermission("blog", "canDelete", { minimumRole: "ADMIN" });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { id } = await params;
  const existing = await prisma.blogCategory.findUnique({
    where: { id },
    select: { id: true, slug: true, locale: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Refuse if posts (any status, including drafts/archived) reference
  // this category — orphaning a category id is a footgun even for
  // archived posts, since unarchive surfaces them with a broken link.
  const inUse = await prisma.blogPost.count({ where: { categoryId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      {
        code: "CATEGORY_IN_USE",
        error: `Cannot delete: ${inUse} post${inUse === 1 ? "" : "s"} still use this category. Reassign first.`,
      },
      { status: 409 },
    );
  }

  const requestMeta = getAuditRequestMeta(req);
  await prisma.$transaction(async (tx) => {
    await tx.blogCategory.delete({ where: { id } });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_CATEGORY_DELETE",
        entityType: "BlogCategory",
        entityId: id,
        changes: JSON.stringify({ slug: existing.slug, locale: existing.locale }),
        ipAddress: requestMeta.ipAddress,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

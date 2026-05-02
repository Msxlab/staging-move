/**
 * PATCH  /api/blog/tags/[id]  — rename / re-slug
 * DELETE /api/blog/tags/[id]  — delete (cascades BlogPostTag rows)
 *
 * Tag deletes use the schema's `onDelete: Cascade` on BlogPostTag so
 * the cleanup happens in a single statement. We log the affected row
 * count up-front so the audit entry tells operators how much was
 * detached if the tag was widely used.
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

  const existing = await prisma.blogTag.findUnique({
    where: { id },
    select: { id: true, slug: true, locale: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.slug !== undefined) {
    const next = slugify(body.slug);
    if (!next) return NextResponse.json({ error: "Empty slug" }, { status: 400 });
    if (next !== existing.slug) {
      const taken = await prisma.blogTag.findFirst({
        where: { slug: next, locale: existing.locale, NOT: { id } },
        select: { id: true },
      });
      if (taken) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
      data.slug = next;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ tag: existing, unchanged: true });
  }

  const requestMeta = getAuditRequestMeta(req);
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.blogTag.update({ where: { id }, data });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_TAG_UPDATE",
        entityType: "BlogTag",
        entityId: id,
        changes: JSON.stringify({
          before: { slug: existing.slug, name: existing.name },
          after: data,
        }),
        ipAddress: requestMeta.ipAddress,
      },
    });
    return next;
  });

  return NextResponse.json({ tag: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requirePermission("blog", "canDelete", { minimumRole: "ADMIN" });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { id } = await params;
  const existing = await prisma.blogTag.findUnique({
    where: { id },
    select: { id: true, slug: true, locale: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inUse = await prisma.blogPostTag.count({ where: { tagId: id } });
  const requestMeta = getAuditRequestMeta(req);
  await prisma.$transaction(async (tx) => {
    // BlogPostTag has onDelete: Cascade, so the join rows go with the
    // tag automatically. We don't touch BlogPost itself.
    await tx.blogTag.delete({ where: { id } });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BLOG_TAG_DELETE",
        entityType: "BlogTag",
        entityId: id,
        changes: JSON.stringify({
          slug: existing.slug,
          locale: existing.locale,
          name: existing.name,
          detachedPosts: inUse,
        }),
        ipAddress: requestMeta.ipAddress,
      },
    });
  });

  return NextResponse.json({ ok: true, detachedPosts: inUse });
}

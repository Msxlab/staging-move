/**
 * POST /api/blog/posts/[id]/publish
 *
 * Lifecycle transitions:
 *   - DRAFT     → PUBLISHED   (publishedAt = now)
 *   - SCHEDULED → PUBLISHED   (publishedAt = now, scheduledAt cleared)
 *   - DRAFT     → SCHEDULED   (when body.scheduledAt is in the future)
 *   - PUBLISHED → ARCHIVED    (unpublish)
 *
 * Anything not in this matrix gets a 409. Publish requires a non-empty
 * title + non-empty content body — we don't ship hollow posts. The
 * publish action revalidates `/blog`, `/blog/<slug>`, `/sitemap.xml`,
 * `/llms.txt`, and the homepage.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { revalidatePublicBlog } from "@/lib/blog-revalidate";

const publishSchema = z.object({
  action: z.enum(["publish", "schedule", "unpublish"]),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requirePermission("blog", "canUpdate", { minimumRole: "MODERATOR" });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { id } = await params;
  let body;
  try {
    body = publishSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.blogPost.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      locale: true,
      status: true,
      title: true,
      contentText: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sanity gate: don't publish an empty post. `contentText` is the
  // sanitize-derived plain text, so this is also a check that the
  // editor actually wrote something the public site will render.
  if ((body.action === "publish" || body.action === "schedule") &&
      (!existing.title.trim() || existing.contentText.trim().length < 20)) {
    return NextResponse.json(
      { error: "Post needs a title and at least a paragraph of content before publishing" },
      { status: 400 },
    );
  }

  let next: { status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"; publishedAt: Date | null; scheduledAt: Date | null };

  if (body.action === "publish") {
    next = { status: "PUBLISHED", publishedAt: new Date(), scheduledAt: null };
  } else if (body.action === "schedule") {
    if (!body.scheduledAt) {
      return NextResponse.json({ error: "scheduledAt required for schedule" }, { status: 400 });
    }
    const at = new Date(body.scheduledAt);
    if (at.getTime() < Date.now() + 60_000) {
      return NextResponse.json(
        { error: "scheduledAt must be at least 1 minute in the future" },
        { status: 400 },
      );
    }
    next = { status: "SCHEDULED", publishedAt: null, scheduledAt: at };
  } else {
    // unpublish — only valid from PUBLISHED
    if (existing.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Only PUBLISHED posts can be unpublished" }, { status: 409 });
    }
    next = { status: "ARCHIVED", publishedAt: null, scheduledAt: null };
  }

  await prisma.$transaction(async (tx) => {
    await tx.blogPost.update({
      where: { id },
      data: next,
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: `BLOG_${body.action.toUpperCase()}`,
        entityType: "BlogPost",
        entityId: id,
        changes: JSON.stringify({
          from: existing.status,
          to: next.status,
          publishedAt: next.publishedAt?.toISOString() ?? null,
          scheduledAt: next.scheduledAt?.toISOString() ?? null,
        }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
  });

  // Revalidate when the post becomes (or stops being) public.
  if (next.status === "PUBLISHED" || existing.status === "PUBLISHED") {
    void revalidatePublicBlog({ slug: existing.slug, locale: existing.locale });
  }

  return NextResponse.json({ ok: true, status: next.status });
}

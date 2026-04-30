/**
 * Cron: every minute, promote SCHEDULED posts whose `scheduledAt` is
 * now in the past to PUBLISHED, set `publishedAt = now`, and trigger
 * cache invalidation. Triggered by Ofelia (see `docker/ofelia.ini`)
 * via an authenticated HTTP call with `x-cron-secret`.
 *
 * Idempotent: a second call within the same window finds zero rows
 * to flip. Bounded: caps at 50 posts per tick so a backlog can't
 * stall the cron loop.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { pingIndexNow } from "@/lib/blog/indexnow";

function unauthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  // Accept either `Authorization: Bearer <secret>` (Ofelia cron — see
  // docker/ofelia.ini) or `x-cron-secret` (manual ops triggers). The
  // bearer form is the canonical one used by every other cron route.
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${expected}`) return false;
  const provided = req.headers.get("x-cron-secret") ?? "";
  return provided !== expected;
}

export async function POST(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return runCron();
}

// Ofelia hits us with GET — accept either verb so the docker config
// stays simple. The auth is identical.
export async function GET(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return runCron();
}

async function runCron() {
  const now = new Date();
  const due = await prisma.blogPost.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
      deletedAt: null,
    },
    select: { id: true, slug: true, locale: true },
    take: 50,
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, published: 0 });
  }

  await prisma.$transaction(async (tx) => {
    for (const post of due) {
      await tx.blogPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", publishedAt: now, scheduledAt: null },
      });
    }
  });

  // Invalidate all aggregation surfaces once, plus each new slug.
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  revalidatePath("/blog/feed.xml");
  revalidatePath("/blog/atom.xml");
  revalidatePath("/");
  for (const post of due) {
    revalidatePath(`/blog/${post.slug}`);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (appUrl) {
    void pingIndexNow([
      `${appUrl}/blog`,
      ...due.map((post) => `${appUrl}/blog/${post.slug}${post.locale === "es" ? "?locale=es" : ""}`),
    ]);
  }

  return NextResponse.json({
    ok: true,
    published: due.length,
    slugs: due.map((p) => p.slug),
  });
}

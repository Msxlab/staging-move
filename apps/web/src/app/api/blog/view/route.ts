/**
 * POST /api/blog/view
 *
 * Privacy-friendly view counter. Body: `{ slug: string }`. We:
 *   1. Resolve the slug to a postId (server-side — no client trust).
 *   2. Hash the IP with a daily-rotating salt → `ipHash` (so we can
 *      dedupe within a day without storing visitor identity).
 *   3. Detect bots from UA so the dashboard splits organic / AI / bot.
 *   4. Insert one BlogView row + bump `viewCount` denormalized.
 *
 * Rate-limited: 60 req / minute / IP. The endpoint is fire-and-forget
 * from the page; failures don't surface to the reader.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRateLimitKey, rateLimit, resolveClientIP } from "@/lib/rate-limit";
import { isBotUserAgent, isBlogLocale } from "@locateflow/shared";

const bodySchema = z.object({
  slug: z.string().min(1).max(191),
  locale: z.string().min(2).max(8).optional(),
});

function dailySalt(): string {
  // Salt rotates each UTC day so we can dedupe `(postId, ipHash)`
  // within a day without keeping a stable visitor identifier across
  // days. Combine a per-process secret if available; otherwise just
  // the date so we still get the rotation property.
  const date = new Date().toISOString().slice(0, 10);
  return `${process.env.USER_JWT_SECRET ?? "blog-salt"}:${date}`;
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`${dailySalt()}:${ip}`).digest("hex");
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(getRateLimitKey(req, "blog:view"), {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return new NextResponse(null, { status: 204 });
  }

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const post = await prisma.blogPost.findFirst({
    where: {
      slug: body.slug,
      status: "PUBLISHED",
      publishedAt: { lte: new Date() },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!post) {
    // Don't reveal draft existence — return 204 either way so a
    // crawler probing slugs gets the same response shape.
    return new NextResponse(null, { status: 204 });
  }

  const ip = resolveClientIP(req);
  const ipHash = hashIp(ip);
  const viewDay = new Date().toISOString().slice(0, 10);
  const ua = req.headers.get("user-agent") ?? null;
  const referrer = req.headers.get("referer") ?? null;
  const localeHeader = req.headers.get("x-locale");
  const locale = isBlogLocale(body.locale)
    ? body.locale
    : isBlogLocale(localeHeader)
      ? localeHeader
      : null;
  const isBot = isBotUserAgent(ua);

  try {
    await prisma.blogView.create({
      data: {
        postId: post.id,
        ipHash,
        userAgent: ua?.slice(0, 300) ?? null,
        referrer: referrer?.slice(0, 500) ?? null,
        locale,
        isBot,
        viewDay,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // A row already exists for (postId, ipHash, viewDay). If a BOT claimed the
      // daily-unique slot first and this request is a human, upgrade the row to
      // human and count it once — otherwise a bot from a shared/CGNAT IP would
      // permanently suppress the human view for everyone behind that IP. Human-
      // then-human stays deduped; we never downgrade a human row to bot.
      if (!isBot) {
        const existing = await prisma.blogView.findFirst({
          where: { postId: post.id, ipHash, viewDay },
          select: { id: true, isBot: true },
        });
        if (existing?.isBot) {
          await prisma.blogView.update({ where: { id: existing.id }, data: { isBot: false } });
          await prisma.blogPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } });
        }
      }
      return new NextResponse(null, { status: 204 });
    }
    throw e;
  }

  // Denormalized counter for the public-facing card. Bots are excluded
  // so the public number reflects humans, and duplicates have already
  // returned above.
  if (!isBot) {
    await prisma.blogPost.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    });
  }

  return new NextResponse(null, { status: 204 });
}

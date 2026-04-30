/**
 * POST /api/blog/revalidate
 *
 * HMAC-protected webhook the admin app calls after publish/update/
 * delete. Invalidates the public Next.js cache for every surface
 * that materializes blog content. The admin retries on failure but
 * the function is idempotent so a duplicate call costs nothing.
 *
 * Auth: HMAC-SHA256 signature with `INTERNAL_WEBHOOK_SECRET`, plus a
 * five-minute timestamp window to reduce replay risk.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHmac, timingSafeEqual } from "crypto";
import { pingIndexNow } from "@/lib/blog/indexnow";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function expectedSignature(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;
}

function isFreshTimestamp(value: string): boolean {
  const ts = Number(value);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() / 1000 - ts) <= 300;
}

export async function POST(req: NextRequest) {
  const expected = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const timestamp = req.headers.get("x-internal-webhook-timestamp") ?? "";
  const signature = req.headers.get("x-internal-webhook-signature") ?? "";
  const rawBody = await req.text();
  if (
    !timestamp ||
    !signature ||
    !isFreshTimestamp(timestamp) ||
    !safeEqual(signature, expectedSignature(expected, timestamp, rawBody))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { slug?: string | null; locale?: string | null } = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    /* body optional */
  }

  // Always invalidate the surfaces that aggregate posts.
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  revalidatePath("/blog/feed.xml");
  revalidatePath("/blog/atom.xml");
  revalidatePath("/"); // homepage "latest" section

  if (body.slug) {
    revalidatePath(`/blog/${body.slug}`);

    // Fire-and-forget: tell Bing/Yandex we just updated this URL plus
    // the index page. No-op when INDEXNOW_KEY is unset (dev) or when
    // the appUrl is missing.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    if (appUrl) {
      const localeQuery = body.locale === "es" ? "?locale=es" : "";
      void pingIndexNow([
        `${appUrl}/blog/${body.slug}${localeQuery}`,
        `${appUrl}/blog`,
      ]);
    }
  }

  return NextResponse.json({ ok: true });
}

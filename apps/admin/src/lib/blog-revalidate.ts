/**
 * Tell the public web app (Next.js cache) that a post changed.
 *
 * Admin and web are separate Next.js processes behind Caddy, so we
 * cannot call `revalidatePath` directly across the boundary. Instead
 * we hit a public webhook (`/api/blog/revalidate`) protected by
 * an HMAC signature derived from `INTERNAL_WEBHOOK_SECRET`.
 *
 * Failures are logged but never block the publish flow; the next ISR
 * refresh (10 min) catches missed invalidations as a safety net.
 */

import { createHmac } from "crypto";

interface RevalidatePaths {
  /** Slug of the affected post (for /blog/<slug>). May be null on bulk ops. */
  slug?: string | null;
  /** Locale of the affected post — currently informational only. */
  locale?: string | null;
}

function signPayload(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;
}

export async function revalidatePublicBlog(input: RevalidatePaths = {}): Promise<void> {
  const webUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!webUrl || !secret) {
    console.warn("[blog-revalidate] skipped: NEXT_PUBLIC_APP_URL or INTERNAL_WEBHOOK_SECRET missing");
    return;
  }

  const target = `${webUrl.replace(/\/+$/, "")}/api/blog/revalidate`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({ slug: input.slug ?? null, locale: input.locale ?? null });

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-webhook-timestamp": timestamp,
        "x-internal-webhook-signature": signPayload(secret, timestamp, body),
      },
      body,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[blog-revalidate] non-200: ${res.status}`);
    }
  } catch (e) {
    console.warn("[blog-revalidate] error:", e);
  }
}

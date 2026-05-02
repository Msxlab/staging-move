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

export type RevalidateResult =
  | { ok: true }
  | { ok: false; reason: "config-missing" | "request-failed"; status?: number; detail?: string };

function signPayload(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;
}

export async function revalidatePublicBlog(input: RevalidatePaths = {}): Promise<RevalidateResult> {
  const webUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!webUrl || !secret) {
    // Misconfiguration here means publish appears to succeed but the
    // public site never refreshes until the 10-min ISR safety net
    // kicks in. Page ops via Sentry / console.error so the alert
    // pipeline picks it up.
    const detail = !webUrl ? "NEXT_PUBLIC_APP_URL missing" : "INTERNAL_WEBHOOK_SECRET missing";
    console.error(`[blog-revalidate] config error: ${detail}`);
    return { ok: false, reason: "config-missing", detail };
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
      console.error(`[blog-revalidate] non-200 from ${target}: ${res.status}`);
      return { ok: false, reason: "request-failed", status: res.status };
    }
    return { ok: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[blog-revalidate] error calling ${target}: ${detail}`);
    return { ok: false, reason: "request-failed", detail };
  }
}

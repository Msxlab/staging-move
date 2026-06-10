/**
 * Tell the public web app (Next.js cache) that the provider catalog changed.
 *
 * Admin and web are separate Next.js processes behind Caddy, so the admin's own
 * revalidateTag("providers") cannot reach the public cache. We hit a public
 * webhook (`/api/providers/revalidate`) protected by an HMAC signature derived
 * from INTERNAL_WEBHOOK_SECRET — the same scheme as blog-revalidate.
 *
 * Failures are logged but never block the admin mutation; the unstable_cache TTL
 * (≤1h) catches missed invalidations as a safety net.
 */

import { createHmac } from "crypto";
import { revalidateTag } from "next/cache";

/**
 * Invalidate the provider catalog EVERYWHERE after an admin mutation: the
 * admin-local Next cache tag AND (cross-app, best-effort) the public web cache
 * via the HMAC webhook. Call this from admin provider mutation routes instead of
 * a bare revalidateTag, which only ever reached the admin process.
 */
export function revalidateProvidersCatalog(): void {
  revalidateTag("providers", "default");
  void revalidatePublicProviders().catch(() => {});
}

export type RevalidateResult =
  | { ok: true }
  | { ok: false; reason: "config-missing" | "request-failed"; status?: number; detail?: string };

function signPayload(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export async function revalidatePublicProviders(): Promise<RevalidateResult> {
  const webUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!webUrl || !secret) {
    const detail = !webUrl ? "NEXT_PUBLIC_APP_URL missing" : "INTERNAL_WEBHOOK_SECRET missing";
    console.error(`[providers-revalidate] config error: ${detail}`);
    return { ok: false, reason: "config-missing", detail };
  }

  const target = `${webUrl.replace(/\/+$/, "")}/api/providers/revalidate`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = "{}";

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
      console.error(`[providers-revalidate] non-200 from ${target}: ${res.status}`);
      return { ok: false, reason: "request-failed", status: res.status };
    }
    return { ok: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[providers-revalidate] error calling ${target}: ${detail}`);
    return { ok: false, reason: "request-failed", detail };
  }
}

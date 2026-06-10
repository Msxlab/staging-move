/**
 * POST /api/providers/revalidate
 *
 * HMAC-protected webhook the admin app calls after a provider catalog mutation
 * (create / update / bulk / coverage / governance promote). Admin and web are
 * separate Next.js processes, so the admin's own revalidateTag("providers") can
 * never reach the public cache — without this hook a provider edit took up to an
 * hour (the unstable_cache TTL) to appear to users. Invalidating the shared
 * "providers" tag here refreshes both the /api/providers cache and the
 * /providers page. Idempotent — a duplicate call costs nothing.
 *
 * Auth: HMAC-SHA256 signature with INTERNAL_WEBHOOK_SECRET + a five-minute
 * timestamp window, identical to /api/blog/revalidate.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { createHmac, timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function expectedSignature(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
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

  // Both the /api/providers cache and the /providers page tag their
  // unstable_cache with "providers", so one tag invalidation covers both.
  revalidateTag("providers", "default");
  revalidatePath("/providers");

  return NextResponse.json({ ok: true });
}

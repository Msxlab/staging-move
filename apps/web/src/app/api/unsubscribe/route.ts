import { NextRequest, NextResponse } from "next/server";
import {
  parseUnsubscribeKind,
  verifyUnsubscribeToken,
} from "@/lib/unsubscribe";
import { processUnsubscribe } from "@/lib/unsubscribe-actions";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/unsubscribe — handles both:
 *
 * 1. Mail-client one-click (RFC 8058): body is form-encoded
 *    `List-Unsubscribe=One-Click`, optional ?t=token&k=kind in URL.
 * 2. The /unsubscribe page form post: body has token, kind in form data.
 *
 * On success returns 200 plain text "Unsubscribed" so mail clients show
 * a clean confirmation. We do not require auth — the HMAC token is the
 * proof of consent.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getRateLimitKey(request, "email:unsubscribe"), {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  let token = request.nextUrl.searchParams.get("t");
  let kindParam = request.nextUrl.searchParams.get("k");
  let isOneClick = false;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    try {
      const fd = await request.formData();
      // RFC 8058 one-click: body contains `List-Unsubscribe=One-Click`.
      if (fd.get("List-Unsubscribe") === "One-Click") isOneClick = true;
      const formToken = fd.get("t") || fd.get("token");
      const formKind = fd.get("k") || fd.get("kind");
      if (!token && typeof formToken === "string") token = formToken;
      if (!kindParam && typeof formKind === "string") kindParam = formKind;
    } catch {
      // Malformed body — fall through to invalid-token error below.
    }
  } else if (contentType.includes("application/json") && !token) {
    try {
      const body = await request.json();
      if (typeof body?.t === "string") token = body.t;
      if (typeof body?.k === "string") kindParam = body.k;
    } catch {
      // ignore
    }
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return new NextResponse("Invalid or expired unsubscribe link", { status: 400 });
  }

  const kind = parseUnsubscribeKind(kindParam);
  const ok = await processUnsubscribe({
    userId,
    kind,
    source: isOneClick ? "one_click" : "click",
  });
  if (!ok) {
    return new NextResponse("Account not found", { status: 404 });
  }

  return new NextResponse("Unsubscribed", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/**
 * GET /api/unsubscribe — JSON status check. Browsers should land on the
 * /unsubscribe page; this endpoint is for programmatic verification.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  return NextResponse.json({ valid: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * CCPA / CPRA "Do Not Sell or Share My Personal Information".
 *
 * California's CPRA (and the Colorado / Connecticut / Virginia state
 * equivalents) require a clearly-labeled opt-out mechanism accessible
 * WITHOUT forcing the consumer to create an account first. This
 * endpoint is that mechanism.
 *
 * Behavior:
 *   - Logged-in users: the preference is persisted to `DataConsent`
 *     under the `DO_NOT_SELL` category, following the same append-only
 *     audit pattern as other consent categories. `granted: true` on
 *     this category means "opted out — do not sell/share my data".
 *   - Anonymous users: the preference is persisted to a long-lived
 *     first-party cookie (`ccpa_opt_out`, 1-year TTL, httpOnly for
 *     integrity but NOT `secure` in dev). Business code that gates
 *     data-sharing logic should call `hasCcpaOptOut()` from
 *     `lib/ccpa.ts` which resolves both sources.
 *
 * The endpoint is idempotent: POST with `{ optOut: true }` multiple
 * times stays opt-out; POST with `{ optOut: false }` reverts (the CPRA
 * regulations allow the consumer to re-consent after an opt-out).
 */

const CCPA_COOKIE = "ccpa_opt_out";
const COOKIE_TTL_DAYS = 365;
const CONSENT_TEXT_VERSION = "2026-05-01";

const postSchema = z.object({
  optOut: z.boolean(),
});

export async function GET(request: NextRequest) {
  const session = await getUserSession().catch(() => null);

  if (session?.userId) {
    const latest = await prisma.dataConsent.findFirst({
      where: { userId: session.userId, category: "DO_NOT_SELL" },
      orderBy: { createdAt: "desc" },
      select: { granted: true, createdAt: true },
    });
    return NextResponse.json({
      source: "account",
      optOut: Boolean(latest?.granted),
      at: latest?.createdAt?.toISOString() ?? null,
      version: CONSENT_TEXT_VERSION,
    });
  }

  const cookieValue = request.cookies.get(CCPA_COOKIE)?.value;
  return NextResponse.json({
    source: "cookie",
    optOut: cookieValue === "1",
    at: null,
    version: CONSENT_TEXT_VERSION,
  });
}

export async function POST(request: NextRequest) {
  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.errors },
      { status: 400 },
    );
  }
  const { optOut } = parsed.data;

  const ip =
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;

  const session = await getUserSession().catch(() => null);

  if (session?.userId) {
    await prisma.dataConsent.create({
      data: {
        userId: session.userId,
        category: "DO_NOT_SELL",
        granted: optOut,
        version: CONSENT_TEXT_VERSION,
        ipAddress: ip,
        userAgent: userAgent?.slice(0, 500) ?? null,
      },
    });
  }

  // Always mirror the decision into the cookie so:
  //   1. Anonymous users' opt-out persists without a DB row.
  //   2. Logged-in users' front-end code can honor the opt-out before
  //      any API round trip (e.g. suppress third-party analytics
  //      snippets at page load).
  const response = NextResponse.json({ success: true, optOut });
  if (optOut) {
    response.cookies.set(CCPA_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_TTL_DAYS * 24 * 60 * 60,
      path: "/",
    });
  } else {
    response.cookies.delete(CCPA_COOKIE);
  }
  return response;
}

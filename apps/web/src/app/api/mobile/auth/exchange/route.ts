import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createUserSession,
  generateMobileFingerprint,
} from "@/lib/user-auth";
import { consumeMobileOAuthExchangeCode } from "@/lib/mobile-oauth";
import { labelMobileSession } from "@/lib/password-login";
import { resolveClientIP } from "@/lib/rate-limit";
import { enforceRateLimitPolicy, stableRateLimitHash } from "@/lib/rate-limit-policy";

export const runtime = "nodejs";

const exchangeSchema = z.object({
  code: z.string().min(16).max(300),
  // Required PKCE code_verifier. Mobile OAuth init requires a code_challenge and
  // every exchange must prove possession of the matching verifier before a
  // session token can be minted.
  code_verifier: z
    .string()
    .min(43)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = exchangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 });
  }

  const [clientRl, codeRl] = await Promise.all([
    enforceRateLimitPolicy(request, "mobile_oauth_exchange", {
      routeId: "mobile_oauth_exchange",
      clientType: "mobile",
    }),
    enforceRateLimitPolicy(request, "mobile_oauth_exchange", {
      routeId: "mobile_oauth_code",
      clientType: "mobile",
      extra: stableRateLimitHash(parsed.data.code),
    }),
  ]);
  if (!clientRl.success || !codeRl.success) {
    const blocked = !clientRl.success ? clientRl : codeRl;
    return NextResponse.json(
      {
        code: blocked.policy.userFacingErrorCode,
        error: "Too many attempts. Please try again shortly.",
      },
      { status: 429, headers: { "Retry-After": String(blocked.retryAfterSeconds) } },
    );
  }

  const exchanged = await consumeMobileOAuthExchangeCode(parsed.data.code, {
    codeVerifier: parsed.data.code_verifier,
  });
  if (!exchanged.ok) {
    const status = exchanged.error === "ACCOUNT_UNAVAILABLE" ? 403 : 400;
    return NextResponse.json({ error: "OAuth handoff could not be completed.", code: exchanged.error }, { status });
  }

  const ua = request.headers.get("user-agent") || "";
  const ip = resolveClientIP(request);
  const fingerprint = await generateMobileFingerprint(ua);
  // Label native sessions ("LocateFlow iOS app" / "LocateFlow Android app")
  // instead of "Unknown browser". The native client sends no parseable UA, so
  // we trust the X-Client-Platform header first and fall back to UA sniffing.
  const mobileLabel = labelMobileSession(ua, request.headers.get("x-client-platform"));
  const token = await createUserSession({
    userId: exchanged.user.id,
    email: exchanged.user.email,
    fingerprint,
    clientType: "mobile",
    ipAddress: ip,
    userAgent: ua,
    deviceType: "Mobile",
    browser: mobileLabel.browser,
    os: mobileLabel.os,
  });

  const hasPasswordLogin = Boolean(exchanged.user.passwordHash);
  return NextResponse.json({
    success: true,
    token,
    user: {
      id: exchanged.user.id,
      email: exchanged.user.email,
      firstName: exchanged.user.firstName,
      lastName: exchanged.user.lastName,
      imageUrl: exchanged.user.imageUrl,
      emailVerified: Boolean(exchanged.user.emailVerifiedAt),
      hasPasswordLogin,
      // OAuth exchange always implies the caller signed in via Google/Apple,
      // so any user shaped here has at least one linked OAuth account.
      needsPasswordSetup: !hasPasswordLogin,
      mfaEnabled: exchanged.user.mfaEnabled,
    },
  });
}

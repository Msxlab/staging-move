import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createUserSession,
  generateMobileFingerprint,
} from "@/lib/user-auth";
import { consumeMobileOAuthExchangeCode } from "@/lib/mobile-oauth";
import { getRateLimitKey, rateLimit, resolveClientIP } from "@/lib/rate-limit";

export const runtime = "nodejs";

const exchangeSchema = z.object({
  code: z.string().min(16).max(300),
  // Optional PKCE code_verifier. New mobile builds always send this;
  // older builds omit it. The server enforces presence based on the
  // MobileOAuthCode row's stored codeChallenge — see
  // consumeMobileOAuthExchangeCode for the policy.
  code_verifier: z
    .string()
    .min(43)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getRateLimitKey(request, "mobile:oauth:exchange"), {
    limit: 20,
    windowSeconds: 60,
    failClosed: true,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many attempts. Please try again shortly." }, { status: 429 });
  }

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
  const token = await createUserSession({
    userId: exchanged.user.id,
    email: exchanged.user.email,
    fingerprint,
    clientType: "mobile",
    ipAddress: ip,
    userAgent: ua,
    deviceType: "Mobile",
  });

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
      mfaEnabled: exchanged.user.mfaEnabled,
    },
  });
}

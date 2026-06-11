import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  createUserSession,
  findOrLinkOAuthUserWithStatus,
  generateMobileFingerprint,
} from "@/lib/user-auth";
import {
  hashForOAuthLog,
  isAppleEmailVerifiedClaim,
  logSafeOAuthEvent,
  summarizeOAuthError,
} from "@/lib/oauth";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { labelMobileSession } from "@/lib/password-login";
import { normalizeAcceptedLegalConsents, recordLegalAcceptance } from "@/lib/legal-acceptance";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { resolveClientIP } from "@/lib/rate-limit";

export const runtime = "nodejs";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

const fullNameSchema = z
  .object({
    givenName: z.string().max(100).nullable().optional(),
    familyName: z.string().max(100).nullable().optional(),
  })
  .nullable()
  .optional();

const bodySchema = z.object({
  identityToken: z.string().min(40).max(4096),
  // Apple `authorizationCode` is only useful server-side for token revocation;
  // we accept it but do not currently exchange it (mobile keeps the identity
  // token only). The revocation token exchange can be added later without a
  // client change.
  authorizationCode: z.string().max(512).nullable().optional(),
  nonce: z.string().max(256).nullable().optional(),
  user: z.string().max(64).nullable().optional(),
  fullName: fullNameSchema,
  email: z.string().email().max(320).nullable().optional(),
  legalConsents: z
    .object({
      termsAccepted: z.boolean(),
      disclaimerAccepted: z.boolean(),
      termsVersion: z.string().optional(),
      disclaimerVersion: z.string().optional(),
      acceptedAt: z.string().optional(),
    })
    .nullable()
    .optional(),
});

function failApple(stage: string, err: unknown) {
  logSafeOAuthEvent(`mobile_apple_native_${stage}_failed`, summarizeOAuthError(err));
}

function shapeUser(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  mfaEnabled: boolean;
}) {
  const hasPasswordLogin = Boolean(user.passwordHash);
  // Apple-native flow always links an oauthAccount for this user before we
  // shape the response, so any user shaped here has at least one OAuth
  // account by construction.
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPasswordLogin,
    needsPasswordSetup: !hasPasswordLogin,
    mfaEnabled: user.mfaEnabled,
  };
}

/**
 * POST /api/mobile/auth/apple/native
 *
 * Native Sign in with Apple handoff for the iOS mobile app. Replaces the
 * Safari-View-Controller round-trip with a direct identityToken verification
 * against Apple's JWKS, then issues a mobile session JWT in the same shape
 * the web OAuth handoff already returns through /api/mobile/auth/exchange.
 *
 * Trust model:
 *  - The Apple identityToken is the only credential trusted from the client.
 *    Apple signs it; we verify the signature against the public JWKS, the
 *    `iss`, and our `aud` (the bundle ID, served from Apple OAuth config).
 *  - First-sign-in only: Apple emits `email` and `fullName` once. Subsequent
 *    sign-ins return only `sub` (the stable Apple user identifier).
 *  - Private relay (`@privaterelay.appleid.com`) is treated like any other
 *    email and stored as-is so users can revoke the relay link from
 *    Apple ID without orphaning their account record.
 */
export async function POST(request: NextRequest) {
  const clientRl = await enforceRateLimitPolicy(request, "mobile_oauth_exchange", {
    routeId: "mobile_apple_native",
    clientType: "mobile",
  });
  if (!clientRl.success) {
    return NextResponse.json(
      {
        code: clientRl.policy.userFacingErrorCode,
        error: "Too many sign-in attempts. Please try again shortly.",
      },
      { status: 429, headers: { "Retry-After": String(clientRl.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const audience = await getRuntimeConfigValue("APPLE_BUNDLE_ID");
  if (!audience) {
    return NextResponse.json(
      { error: "Apple sign-in is not configured for this environment." },
      { status: 503 },
    );
  }

  let payload: {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    nonce?: string;
    is_private_email?: boolean | string;
  };
  try {
    const { payload: verified } = await jwtVerify(parsed.data.identityToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience,
    });
    payload = verified as typeof payload;
  } catch (err) {
    failApple("token_verify", err);
    return NextResponse.json({ error: "Invalid Apple identity token." }, { status: 401 });
  }

  if (!payload.sub) {
    return NextResponse.json({ error: "Apple identity token is missing subject." }, { status: 401 });
  }

  // Apple includes the nonce hashed on the server side when the client passed
  // a nonce in `signInAsync`. We accept either presence (recommended for new
  // clients) or absence (older expo-apple-authentication releases that did
  // not surface the nonce). When provided, ensure the values match.
  if (parsed.data.nonce && payload.nonce && parsed.data.nonce !== payload.nonce) {
    failApple("nonce_mismatch", new Error("nonce mismatch"));
    return NextResponse.json({ error: "Apple sign-in nonce mismatch." }, { status: 401 });
  }

  // Apple's `sub` is the stable per-app user identifier. Prefer the client-
  // supplied `user` field only when it matches (sanity check), never as a
  // substitute for the verified token claim.
  if (parsed.data.user && parsed.data.user !== payload.sub) {
    failApple("subject_mismatch", new Error("client subject mismatch"));
    return NextResponse.json({ error: "Apple identity token subject mismatch." }, { status: 401 });
  }

  // Resolve the email. First sign-in: Apple may return `email` in the token.
  // Subsequent sign-ins: the token won't carry an email, so we look up the
  // existing OAuth link by sub and reuse the previously-stored email. We do
  // NOT trust the client's `email` field as authoritative — Apple is the
  // only source of truth for first-sign-in, and the DB is the source for
  // returning users.
  let email = typeof payload.email === "string" && payload.email.length > 0
    ? payload.email
    : null;

  let emailFromExistingLink: string | null = null;
  if (!email) {
    const existing = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider: "apple", providerId: payload.sub } },
      select: { user: { select: { email: true } } },
    });
    emailFromExistingLink = existing?.user?.email ?? null;
    email = emailFromExistingLink;
  }

  if (!email) {
    // First sign-in must include an email claim. If Apple withheld the email
    // (Hide My Email + no relay mapping configured) we cannot create the
    // account.
    return NextResponse.json(
      { error: "Apple did not return an email address. Please retry sign-in." },
      { status: 400 },
    );
  }

  // The email_verified claim only appears on first sign-in (the same trip the
  // email arrives on). When we reuse the stored email for a returning user,
  // we already trust it from prior verification.
  if (
    !emailFromExistingLink &&
    !isAppleEmailVerifiedClaim(payload.email_verified)
  ) {
    logSafeOAuthEvent("mobile_apple_native_email_unverified", {
      emailHash: hashForOAuthLog(email),
    });
    return NextResponse.json(
      { error: "Apple email is not verified." },
      { status: 400 },
    );
  }

  const firstName = parsed.data.fullName?.givenName ?? null;
  const lastName = parsed.data.fullName?.familyName ?? null;

  let userId: string;
  try {
    const linkedUser = await findOrLinkOAuthUserWithStatus({
      provider: "apple",
      providerId: payload.sub,
      email,
      firstName,
      lastName,
      allowNewAccount: true,
    });
    userId = linkedUser.userId;
  } catch (err: unknown) {
    const message = (err as { message?: string } | null)?.message;
    if (message === "LEGAL_ACCEPTANCE_REQUIRED") {
      return NextResponse.json(
        { error: "Legal acceptance required.", code: "LEGAL_ACCEPTANCE_REQUIRED" },
        { status: 409 },
      );
    }
    if (message === "OAUTH_EXISTING_DELETED_USER_BLOCKED") {
      return NextResponse.json(
        { error: "This Apple account is no longer available.", code: "ACCOUNT_UNAVAILABLE" },
        { status: 403 },
      );
    }
    if (message === "OAUTH_ACCOUNT_CREATE_FAILED") {
      return NextResponse.json(
        { error: "Could not create an account from this Apple sign-in.", code: "OAUTH_ACCOUNT_CREATE_FAILED" },
        { status: 500 },
      );
    }
    if (message === "SIGNUPS_PAUSED") {
      // SEC-KILL: operator kill switch paused new signups (existing users
      // still sign in — only brand-new account creation is blocked).
      return NextResponse.json(
        { error: "New signups are temporarily paused. Please try again later.", code: "SIGNUPS_PAUSED" },
        { status: 503, headers: { "Retry-After": "3600" } },
      );
    }
    failApple("user_link", err);
    return NextResponse.json(
      { error: "Apple sign-in could not be completed." },
      { status: 500 },
    );
  }

  const acceptedLegalConsents = normalizeAcceptedLegalConsents(parsed.data.legalConsents);
  if (acceptedLegalConsents) {
    try {
      await recordLegalAcceptance({
        userId,
        request,
        page: "/sign-up?provider=apple",
        source: "mobile_apple_native_signup",
        consents: acceptedLegalConsents,
      });
    } catch (err) {
      failApple("legal_acceptance", err);
      return NextResponse.json(
        { error: "Apple sign-in completed but legal acceptance could not be recorded." },
        { status: 500 },
      );
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      imageUrl: true,
      emailVerifiedAt: true,
      passwordHash: true,
      mfaEnabled: true,
    },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Apple sign-in completed but the user record was not found." },
      { status: 500 },
    );
  }

  const ua = request.headers.get("user-agent") || "";
  const ip = resolveClientIP(request);
  const fingerprint = await generateMobileFingerprint(ua);
  // Label native sessions ("LocateFlow iOS app") instead of "Unknown browser".
  // This is the Apple-native iOS handoff, but we still honor X-Client-Platform
  // and fall back to UA sniffing for robustness.
  const mobileLabel = labelMobileSession(ua, request.headers.get("x-client-platform"));
  const token = await createUserSession({
    userId: user.id,
    email: user.email,
    fingerprint,
    clientType: "mobile",
    ipAddress: ip,
    userAgent: ua,
    deviceType: "Mobile",
    browser: mobileLabel.browser,
    os: mobileLabel.os,
  });

  return NextResponse.json({
    success: true,
    token,
    user: shapeUser(user),
  });
}

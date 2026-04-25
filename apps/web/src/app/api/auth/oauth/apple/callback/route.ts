import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { exchangeAppleCode, getAppleOAuthCredentials, getRuntimeBaseUrl } from "@/lib/oauth";
import { createUserSession, findOrLinkOAuthUser, generateFingerprint } from "@/lib/user-auth";
import {
  OAUTH_LEGAL_ACCEPTANCE_COOKIE,
  recordLegalAcceptance,
} from "@/lib/legal-acceptance";

export const runtime = "nodejs";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

/**
 * Apple calls back with POST form_post when scope was requested.
 * On the FIRST login only, Apple includes a `user` JSON field with
 * { name: { firstName, lastName }, email }. Subsequent logins do NOT
 * include name info, so we persist it on first sight.
 */
async function readFormField(request: NextRequest, field: string): Promise<string | null> {
  try {
    const fd = await request.formData();
    const v = fd.get(field);
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { clientId, teamId, keyId, privateKeyPem } = await getAppleOAuthCredentials();
  if (!clientId || !teamId || !keyId || !privateKeyPem) {
    return NextResponse.redirect(new URL("/sign-in?error=apple-not-configured", request.url));
  }

  // form_post can only be consumed once — clone so we can read multiple fields.
  const fd = await request.formData().catch(() => null);
  if (!fd) return NextResponse.redirect(new URL("/sign-in?error=apple-bad-body", request.url));

  const code = fd.get("code");
  const state = fd.get("state");
  const userField = fd.get("user"); // only present on first sign-in

  if (typeof code !== "string" || typeof state !== "string") {
    return NextResponse.redirect(new URL("/sign-in?error=apple-missing-fields", request.url));
  }

  const cookieState = request.cookies.get("oauth_state_apple")?.value;
  const redirectPath = request.cookies.get("oauth_redirect")?.value || "/dashboard";
  const acceptedLegal = request.cookies.get(OAUTH_LEGAL_ACCEPTANCE_COOKIE)?.value === "accepted";
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL("/sign-in?error=state-mismatch", request.url));
  }

  const tokens = await exchangeAppleCode({
    code,
    redirectUri: `${await getRuntimeBaseUrl()}/api/auth/oauth/apple/callback`,
    clientId, teamId, keyId, privateKeyPem,
  });
  if (!tokens?.idToken) {
    return NextResponse.redirect(new URL("/sign-in?error=token-exchange-failed", request.url));
  }

  let payload: { sub: string; email?: string; email_verified?: boolean | string };
  try {
    const { payload: verified } = await jwtVerify(tokens.idToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: clientId,
    });
    payload = verified as any;
  } catch (err) {
    console.error("[OAUTH] apple id_token verify failed:", err);
    return NextResponse.redirect(new URL("/sign-in?error=invalid-token", request.url));
  }

  if (!payload.email) {
    // Apple may withhold email if user chose "Hide My Email" and we don't have
    // the private-relay mapping. For MVP, require a real email.
    return NextResponse.redirect(new URL("/sign-in?error=apple-no-email", request.url));
  }

  // First-login name info.
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (typeof userField === "string") {
    try {
      const parsedUser = JSON.parse(userField);
      firstName = parsedUser?.name?.firstName ?? null;
      lastName = parsedUser?.name?.lastName ?? null;
    } catch {
      /* ignore malformed */
    }
  }

  let userId: string;
  try {
    userId = await findOrLinkOAuthUser({
      provider: "apple",
      providerId: payload.sub,
      email: payload.email,
      firstName,
      lastName,
      allowNewAccount: acceptedLegal,
    });
  } catch (err: any) {
    if (err?.message === "LEGAL_ACCEPTANCE_REQUIRED") {
      const response = NextResponse.redirect(new URL("/sign-up?error=legal-acceptance-required", request.url));
      response.cookies.delete("oauth_state_apple");
      response.cookies.delete("oauth_redirect");
      response.cookies.delete(OAUTH_LEGAL_ACCEPTANCE_COOKIE);
      return response;
    }
    throw err;
  }

  if (acceptedLegal) {
    await recordLegalAcceptance({
      userId,
      request,
      page: "/sign-up",
      source: "apple_oauth_signup",
    });
  }

  const ua = request.headers.get("user-agent") || "";
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const fp = await generateFingerprint(ip, ua);
  await createUserSession({
    userId, email: payload.email, fingerprint: fp, ipAddress: ip, userAgent: ua,
  });

  const response = NextResponse.redirect(new URL(redirectPath, request.url));
  response.cookies.delete("oauth_state_apple");
  response.cookies.delete("oauth_redirect");
  response.cookies.delete(OAUTH_LEGAL_ACCEPTANCE_COOKIE);
  return response;
}

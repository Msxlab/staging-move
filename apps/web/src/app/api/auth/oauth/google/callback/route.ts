import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import {
  exchangeGoogleCode,
  getRuntimeBaseUrl,
  type GoogleIdTokenPayload,
} from "@/lib/oauth";
import { createUserSession, findOrLinkOAuthUser, generateFingerprint } from "@/lib/user-auth";

export const runtime = "nodejs";

const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/sign-in?error=google-not-configured", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");
  if (errorParam) {
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(errorParam)}`, request.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/sign-in?error=missing-code", request.url));
  }

  const cookieState = request.cookies.get("oauth_state_google")?.value;
  const pkceVerifier = request.cookies.get("oauth_pkce_google")?.value;
  const redirectPath = request.cookies.get("oauth_redirect")?.value || "/dashboard";
  if (!cookieState || !pkceVerifier || cookieState !== state) {
    return NextResponse.redirect(new URL("/sign-in?error=state-mismatch", request.url));
  }

  const redirectUri = `${await getRuntimeBaseUrl()}/api/auth/oauth/google/callback`;
  const tokens = await exchangeGoogleCode({
    code, clientId, clientSecret, redirectUri, pkceVerifier,
  });
  if (!tokens?.idToken) {
    return NextResponse.redirect(new URL("/sign-in?error=token-exchange-failed", request.url));
  }

  // Verify id_token signature + iss + aud.
  let payload: GoogleIdTokenPayload;
  try {
    const { payload: verified } = await jwtVerify(tokens.idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUER,
      audience: clientId,
    });
    payload = verified as unknown as GoogleIdTokenPayload;
  } catch (err) {
    console.error("[OAUTH] google id_token verify failed:", err);
    return NextResponse.redirect(new URL("/sign-in?error=invalid-token", request.url));
  }

  if (!payload.email || !payload.email_verified) {
    return NextResponse.redirect(new URL("/sign-in?error=email-unverified", request.url));
  }

  const userId = await findOrLinkOAuthUser({
    provider: "google",
    providerId: payload.sub,
    email: payload.email,
    firstName: payload.given_name,
    lastName: payload.family_name,
    imageUrl: payload.picture,
  });

  const ua = request.headers.get("user-agent") || "";
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const fp = await generateFingerprint(ip, ua);
  await createUserSession({
    userId, email: payload.email, fingerprint: fp, ipAddress: ip, userAgent: ua,
  });

  const response = NextResponse.redirect(new URL(redirectPath, request.url));
  response.cookies.delete("oauth_state_google");
  response.cookies.delete("oauth_pkce_google");
  response.cookies.delete("oauth_redirect");
  return response;
}

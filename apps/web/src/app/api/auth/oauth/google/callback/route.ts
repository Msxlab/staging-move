import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import {
  exchangeGoogleCode,
  getGoogleOAuthCredentials,
  getOAuthRedirectUri,
  type GoogleIdTokenPayload,
} from "@/lib/oauth";
import { createUserSession, findOrLinkOAuthUser, generateFingerprint } from "@/lib/user-auth";
import {
  OAUTH_LEGAL_ACCEPTANCE_COOKIE,
  recordLegalAcceptance,
} from "@/lib/legal-acceptance";

export const runtime = "nodejs";

const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function GET(request: NextRequest) {
  const { clientId, clientSecret } = await getGoogleOAuthCredentials();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=google-not-configured"));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");
  if (errorParam) {
    return NextResponse.redirect(
      await getOAuthResponseUrl(request, `/sign-in?error=${encodeURIComponent(errorParam)}`),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=missing-code"));
  }

  const cookieState = request.cookies.get("oauth_state_google")?.value;
  const pkceVerifier = request.cookies.get("oauth_pkce_google")?.value;
  const cookieRedirectUri = request.cookies.get("oauth_redirect_uri_google")?.value;
  const redirectPath = request.cookies.get("oauth_redirect")?.value || "/dashboard";
  const acceptedLegal = request.cookies.get(OAUTH_LEGAL_ACCEPTANCE_COOKIE)?.value === "accepted";
  if (!cookieState || !pkceVerifier || cookieState !== state) {
    return NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=state-mismatch"));
  }

  const redirectUri = cookieRedirectUri || await getOAuthRedirectUri(request, "/api/auth/oauth/google/callback");
  const tokens = await exchangeGoogleCode({
    code, clientId, clientSecret, redirectUri, pkceVerifier,
  });
  if (!tokens?.idToken) {
    return NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=token-exchange-failed"));
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
    return NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=invalid-token"));
  }

  if (!payload.email || !payload.email_verified) {
    return NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=email-unverified"));
  }

  let userId: string;
  try {
    userId = await findOrLinkOAuthUser({
      provider: "google",
      providerId: payload.sub,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
      imageUrl: payload.picture,
      allowNewAccount: acceptedLegal,
    });
  } catch (err: any) {
    if (err?.message === "LEGAL_ACCEPTANCE_REQUIRED") {
      const response = NextResponse.redirect(
        await getOAuthResponseUrl(request, "/sign-up?error=legal-acceptance-required"),
      );
      response.cookies.delete("oauth_state_google");
      response.cookies.delete("oauth_pkce_google");
      response.cookies.delete("oauth_redirect_uri_google");
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
      source: "google_oauth_signup",
    });
  }

  const ua = request.headers.get("user-agent") || "";
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const fp = await generateFingerprint(ip, ua);
  await createUserSession({
    userId, email: payload.email, fingerprint: fp, ipAddress: ip, userAgent: ua,
  });

  const response = NextResponse.redirect(await getOAuthResponseUrl(request, redirectPath));
  response.cookies.delete("oauth_state_google");
  response.cookies.delete("oauth_pkce_google");
  response.cookies.delete("oauth_redirect_uri_google");
  response.cookies.delete("oauth_redirect");
  response.cookies.delete(OAUTH_LEGAL_ACCEPTANCE_COOKIE);
  return response;
}

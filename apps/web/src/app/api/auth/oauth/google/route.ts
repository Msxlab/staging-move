import { NextRequest, NextResponse } from "next/server";
import {
  googleAuthorizeUrl,
  generateState,
  generatePkce,
  getGoogleOAuthCredentials,
  getOAuthRedirectUri,
} from "@/lib/oauth";
import { OAUTH_LEGAL_ACCEPTANCE_COOKIE } from "@/lib/legal-acceptance";

export const runtime = "nodejs";

/**
 * GET /api/auth/oauth/google
 *
 * Kicks off Google OAuth. Stores state + PKCE verifier in httpOnly cookies
 * so the callback can validate + finish the flow.
 *
 * Accepts an optional `?redirect=/dashboard` to land the user somewhere
 * specific after successful login.
 */
export async function GET(request: NextRequest) {
  const { clientId, clientSecret } = await getGoogleOAuthCredentials();
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
  }

  const state = generateState();
  const pkce = generatePkce();
  const redirectUri = await getOAuthRedirectUri(request, "/api/auth/oauth/google/callback");

  const rawRedirect = request.nextUrl.searchParams.get("redirect") || "/dashboard";
  const acceptedLegal = request.nextUrl.searchParams.get("acceptLegal") === "true";
  // Only allow same-site relative redirects.
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";

  const url = googleAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    pkceChallenge: pkce.challenge,
  });

  const res = NextResponse.redirect(url);
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60, // 10 min
  };
  res.cookies.set("oauth_state_google", state, cookieOpts);
  res.cookies.set("oauth_pkce_google", pkce.verifier, cookieOpts);
  res.cookies.set("oauth_redirect_uri_google", redirectUri, cookieOpts);
  res.cookies.set("oauth_redirect", safeRedirect, cookieOpts);
  if (acceptedLegal) {
    res.cookies.set(OAUTH_LEGAL_ACCEPTANCE_COOKIE, "accepted", cookieOpts);
  }
  return res;
}

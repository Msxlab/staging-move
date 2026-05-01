import { NextRequest, NextResponse } from "next/server";
import {
  appleAuthorizeUrl,
  generateState,
  getAppleOAuthCredentials,
  getOAuthRedirectUri,
  normalizeOAuthRedirectPath,
} from "@/lib/oauth";
import { shouldUseSecureSessionCookies } from "@/lib/user-auth";
import {
  MOBILE_OAUTH_CLIENT_COOKIE,
  MOBILE_OAUTH_PKCE_CHALLENGE_COOKIE,
  MOBILE_OAUTH_REDIRECT_COOKIE,
  MOBILE_OAUTH_STATE_COOKIE,
  isMobileOAuthClient,
  normalizeMobileOAuthCodeChallenge,
  normalizeMobileOAuthRedirectUri,
  normalizeMobileOAuthState,
} from "@/lib/mobile-oauth";

export const runtime = "nodejs";

/**
 * GET /api/auth/oauth/apple — initiate Sign in with Apple.
 * Apple posts back to the callback with form_post; state is checked via cookie.
 */
export async function GET(request: NextRequest) {
  const { clientId } = await getAppleOAuthCredentials();
  if (!clientId) {
    return NextResponse.json({ error: "Apple sign-in is not configured." }, { status: 503 });
  }

  const state = generateState();
  const redirectUri = await getOAuthRedirectUri(request, "/api/auth/oauth/apple/callback");

  const rawRedirect = request.nextUrl.searchParams.get("redirect") || "/dashboard";
  const safeRedirect = normalizeOAuthRedirectPath(rawRedirect);
  const client = request.nextUrl.searchParams.get("client");
  const mobileRedirectUri = isMobileOAuthClient(client)
    ? normalizeMobileOAuthRedirectUri(request.nextUrl.searchParams.get("mobileRedirectUri"))
    : null;
  if (isMobileOAuthClient(client) && !mobileRedirectUri) {
    return NextResponse.json({ error: "Invalid mobile OAuth redirect URI." }, { status: 400 });
  }
  // PKCE challenge from the mobile client. Optional during the
  // backwards-compat window — see google/route.ts for rationale.
  const mobileCodeChallenge = isMobileOAuthClient(client)
    ? normalizeMobileOAuthCodeChallenge(request.nextUrl.searchParams.get("mobileCodeChallenge"))
    : null;
  const rawMobileState = request.nextUrl.searchParams.get("mobileState");
  const mobileState = isMobileOAuthClient(client)
    ? normalizeMobileOAuthState(rawMobileState)
    : null;
  if (isMobileOAuthClient(client) && rawMobileState && !mobileState) {
    return NextResponse.json({ error: "Invalid mobile OAuth state." }, { status: 400 });
  }

  const url = appleAuthorizeUrl({ clientId, redirectUri, state });

  const res = NextResponse.redirect(url);
  const secureCookie = shouldUseSecureSessionCookies();
  const cookieOpts = {
    httpOnly: true,
    secure: secureCookie,
    // Apple posts back cross-site — must be "none" + secure for the state cookie
    // to survive the form_post redirect. In dev we relax to "lax" so http://
    // localhost works without HTTPS.
    sameSite: (secureCookie ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: 10 * 60,
  };
  res.cookies.set("oauth_state_apple", state, cookieOpts);
  res.cookies.set("oauth_redirect_uri_apple", redirectUri, cookieOpts);
  res.cookies.set("oauth_redirect", safeRedirect, cookieOpts);
  if (mobileRedirectUri) {
    res.cookies.set(MOBILE_OAUTH_CLIENT_COOKIE, "mobile", cookieOpts);
    res.cookies.set(MOBILE_OAUTH_REDIRECT_COOKIE, mobileRedirectUri, cookieOpts);
    if (mobileCodeChallenge) {
      res.cookies.set(MOBILE_OAUTH_PKCE_CHALLENGE_COOKIE, mobileCodeChallenge, cookieOpts);
    }
    if (mobileState) {
      res.cookies.set(MOBILE_OAUTH_STATE_COOKIE, mobileState, cookieOpts);
    }
  }
  return res;
}

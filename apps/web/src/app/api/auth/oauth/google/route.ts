import { NextRequest, NextResponse } from "next/server";
import {
  googleAuthorizeUrl,
  generateState,
  generatePkce,
  getGoogleOAuthCredentials,
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
  const safeRedirect = normalizeOAuthRedirectPath(rawRedirect);
  const client = request.nextUrl.searchParams.get("client");
  const mobileRedirectUri = isMobileOAuthClient(client)
    ? normalizeMobileOAuthRedirectUri(request.nextUrl.searchParams.get("mobileRedirectUri"))
    : null;
  if (isMobileOAuthClient(client) && !mobileRedirectUri) {
    return NextResponse.json({ error: "Invalid mobile OAuth redirect URI." }, { status: 400 });
  }
  // PKCE challenge from the mobile client. Optional during the
  // backwards-compat window — older mobile builds will simply omit it
  // and skip the second-factor verifier check at exchange time.
  const mobileCodeChallenge = isMobileOAuthClient(client)
    ? normalizeMobileOAuthCodeChallenge(request.nextUrl.searchParams.get("mobileCodeChallenge"))
    : null;
  if (isMobileOAuthClient(client) && !mobileCodeChallenge) {
    return NextResponse.json({ error: "Mobile OAuth PKCE challenge is required." }, { status: 400 });
  }
  const rawMobileState = request.nextUrl.searchParams.get("mobileState");
  const mobileState = isMobileOAuthClient(client)
    ? normalizeMobileOAuthState(rawMobileState)
    : null;
  if (isMobileOAuthClient(client) && rawMobileState && !mobileState) {
    return NextResponse.json({ error: "Invalid mobile OAuth state." }, { status: 400 });
  }

  const url = googleAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    pkceChallenge: pkce.challenge,
  });

  const res = NextResponse.redirect(url);
  const cookieOpts = {
    httpOnly: true,
    secure: shouldUseSecureSessionCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60, // 10 min
  };
  res.cookies.set("oauth_state_google", state, cookieOpts);
  res.cookies.set("oauth_pkce_google", pkce.verifier, cookieOpts);
  res.cookies.set("oauth_redirect_uri_google", redirectUri, cookieOpts);
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

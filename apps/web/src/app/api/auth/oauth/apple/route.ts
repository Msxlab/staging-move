import { NextRequest, NextResponse } from "next/server";
import {
  appleAuthorizeUrl,
  generateState,
  getAppleOAuthCredentials,
  getOAuthRedirectUri,
  normalizeOAuthRedirectPath,
} from "@/lib/oauth";
import { shouldUseSecureSessionCookies } from "@/lib/user-auth";

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
  return res;
}

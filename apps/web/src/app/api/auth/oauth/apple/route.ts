import { NextRequest, NextResponse } from "next/server";
import {
  appleAuthorizeUrl,
  generateState,
  getAppleOAuthCredentials,
} from "@/lib/oauth";
import { OAUTH_LEGAL_ACCEPTANCE_COOKIE } from "@/lib/legal-acceptance";

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
  const redirectUri = `${request.nextUrl.origin}/api/auth/oauth/apple/callback`;

  const rawRedirect = request.nextUrl.searchParams.get("redirect") || "/dashboard";
  const acceptedLegal = request.nextUrl.searchParams.get("acceptLegal") === "true";
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";

  const url = appleAuthorizeUrl({ clientId, redirectUri, state });

  const res = NextResponse.redirect(url);
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Apple posts back cross-site — must be "none" + secure for the state cookie
    // to survive the form_post redirect. In dev we relax to "lax" so http://
    // localhost works without HTTPS.
    sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: 10 * 60,
  };
  res.cookies.set("oauth_state_apple", state, cookieOpts);
  res.cookies.set("oauth_redirect", safeRedirect, cookieOpts);
  if (acceptedLegal) {
    res.cookies.set(OAUTH_LEGAL_ACCEPTANCE_COOKIE, "accepted", cookieOpts);
  }
  return res;
}

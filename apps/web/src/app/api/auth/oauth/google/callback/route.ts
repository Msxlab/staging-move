import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import {
  exchangeGoogleCode,
  getGoogleOAuthCredentials,
  getOAuthRedirectUri,
  getOAuthResponseUrl,
  normalizeOAuthRedirectPath,
  type GoogleIdTokenPayload,
} from "@/lib/oauth";
import {
  createUserSession,
  findOrLinkOAuthUserWithStatus,
  generateFingerprint,
} from "@/lib/user-auth";
import {
  OAUTH_LEGAL_ACCEPTANCE_COOKIE,
  recordLegalAcceptance,
} from "@/lib/legal-acceptance";
import { sendWelcomeEmail } from "@/lib/email-service";
import { getRateLimitKey, rateLimit, resolveClientIP } from "@/lib/rate-limit";

export const runtime = "nodejs";

const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function clearGoogleOAuthCookies(response: NextResponse) {
  response.cookies.delete("oauth_state_google");
  response.cookies.delete("oauth_pkce_google");
  response.cookies.delete("oauth_redirect_uri_google");
  response.cookies.delete("oauth_redirect");
  response.cookies.delete(OAUTH_LEGAL_ACCEPTANCE_COOKIE);
  return response;
}

function logGoogleOAuthFailure(stage: string, err: unknown) {
  console.error(`[OAUTH] google ${stage} failed:`, err);
}

async function redirectWithClearedGoogleCookies(request: NextRequest, path: string) {
  return clearGoogleOAuthCookies(NextResponse.redirect(await getOAuthResponseUrl(request, path)));
}

export async function GET(request: NextRequest) {
  const rl = await rateLimit(getRateLimitKey(request, "auth:oauth:google:callback"), {
    limit: 30,
    windowSeconds: 60,
    failClosed: true,
  });
  if (!rl.success) {
    return redirectWithClearedGoogleCookies(request, "/sign-in?error=oauth-rate-limited");
  }

  const { clientId, clientSecret } = await getGoogleOAuthCredentials();
  if (!clientId || !clientSecret) {
    return redirectWithClearedGoogleCookies(request, "/sign-in?error=google-not-configured");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");
  if (errorParam) {
    return redirectWithClearedGoogleCookies(request, `/sign-in?error=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return redirectWithClearedGoogleCookies(request, "/sign-in?error=missing-code");
  }

  const cookieState = request.cookies.get("oauth_state_google")?.value;
  const pkceVerifier = request.cookies.get("oauth_pkce_google")?.value;
  const cookieRedirectUri = request.cookies.get("oauth_redirect_uri_google")?.value;
  const redirectPath = normalizeOAuthRedirectPath(request.cookies.get("oauth_redirect")?.value);
  const acceptedLegal = request.cookies.get(OAUTH_LEGAL_ACCEPTANCE_COOKIE)?.value === "accepted";
  if (!cookieState || !pkceVerifier || cookieState !== state) {
    return redirectWithClearedGoogleCookies(request, "/sign-in?error=state-mismatch");
  }

  const redirectUri = cookieRedirectUri || await getOAuthRedirectUri(request, "/api/auth/oauth/google/callback");
  const tokens = await exchangeGoogleCode({
    code, clientId, clientSecret, redirectUri, pkceVerifier,
  });
  if (!tokens?.idToken) {
    return redirectWithClearedGoogleCookies(request, "/sign-in?error=token-exchange-failed");
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
    return redirectWithClearedGoogleCookies(request, "/sign-in?error=invalid-token");
  }

  if (!payload.email || !payload.email_verified) {
    return redirectWithClearedGoogleCookies(request, "/sign-in?error=email-unverified");
  }

  let userId: string;
  let isNewUser = false;
  try {
    const oauthUser = await findOrLinkOAuthUserWithStatus({
      provider: "google",
      providerId: payload.sub,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
      imageUrl: payload.picture,
      allowNewAccount: acceptedLegal,
    });
    userId = oauthUser.userId;
    isNewUser = oauthUser.isNewUser;
  } catch (err: any) {
    if (err?.message === "LEGAL_ACCEPTANCE_REQUIRED") {
      const response = NextResponse.redirect(
        await getOAuthResponseUrl(request, "/sign-up?error=legal-acceptance-required"),
      );
      return clearGoogleOAuthCookies(response);
    }
    logGoogleOAuthFailure("user link", err);
    return clearGoogleOAuthCookies(
      NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=oauth-account-failed")),
    );
  }

  if (acceptedLegal) {
    try {
      await recordLegalAcceptance({
        userId,
        request,
        page: "/sign-up",
        source: "google_oauth_signup",
      });
    } catch (err) {
      logGoogleOAuthFailure("legal acceptance", err);
      return clearGoogleOAuthCookies(
        NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-up?error=legal-acceptance-failed")),
      );
    }
  }

  const ua = request.headers.get("user-agent") || "";
  const ip = resolveClientIP(request);
  const fp = await generateFingerprint(ip, ua);
  try {
    await createUserSession({
      userId, email: payload.email, fingerprint: fp, ipAddress: ip, userAgent: ua,
    });
  } catch (err) {
    logGoogleOAuthFailure("session create", err);
    return clearGoogleOAuthCookies(
      NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=session-create-failed")),
    );
  }

  const response = NextResponse.redirect(await getOAuthResponseUrl(request, redirectPath));
  if (isNewUser) {
    const welcomeSent = await sendWelcomeEmail({
      email: payload.email,
      firstName: payload.given_name,
      dedupeKey: `welcome:${userId}`,
    })
      .catch((err) => console.error("[EMAIL] welcome after google signup failed:", {
        userId,
        message: err instanceof Error ? err.message : "SEND_FAILED",
      }));
    console.info("[EMAIL] welcome after google signup", { userId, sent: Boolean(welcomeSent) });
  }
  return clearGoogleOAuthCookies(response);
}

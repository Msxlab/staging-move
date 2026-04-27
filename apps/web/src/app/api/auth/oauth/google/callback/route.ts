import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import {
  exchangeGoogleCode,
  getGoogleOAuthCredentials,
  getOAuthRedirectUri,
  getOAuthResponseUrl,
  hashForOAuthLog,
  logSafeOAuthEvent,
  normalizeOAuthRedirectPath,
  oauthUserIdHint,
  summarizeOAuthError,
  type GoogleIdTokenPayload,
} from "@/lib/oauth";
import {
  createUserSession,
  findOrLinkOAuthUserWithStatus,
  generateFingerprint,
} from "@/lib/user-auth";
import { sendSecurityNoticeEmail, sendWelcomeEmail } from "@/lib/email-service";
import { prisma } from "@/lib/db";
import { getRateLimitKey, rateLimit, resolveClientIP } from "@/lib/rate-limit";
import { getPostAuthUserState, resolvePostAuthRedirect } from "@/lib/post-auth-redirect";

export const runtime = "nodejs";

const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const LEGACY_OAUTH_LEGAL_ACCEPTANCE_COOKIE = "oauth_legal_acceptance";

function clearGoogleOAuthCookies(response: NextResponse) {
  response.cookies.delete("oauth_state_google");
  response.cookies.delete("oauth_pkce_google");
  response.cookies.delete("oauth_redirect_uri_google");
  response.cookies.delete("oauth_redirect");
  response.cookies.delete(LEGACY_OAUTH_LEGAL_ACCEPTANCE_COOKIE);
  return response;
}

function logGoogleOAuthFailure(stage: string, err: unknown) {
  logSafeOAuthEvent(`google_${stage}_failed`, summarizeOAuthError(err));
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
    logSafeOAuthEvent("oauth_email_unverified", {
      provider: "google",
      emailHash: hashForOAuthLog(payload.email),
    });
    return redirectWithClearedGoogleCookies(request, "/sign-in?error=email-unverified");
  }

  let userId: string;
  let isNewUser = false;
  let wasLinkedNow = false;
  try {
    const oauthUser = await findOrLinkOAuthUserWithStatus({
      provider: "google",
      providerId: payload.sub,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
      imageUrl: payload.picture,
      allowNewAccount: true,
    });
    userId = oauthUser.userId;
    isNewUser = oauthUser.isNewUser;
    wasLinkedNow = oauthUser.wasLinkedNow;
  } catch (err: any) {
    if (err?.message === "LEGAL_ACCEPTANCE_REQUIRED") {
      const response = NextResponse.redirect(
        await getOAuthResponseUrl(request, "/onboarding?step=legal"),
      );
      return clearGoogleOAuthCookies(response);
    }
    if (err?.message === "OAUTH_EXISTING_DELETED_USER_BLOCKED") {
      return clearGoogleOAuthCookies(
        NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=oauth-account-unavailable")),
      );
    }
    if (err?.message === "OAUTH_ACCOUNT_CREATE_FAILED") {
      return clearGoogleOAuthCookies(
        NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=oauth-account-create-failed")),
      );
    }
    logGoogleOAuthFailure("user_link", err);
    return clearGoogleOAuthCookies(
      NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=oauth-account-failed")),
    );
  }

  const ua = request.headers.get("user-agent") || "";
  const ip = resolveClientIP(request);
  const fp = await generateFingerprint(ip, ua);
  try {
    await createUserSession({
      userId, email: payload.email, fingerprint: fp, ipAddress: ip, userAgent: ua,
    });
  } catch (err) {
    logSafeOAuthEvent("oauth_session_create_failed", {
      provider: "google",
      userIdHint: oauthUserIdHint(userId),
      ...summarizeOAuthError(err),
    });
    return clearGoogleOAuthCookies(
      NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=session-create-failed")),
    );
  }

  let finalRedirectPath: string;
  try {
    const userState = await getPostAuthUserState(userId);
    finalRedirectPath = resolvePostAuthRedirect(userState, redirectPath);
    if (!userState.hasRequiredLegalConsents) {
      logSafeOAuthEvent("oauth_legal_redirect", { provider: "google", userIdHint: oauthUserIdHint(userId) });
    } else if (!userState.onboardingCompleted) {
      logSafeOAuthEvent("oauth_onboarding_redirect", { provider: "google", userIdHint: oauthUserIdHint(userId) });
    }
  } catch (err) {
    logGoogleOAuthFailure("post_auth_redirect", err);
    return clearGoogleOAuthCookies(
      NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=oauth-account-failed")),
    );
  }

  const response = NextResponse.redirect(
    await getOAuthResponseUrl(
      request,
      finalRedirectPath,
    ),
  );
  if (isNewUser) {
    const welcomeLocale = request.cookies.get("NEXT_LOCALE")?.value ?? null;
    const welcomeSent = await sendWelcomeEmail({
      email: payload.email,
      firstName: payload.given_name,
      locale: welcomeLocale,
      dedupeKey: `welcome:${userId}`,
    })
      .catch((err) => console.error("[EMAIL] welcome after google signup failed:", {
        userIdHint: oauthUserIdHint(userId),
        message: err instanceof Error ? err.message : "SEND_FAILED",
      }));
    console.info("[EMAIL] welcome after google signup", { userIdHint: oauthUserIdHint(userId), sent: Boolean(welcomeSent) });
  } else if (wasLinkedNow) {
    // A new OAuth provider was just linked to a pre-existing account.
    // Email the address-of-record so a hijacker linking their own
    // provider can be detected by the legitimate owner.
    const recipient = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    }).catch(() => null);
    if (recipient?.email) {
      void sendSecurityNoticeEmail({
        userEmail: recipient.email,
        userName: recipient.firstName || "there",
        kind: "oauth-linked",
        detail: "Google",
        occurredAt: new Date(),
        dedupeKey: `oauth-linked:google:${userId}`,
      }).catch((err) => console.error("[EMAIL] oauth-linked notice failed:", {
        userIdHint: oauthUserIdHint(userId),
        message: err instanceof Error ? err.message : "SEND_FAILED",
      }));
    }
  }
  return clearGoogleOAuthCookies(response);
}

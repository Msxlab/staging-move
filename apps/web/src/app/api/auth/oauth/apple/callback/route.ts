import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import {
  exchangeAppleCode,
  getAppleOAuthCredentials,
  getOAuthRedirectUri,
  getOAuthResponseUrl,
  hashForOAuthLog,
  isAppleEmailVerifiedClaim,
  logSafeOAuthEvent,
  normalizeOAuthRedirectPath,
  oauthUserIdHint,
  summarizeOAuthError,
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
import { z } from "zod";
import {
  MOBILE_OAUTH_CLIENT_COOKIE,
  MOBILE_OAUTH_PKCE_CHALLENGE_COOKIE,
  MOBILE_OAUTH_REDIRECT_COOKIE,
  MOBILE_OAUTH_STATE_COOKIE,
  buildMobileOAuthRedirectUrl,
  createMobileOAuthExchangeCode,
  isMobileOAuthClient,
  normalizeMobileOAuthCodeChallenge,
  normalizeMobileOAuthRedirectUri,
  normalizeMobileOAuthState,
} from "@/lib/mobile-oauth";

export const runtime = "nodejs";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const LEGACY_OAUTH_LEGAL_ACCEPTANCE_COOKIE = "oauth_legal_acceptance";

const appleUserFieldSchema = z.object({
  name: z
    .object({
      firstName: z.string().max(100).nullable().optional(),
      lastName: z.string().max(100).nullable().optional(),
    })
    .nullable()
    .optional(),
});

function clearAppleOAuthCookies(response: NextResponse) {
  response.cookies.delete("oauth_state_apple");
  response.cookies.delete("oauth_redirect_uri_apple");
  response.cookies.delete("oauth_redirect");
  response.cookies.delete(MOBILE_OAUTH_CLIENT_COOKIE);
  response.cookies.delete(MOBILE_OAUTH_REDIRECT_COOKIE);
  response.cookies.delete(MOBILE_OAUTH_PKCE_CHALLENGE_COOKIE);
  response.cookies.delete(MOBILE_OAUTH_STATE_COOKIE);
  response.cookies.delete(LEGACY_OAUTH_LEGAL_ACCEPTANCE_COOKIE);
  return response;
}

function logAppleOAuthFailure(stage: string, err: unknown) {
  logSafeOAuthEvent(`apple_${stage}_failed`, summarizeOAuthError(err));
}

async function redirectWithClearedAppleCookies(request: NextRequest, path: string) {
  return clearAppleOAuthCookies(NextResponse.redirect(await getOAuthResponseUrl(request, path)));
}

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
  const rl = await rateLimit(getRateLimitKey(request, "auth:oauth:apple:callback"), {
    limit: 30,
    windowSeconds: 60,
    failClosed: true,
  });
  if (!rl.success) {
    return redirectWithClearedAppleCookies(request, "/sign-in?error=oauth-rate-limited");
  }

  const { clientId, teamId, keyId, privateKeyPem } = await getAppleOAuthCredentials();
  if (!clientId || !teamId || !keyId || !privateKeyPem) {
    return redirectWithClearedAppleCookies(request, "/sign-in?error=apple-not-configured");
  }

  // form_post can only be consumed once — clone so we can read multiple fields.
  const fd = await request.formData().catch(() => null);
  if (!fd) return redirectWithClearedAppleCookies(request, "/sign-in?error=apple-bad-body");

  const code = fd.get("code");
  const state = fd.get("state");
  const userField = fd.get("user"); // only present on first sign-in

  if (typeof code !== "string" || typeof state !== "string") {
    return redirectWithClearedAppleCookies(request, "/sign-in?error=apple-missing-fields");
  }

  const cookieState = request.cookies.get("oauth_state_apple")?.value;
  const cookieRedirectUri = request.cookies.get("oauth_redirect_uri_apple")?.value;
  const redirectPath = normalizeOAuthRedirectPath(request.cookies.get("oauth_redirect")?.value);
  if (!cookieState || cookieState !== state) {
    return redirectWithClearedAppleCookies(request, "/sign-in?error=state-mismatch");
  }

  const tokens = await exchangeAppleCode({
    code,
    redirectUri: cookieRedirectUri || await getOAuthRedirectUri(request, "/api/auth/oauth/apple/callback"),
    clientId, teamId, keyId, privateKeyPem,
  });
  if (!tokens?.idToken) {
    return redirectWithClearedAppleCookies(request, "/sign-in?error=token-exchange-failed");
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
    return redirectWithClearedAppleCookies(request, "/sign-in?error=invalid-token");
  }

  if (!payload.email) {
    // Apple may withhold email if user chose "Hide My Email" and we don't have
    // the private-relay mapping. For MVP, require a real email.
    return redirectWithClearedAppleCookies(request, "/sign-in?error=apple-no-email");
  }
  if (!isAppleEmailVerifiedClaim(payload.email_verified)) {
    logSafeOAuthEvent("oauth_email_unverified", {
      provider: "apple",
      emailHash: hashForOAuthLog(payload.email),
    });
    return redirectWithClearedAppleCookies(request, "/sign-in?error=apple-email-not-verified");
  }

  // First-login name info.
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (typeof userField === "string") {
    try {
      const parsedUser = JSON.parse(userField);
      const validatedUser = appleUserFieldSchema.safeParse(parsedUser);
      if (!validatedUser.success) {
        return redirectWithClearedAppleCookies(request, "/sign-in?error=apple-bad-user");
      }
      firstName = validatedUser.data.name?.firstName ?? null;
      lastName = validatedUser.data.name?.lastName ?? null;
    } catch {
      return redirectWithClearedAppleCookies(request, "/sign-in?error=apple-bad-user");
    }
  }

  let userId: string;
  let isNewUser = false;
  let wasLinkedNow = false;
  try {
    const oauthUser = await findOrLinkOAuthUserWithStatus({
      provider: "apple",
      providerId: payload.sub,
      email: payload.email,
      firstName,
      lastName,
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
      return clearAppleOAuthCookies(response);
    }
    if (err?.message === "OAUTH_EXISTING_DELETED_USER_BLOCKED") {
      return clearAppleOAuthCookies(
        NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=oauth-account-unavailable")),
      );
    }
    if (err?.message === "OAUTH_ACCOUNT_CREATE_FAILED") {
      return clearAppleOAuthCookies(
        NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=oauth-account-create-failed")),
      );
    }
    logAppleOAuthFailure("user_link", err);
    return clearAppleOAuthCookies(
      NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=oauth-account-failed")),
    );
  }

  const isMobileClient = isMobileOAuthClient(request.cookies.get(MOBILE_OAUTH_CLIENT_COOKIE)?.value);
  if (isMobileClient) {
    const mobileRedirectUri = normalizeMobileOAuthRedirectUri(
      request.cookies.get(MOBILE_OAUTH_REDIRECT_COOKIE)?.value,
    );
    if (!mobileRedirectUri) {
      return clearAppleOAuthCookies(
        NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=mobile-oauth-redirect-invalid")),
      );
    }
    try {
      // Pull the PKCE challenge stored at init time. May be null for
      // older mobile builds; consumeMobileOAuthExchangeCode treats null
      // as legacy-mode and skips the verifier check.
      const mobileCodeChallenge = normalizeMobileOAuthCodeChallenge(
        request.cookies.get(MOBILE_OAUTH_PKCE_CHALLENGE_COOKIE)?.value,
      );
      const mobileState = normalizeMobileOAuthState(
        request.cookies.get(MOBILE_OAUTH_STATE_COOKIE)?.value,
      );
      const handoffCode = await createMobileOAuthExchangeCode({
        userId,
        provider: "apple",
        redirectUri: mobileRedirectUri,
        codeChallenge: mobileCodeChallenge,
      });
      return clearAppleOAuthCookies(
        NextResponse.redirect(buildMobileOAuthRedirectUrl({
          redirectUri: mobileRedirectUri,
          code: handoffCode,
          provider: "apple",
          state: mobileState,
        })),
      );
    } catch (err) {
      logAppleOAuthFailure("mobile_handoff", err);
      return clearAppleOAuthCookies(
        NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=mobile-oauth-handoff-failed")),
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
    logSafeOAuthEvent("oauth_session_create_failed", {
      provider: "apple",
      userIdHint: oauthUserIdHint(userId),
      ...summarizeOAuthError(err),
    });
    return clearAppleOAuthCookies(
      NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=session-create-failed")),
    );
  }

  let finalRedirectPath: string;
  try {
    const userState = await getPostAuthUserState(userId);
    finalRedirectPath = resolvePostAuthRedirect(userState, redirectPath);
    if (!userState.hasRequiredLegalConsents) {
      logSafeOAuthEvent("oauth_legal_redirect", { provider: "apple", userIdHint: oauthUserIdHint(userId) });
    } else if (!userState.onboardingCompleted) {
      logSafeOAuthEvent("oauth_onboarding_redirect", { provider: "apple", userIdHint: oauthUserIdHint(userId) });
    }
  } catch (err) {
    logAppleOAuthFailure("post_auth_redirect", err);
    return clearAppleOAuthCookies(
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
      firstName,
      locale: welcomeLocale,
      dedupeKey: `welcome:${userId}`,
    }).catch((err) => {
      console.error("[EMAIL] welcome after apple signup failed:", {
        userIdHint: oauthUserIdHint(userId),
        message: err instanceof Error ? err.message : "SEND_FAILED",
      });
      return false;
    });
    console.info("[EMAIL] welcome after apple signup", { userIdHint: oauthUserIdHint(userId), sent: welcomeSent });
  } else if (wasLinkedNow) {
    const recipient = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, preferredLocale: true },
    }).catch(() => null);
    if (recipient?.email) {
      void sendSecurityNoticeEmail({
        userEmail: recipient.email,
        userName: recipient.firstName || "there",
        kind: "oauth-linked",
        detail: "Apple",
        occurredAt: new Date(),
        locale: recipient.preferredLocale,
        dedupeKey: `oauth-linked:apple:${userId}`,
      }).catch((err) => console.error("[EMAIL] oauth-linked notice failed:", {
        userIdHint: oauthUserIdHint(userId),
        message: err instanceof Error ? err.message : "SEND_FAILED",
      }));
    }
  }
  return clearAppleOAuthCookies(response);
}

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import {
  exchangeAppleCode,
  getAppleOAuthCredentials,
  getOAuthRedirectUri,
  getOAuthResponseUrl,
  isAppleEmailVerifiedClaim,
  normalizeOAuthRedirectPath,
  resolveOAuthPostAuthRedirectPath,
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
import { z } from "zod";

export const runtime = "nodejs";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

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
  response.cookies.delete(OAUTH_LEGAL_ACCEPTANCE_COOKIE);
  return response;
}

function logAppleOAuthFailure(stage: string, err: unknown) {
  console.error(`[OAUTH] apple ${stage} failed:`, err);
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
  const acceptedLegal = request.cookies.get(OAUTH_LEGAL_ACCEPTANCE_COOKIE)?.value === "accepted";
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
  } catch (err: any) {
    if (err?.message === "LEGAL_ACCEPTANCE_REQUIRED") {
      const response = NextResponse.redirect(
        await getOAuthResponseUrl(request, "/onboarding?step=legal"),
      );
      return clearAppleOAuthCookies(response);
    }
    logAppleOAuthFailure("user link", err);
    return clearAppleOAuthCookies(
      NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=oauth-account-failed")),
    );
  }

  if (acceptedLegal) {
    try {
      await recordLegalAcceptance({
        userId,
        request,
        page: "/sign-up",
        source: "apple_oauth_signup",
      });
    } catch (err) {
      logAppleOAuthFailure("legal acceptance", err);
      return clearAppleOAuthCookies(
        NextResponse.redirect(await getOAuthResponseUrl(request, "/onboarding?step=legal&error=legal-acceptance-failed")),
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
    logAppleOAuthFailure("session create", err);
    return clearAppleOAuthCookies(
      NextResponse.redirect(await getOAuthResponseUrl(request, "/sign-in?error=session-create-failed")),
    );
  }

  const response = NextResponse.redirect(
    await getOAuthResponseUrl(
      request,
      resolveOAuthPostAuthRedirectPath({ isNewUser, redirectPath }),
    ),
  );
  if (isNewUser) {
    const welcomeSent = await sendWelcomeEmail({
      email: payload.email,
      firstName,
      dedupeKey: `welcome:${userId}`,
    }).catch((err) => {
      console.error("[EMAIL] welcome after apple signup failed:", {
        userId,
        message: err instanceof Error ? err.message : "SEND_FAILED",
      });
      return false;
    });
    console.info("[EMAIL] welcome after apple signup", { userId, sent: welcomeSent });
  }
  return clearAppleOAuthCookies(response);
}

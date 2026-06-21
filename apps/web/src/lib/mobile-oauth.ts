import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/user-auth";

export const MOBILE_OAUTH_CLIENT_COOKIE = "oauth_client";
export const MOBILE_OAUTH_REDIRECT_COOKIE = "oauth_mobile_redirect";
export const MOBILE_OAUTH_STATE_COOKIE = "oauth_mobile_state";
// Carries the mobile client's PKCE code_challenge from the init step
// (`/api/auth/oauth/{google|apple}?mobileCodeChallenge=...`) through to
// the callback step where it's persisted on the MobileOAuthCode row.
// httpOnly so a hostile site script can't read or rewrite it.
export const MOBILE_OAUTH_PKCE_CHALLENGE_COOKIE = "oauth_mobile_pkce_challenge";

const MOBILE_OAUTH_CODE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MOBILE_REDIRECT_URIS = [
  "locateflow://oauth",
  "locateflow:///oauth",
  "https://locateflow.com/mobile/oauth",
];

// PKCE code_challenge constraints. RFC 7636 requires base64url
// of SHA-256(verifier), which is exactly 43 chars without padding. We
// allow 43..128 to leave headroom but reject obviously-wrong values
// (empty strings, padded base64, or non-base64url characters).
const PKCE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const MOBILE_STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function configuredMobileRedirectUris() {
  const configured = (process.env.MOBILE_OAUTH_REDIRECT_URIS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length > 0
    ? { uris: configured, fromConfig: true }
    : { uris: DEFAULT_MOBILE_REDIRECT_URIS, fromConfig: false };
}

function isDevelopmentRuntime() {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  return process.env.NODE_ENV !== "production" && !["production", "staging", "preview"].includes(appEnv);
}

function isExpoDevelopmentRedirectUri(value: string): boolean {
  if (!isDevelopmentRuntime()) return false;
  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    return (url.protocol === "exp:" || url.protocol === "exps:") && pathParts.includes("oauth");
  } catch {
    return false;
  }
}

export function normalizeMobileOAuthRedirectUri(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  const allowed = configuredMobileRedirectUris();
  if (allowed.uris.includes(value)) return value;
  if (!allowed.fromConfig && isExpoDevelopmentRedirectUri(value)) return value;
  return null;
}

export function isMobileOAuthClient(value: string | null | undefined) {
  return (value || "").toLowerCase() === "mobile";
}

/**
 * Validate a PKCE code_challenge from the mobile init request. Returns
 * the trimmed value when it matches the RFC 7636 base64url-of-SHA256
 * shape, or null when malformed. Init routes use this to reject bad
 * input before storing the challenge in a cookie.
 */
export function normalizeMobileOAuthCodeChallenge(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  if (!PKCE_CHALLENGE_PATTERN.test(value)) return null;
  return value;
}

export function normalizeMobileOAuthState(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  if (!MOBILE_STATE_PATTERN.test(value)) return null;
  return value;
}

/**
 * Constant-time PKCE check: does sha256(verifier) (base64url) match
 * the persisted challenge? Returns false on any malformed input.
 */
export function verifyPkceCodeVerifier(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const computed = createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  if (computed.length !== challenge.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
  } catch {
    return false;
  }
}

export function buildMobileOAuthRedirectUrl(input: {
  redirectUri: string;
  code: string;
  provider: "google" | "apple";
  state?: string | null;
}) {
  const url = new URL(input.redirectUri);
  url.searchParams.set("code", input.code);
  url.searchParams.set("provider", input.provider);
  if (input.state) url.searchParams.set("state", input.state);
  return url;
}

export async function createMobileOAuthExchangeCode(input: {
  userId: string;
  provider: "google" | "apple";
  redirectUri: string;
  codeChallenge: string;
}) {
  if (!normalizeMobileOAuthCodeChallenge(input.codeChallenge)) {
    throw new Error("PKCE_CHALLENGE_REQUIRED");
  }
  const { token, hash } = generateOpaqueToken();
  await prisma.mobileOAuthCode.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      redirectUri: input.redirectUri,
      codeHash: hash,
      codeChallenge: input.codeChallenge,
      expiresAt: new Date(Date.now() + MOBILE_OAUTH_CODE_TTL_MS),
    },
  });
  return token;
}

export type MobileOAuthExchangeResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
        emailVerifiedAt: Date | null;
        passwordHash: string | null;
        mfaEnabled: boolean;
      };
    }
  | {
      ok: false;
      error:
        | "INVALID_CODE"
        | "EXPIRED_CODE"
        | "REPLAYED_CODE"
        | "ACCOUNT_UNAVAILABLE"
        | "PKCE_CHALLENGE_REQUIRED"
        | "PKCE_VERIFIER_REQUIRED"
        | "PKCE_VERIFIER_INVALID";
    };

export async function consumeMobileOAuthExchangeCode(
  code: string,
  options: { codeVerifier?: string | null } = {},
): Promise<MobileOAuthExchangeResult> {
  const codeHash = hashOpaqueToken(code);
  const record = await prisma.mobileOAuthCode.findUnique({
    where: { codeHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          emailVerifiedAt: true,
          passwordHash: true,
          mfaEnabled: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!record) return { ok: false, error: "INVALID_CODE" };
  if (record.usedAt) return { ok: false, error: "REPLAYED_CODE" };
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false, error: "EXPIRED_CODE" };
  if (!record.user || record.user.deletedAt) return { ok: false, error: "ACCOUNT_UNAVAILABLE" };

  if (!record.codeChallenge) {
    return { ok: false, error: "PKCE_CHALLENGE_REQUIRED" };
  }
  if (!options.codeVerifier) {
    return { ok: false, error: "PKCE_VERIFIER_REQUIRED" };
  }
  if (!verifyPkceCodeVerifier(options.codeVerifier, record.codeChallenge)) {
    return { ok: false, error: "PKCE_VERIFIER_INVALID" };
  }

  const consumed = await prisma.mobileOAuthCode.updateMany({
    where: {
      id: record.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, error: "REPLAYED_CODE" };

  return {
    ok: true,
    user: {
      id: record.user.id,
      email: record.user.email,
      firstName: record.user.firstName,
      lastName: record.user.lastName,
      imageUrl: record.user.imageUrl,
      emailVerifiedAt: record.user.emailVerifiedAt,
      passwordHash: record.user.passwordHash,
      mfaEnabled: record.user.mfaEnabled,
    },
  };
}

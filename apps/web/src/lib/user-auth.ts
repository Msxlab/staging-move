/**
 * User authentication — JWT + cookie + DB-tracked sessions.
 * Mirrors the admin auth pattern (apps/admin/src/lib/auth.ts) adapted for
 * end users. Supports email+password login, OAuth account linking, and MFA.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getUserJwtSecretKey } from "@/lib/user-jwt-secret";

// ── Secret / constants ──────────────────────────────────────

const COOKIE_NAME = "user_session";
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_SEC = SESSION_TTL_DAYS * 24 * 60 * 60;

export const BCRYPT_COST = 12;

export type SessionClientType = "web" | "mobile";

export interface UserSessionClaims {
  userId: string;
  email: string;
  fp?: string;
  fpMode?: SessionClientType;
  sessionId?: string;
}

// ── Fingerprint + token hashing ─────────────────────────────

async function sha256Hex(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Web: IP + UA — strict. A hijacked cookie from a different IP is rejected.
export async function generateFingerprint(
  ip: string,
  userAgent: string,
): Promise<string> {
  return sha256Hex(`${ip}|${userAgent}`);
}

// Mobile: UA only. Mobile IP changes frequently (Wi-Fi ↔ LTE, carrier NAT),
// so including IP would force re-login on every network switch. UA stays
// stable across network changes and still detects device-swap hijack.
export async function generateMobileFingerprint(
  userAgent: string,
): Promise<string> {
  return sha256Hex(`mobile|${userAgent}`);
}

export async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Password ────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Returns a validation error message, or null if valid.
 * Policy: >= 12 chars, must contain upper + lower + digit + special.
 */
export function validatePasswordPolicy(password: string): string | null {
  if (!password || password.length < 12)
    return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password))
    return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password))
    return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a digit.";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must contain a special character.";
  return null;
}

// ── Opaque token (for email verification / password reset) ──

export function generateOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Session lifecycle ──────────────────────────────────────

function clearSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  try {
    cookieStore.delete(COOKIE_NAME);
  } catch {
    /* ignore */
  }
}

/**
 * Creates a signed JWT + a DB session row (tokenHash-indexed), sets the cookie.
 * Returns the raw JWT.
 */
export async function createUserSession(input: {
  userId: string;
  email: string;
  fingerprint?: string;
  clientType?: SessionClientType;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
}): Promise<string> {
  const claims: Record<string, unknown> = {
    userId: input.userId,
    email: input.email,
  };
  if (input.fingerprint) {
    claims.fp = input.fingerprint;
    claims.fpMode = input.clientType ?? "web";
  }

  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(getUserJwtSecretKey());

  const tokenHash = await hashSessionToken(token);
  await prisma.userLoginSession.create({
    data: {
      userId: input.userId,
      tokenHash,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      browser: input.browser || null,
      os: input.os || null,
      deviceType: input.deviceType || null,
      expiresAt: new Date(Date.now() + SESSION_TTL_SEC * 1000),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SEC,
    path: "/",
  });

  return token;
}

async function readTokenFromRequest(): Promise<{
  token: string;
  source: "cookie" | "header";
} | null> {
  // Cookie first — web uses httpOnly cookie.
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieToken) return { token: cookieToken, source: "cookie" };

  // Authorization: Bearer — mobile clients.
  try {
    const hdrs = await headers();
    const auth = hdrs.get("authorization") || hdrs.get("Authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) {
      return { token: auth.slice(7).trim(), source: "header" };
    }
  } catch {
    /* outside request scope */
  }
  return null;
}

export async function getUserSession(): Promise<UserSessionClaims | null> {
  const found = await readTokenFromRequest();
  if (!found) return null;
  const token = found.token;
  const cameFromCookie = found.source === "cookie";

  const tokenHash = await hashSessionToken(token).catch(() => null);
  if (!tokenHash) return null;

  const clearIfCookie = async () => {
    if (cameFromCookie) {
      const store = await cookies();
      clearSessionCookie(store);
    }
  };

  const invalidateSession = async () => {
    await prisma.userLoginSession
      .updateMany({
        where: { tokenHash, isActive: true },
        data: { isActive: false },
      })
      .catch(() => null);
  };

  try {
    const { payload } = await jwtVerify(token, getUserJwtSecretKey());

    const record = await prisma.userLoginSession
      .findFirst({
        where: { tokenHash, isActive: true },
        select: { id: true, userId: true, expiresAt: true, userAgent: true },
      })
      .catch(() => null);

    if (!record) {
      await clearIfCookie();
      return null;
    }

    if (typeof payload.fp === "string" && payload.fp) {
      const hdrs = await headers().catch(() => null);
      const userAgent = hdrs?.get("user-agent") || "unknown";
      const fpMode: SessionClientType =
        payload.fpMode === "mobile" ? "mobile" : "web";
      const currentFp =
        fpMode === "mobile"
          ? await generateMobileFingerprint(userAgent).catch(() => null)
          : await generateFingerprint(
              getRequestIpFromHeaderValue(
                hdrs?.get("x-forwarded-for") || hdrs?.get("x-real-ip") || null,
              ),
              userAgent,
            ).catch(() => null);
      // DigitalOcean/proxy chains can present a different forwarding IP
      // between OAuth callback and later app/API requests. Keep the DB-backed
      // session valid when the browser UA is unchanged; still reject device
      // swaps where both IP-bound fingerprint and UA differ.
      const proxyIpChangedButSameBrowser =
        fpMode === "web" && record.userAgent === userAgent;
      if (!currentFp || (currentFp !== payload.fp && !proxyIpChangedButSameBrowser)) {
        await invalidateSession();
        await clearIfCookie();
        return null;
      }
    }

    if (
      record.userId !== payload.userId ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      await invalidateSession();
      await clearIfCookie();
      return null;
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      fp: (payload.fp as string) || undefined,
      fpMode:
        payload.fpMode === "mobile" || payload.fpMode === "web"
          ? (payload.fpMode as SessionClientType)
          : undefined,
      sessionId: record.id,
    };
  } catch {
    await invalidateSession();
    await clearIfCookie();
    return null;
  }
}

function getRequestIpFromHeaderValue(value: string | null): string {
  return value?.split(",")[0].trim() || "unknown";
}

export async function destroyUserSession(): Promise<void> {
  const found = await readTokenFromRequest();
  const cookieStore = await cookies();
  if (found?.token) {
    const tokenHash = await hashSessionToken(found.token).catch(() => null);
    if (tokenHash) {
      await prisma.userLoginSession
        .updateMany({
          where: { tokenHash, isActive: true },
          data: { isActive: false, lastActivity: new Date() },
        })
        .catch(() => null);
    }
  }
  clearSessionCookie(cookieStore);
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.userLoginSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });
}

/**
 * Throw UNAUTHORIZED if no valid session cookie / DB row.
 * Also verifies the ACCOUNT_DELETED GDPR flag.
 */
export async function requireDbUserId(): Promise<string> {
  const session = await getUserSession();
  if (!session) throw new Error("UNAUTHORIZED");

  const user = await prisma.user.findFirst({
    where: { id: session.userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) {
    await destroyUserSession();
    throw new Error("UNAUTHORIZED");
  }

  // Update lastActivity (non-blocking).
  if (session.sessionId) {
    prisma.userLoginSession
      .updateMany({
        where: { id: session.sessionId, isActive: true },
        data: { lastActivity: new Date() },
      })
      .catch(() => null);
  }

  return user.id;
}

export async function validateFingerprint(
  session: UserSessionClaims,
  ip: string,
  userAgent: string,
): Promise<boolean> {
  if (!session.fp) return true;
  const currentFp = await generateFingerprint(ip, userAgent);
  return currentFp === session.fp;
}

// ── Helpers for OAuth account linking ──────────────────────

export async function findOrLinkOAuthUser(input: {
  provider: "google" | "apple";
  providerId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  allowNewAccount?: boolean;
}): Promise<string> {
  // 1) Existing OAuth link
  const existingLink = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerId: {
        provider: input.provider,
        providerId: input.providerId,
      },
    },
    select: { userId: true },
  });
  if (existingLink) return existingLink.userId;

  // 2) Existing user by email → link
  const userByEmail = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true, emailVerifiedAt: true },
  });
  if (userByEmail) {
    await prisma.oAuthAccount.create({
      data: {
        userId: userByEmail.id,
        provider: input.provider,
        providerId: input.providerId,
      },
    });
    // OAuth providers have already verified the email — mark verified if not already.
    if (!userByEmail.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: userByEmail.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return userByEmail.id;
  }

  if (input.allowNewAccount === false) {
    throw new Error("LEGAL_ACCEPTANCE_REQUIRED");
  }

  // 3) Brand new account
  const created = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      imageUrl: input.imageUrl ?? null,
      emailVerifiedAt: new Date(),
      oauthAccounts: {
        create: { provider: input.provider, providerId: input.providerId },
      },
    },
  });

  return created.id;
}

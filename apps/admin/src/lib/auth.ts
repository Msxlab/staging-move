import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { adminRoleRequiresMfa } from "./admin-roles";
import { trackFailedPasswordConfirm, trackSensitiveOp } from "./security-monitor";
import { generateAdminSessionFingerprint } from "./session-fingerprint";
import { decrypt } from "./shared-encryption";
import { verifyBackupCode, verifyTOTP } from "./totp";
import { writeAdminAudit } from "./audit";
import {
  clearFailures as clearStepUpFailures,
  clearStepUpStateForTests as clearStepUpStoreForTests,
  getFailureLockout as getStepUpLockout,
  hasRecentConfirm as hasRecentStepUpConfirm,
  registerFailure as registerStepUpFailure,
  rememberConfirm as rememberStepUpConfirm,
} from "./auth-step-up-store";

function getAdminJwtSecret(): Uint8Array {
  const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
  if (!adminJwtSecret || adminJwtSecret.length < 32) {
    throw new Error("ADMIN_JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(adminJwtSecret);
}

export const ADMIN_SESSION_COOKIE_NAME = "admin_session";
const COOKIE_NAME = ADMIN_SESSION_COOKIE_NAME;

export function shouldUseSecureAdminCookies(): boolean {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").toLowerCase();
  return (
    process.env.NODE_ENV === "production" ||
    appEnv === "production" ||
    appEnv === "staging" ||
    appEnv === "preview" ||
    appUrl.startsWith("https://")
  );
}

function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: shouldUseSecureAdminCookies(),
    sameSite: "strict" as const,
    path: "/",
  };
}

function clearSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  try {
    cookieStore.delete(COOKIE_NAME);
  } catch {
  }
  try {
    cookieStore.set(COOKIE_NAME, "", {
      ...adminSessionCookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    });
  } catch {
  }
}

function adminCookieDomainCandidates(_host?: string | null): Array<string | undefined> {
  const configured = (process.env.ADMIN_SESSION_COOKIE_DOMAIN || process.env.SESSION_COOKIE_DOMAIN || "").trim();
  const candidates: Array<string | undefined> = [undefined];
  if (configured) candidates.push(configured);
  return Array.from(new Set(candidates));
}

export function expireAdminSessionCookies(response: NextResponse, host?: string | null): NextResponse {
  for (const domain of adminCookieDomainCandidates(host)) {
    response.cookies.set(COOKIE_NAME, "", {
      ...adminSessionCookieOptions(),
      ...(domain ? { domain } : {}),
      maxAge: 0,
      expires: new Date(0),
    });
  }
  return response;
}

export interface AdminSession {
  adminId: string;
  email: string;
  role: string;
  fingerprint?: string;
  sessionId?: string;
  /**
   * MFA-enabled flag from the JWT claim. Used by middleware to gate
   * access for roles that must complete MFA setup before using the app.
   * Null/undefined means the token was issued before this claim existed
   * (legacy session) — treat as "unknown" and fall back to DB lookup.
   */
  mfaEnabled?: boolean;
}

/**
 * Generate a SHA-256 admin session fingerprint from a coarse client IP bucket
 * plus stable request headers. IPv4 is bound at /24 and IPv6 at /64 so normal
 * ISP churn is tolerated while stolen cookies replayed from a different
 * network are rejected.
 */
export async function generateFingerprint(
  ip: string,
  userAgent: string,
  acceptLanguage?: string | null,
  secChUa?: string | null,
): Promise<string> {
  return generateAdminSessionFingerprint({ ip, userAgent, acceptLanguage, secChUa });
}

export async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(
  adminId: string,
  email: string,
  role: string,
  fingerprint?: string,
  mfaEnabled?: boolean
): Promise<string> {
  const claims: Record<string, unknown> = { adminId, email, role };
  if (fingerprint) claims.fp = fingerprint;
  // Embed the MFA-enabled flag so middleware (Edge Runtime, no DB) can
  // gate access for roles that require MFA without an extra round trip.
  if (typeof mfaEnabled === "boolean") claims.mfaEnabled = mfaEnabled;

  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .setIssuedAt()
    .sign(getAdminJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    ...adminSessionCookieOptions(),
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return token;
}

/**
 * Re-issue the current session JWT with a fresh claim set. Used after
 * privileged state changes that affect middleware gating — e.g., the
 * admin just completed MFA setup and we need the JWT to reflect
 * `mfaEnabled: true` without forcing them to log out and back in.
 */
export async function refreshSessionCookie(
  session: AdminSession,
  overrides: { mfaEnabled?: boolean } = {}
): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  // Invalidate the old DB-tracked row so its tokenHash cannot be reused.
  if (existing) {
    const oldHash = await hashSessionToken(existing).catch(() => null);
    if (oldHash) {
      await prisma.adminSession.updateMany({
        where: { tokenHash: oldHash, isActive: true },
        data: { isActive: false },
      }).catch(() => null);
    }
  }

  const mfaEnabled =
    typeof overrides.mfaEnabled === "boolean"
      ? overrides.mfaEnabled
      : session.mfaEnabled;

  const newToken = await createSession(
    session.adminId,
    session.email,
    session.role,
    session.fingerprint,
    mfaEnabled
  );

  // Mirror the new row into AdminSession so getSession() finds it.
  const newHash = await hashSessionToken(newToken);
  await prisma.adminSession.create({
    data: {
      adminUserId: session.adminId,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  }).catch(() => null);

  return newToken;
}

export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = await hashSessionToken(token).catch(() => null);

  try {
    const { payload } = await jwtVerify(token, getAdminJwtSecret(), {
      algorithms: ["HS256"],
    });

    if (!tokenHash) {
      clearSessionCookie(cookieStore);
      return null;
    }

    const sessionRecord = await prisma.adminSession.findFirst({
      where: {
        tokenHash,
        isActive: true,
      },
      select: {
        id: true,
        adminUserId: true,
        expiresAt: true,
      },
    }).catch(() => null);

    if (!sessionRecord) {
      clearSessionCookie(cookieStore);
      return null;
    }

    if (sessionRecord.adminUserId !== payload.adminId || new Date(sessionRecord.expiresAt).getTime() <= Date.now()) {
      await prisma.adminSession.updateMany({
        where: { tokenHash, isActive: true },
        data: { isActive: false },
      }).catch(() => null);
      clearSessionCookie(cookieStore);
      return null;
    }

    return {
      adminId: payload.adminId as string,
      email: payload.email as string,
      role: payload.role as string,
      fingerprint: (payload.fp as string) || undefined,
      sessionId: sessionRecord.id,
      mfaEnabled:
        typeof payload.mfaEnabled === "boolean"
          ? (payload.mfaEnabled as boolean)
          : undefined,
    };
  } catch {
    if (tokenHash) {
      await prisma.adminSession.updateMany({
        where: { tokenHash, isActive: true },
        data: { isActive: false },
      }).catch(() => null);
    }
    clearSessionCookie(cookieStore);
    return null;
  }
}

/**
 * Validate that the current request fingerprint matches the session fingerprint.
 * Returns false if the session was created with a fingerprint and it doesn't match.
 */
export async function validateFingerprint(
  session: AdminSession,
  ip: string,
  userAgent: string,
  acceptLanguage?: string | null,
  secChUa?: string | null,
): Promise<boolean> {
  if (!session.fingerprint) return true; // Legacy sessions without fingerprint
  const currentFp = await generateFingerprint(ip, userAgent, acceptLanguage, secChUa);
  return currentFp === session.fingerprint;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
  });

  if (!admin || !admin.isActive) {
    if (session.sessionId) {
      await prisma.adminSession.updateMany({
        where: { id: session.sessionId, isActive: true },
        data: { isActive: false },
      }).catch(() => null);
    }
    await destroySession();
    throw new Error("UNAUTHORIZED");
  }

  if (session.sessionId) {
    await prisma.adminSession.updateMany({
      where: { id: session.sessionId, isActive: true },
      data: { lastActivity: new Date() },
    }).catch(() => null);
  }

  return session;
}

export async function requireRole(requiredRole: string): Promise<AdminSession> {
  const session = await requireAdmin();

  // Re-read role from DB to prevent stale JWT role claims (SEC-005)
  const freshAdmin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { role: true, isActive: true, mfaEnabled: true },
  });
  if (!freshAdmin || !freshAdmin.isActive) {
    throw new Error("UNAUTHORIZED");
  }
  if (adminRoleRequiresMfa(freshAdmin.role) && !freshAdmin.mfaEnabled) {
    throw new Error("FORBIDDEN");
  }
  const currentRole = freshAdmin.role;

  const roleHierarchy: Record<string, number> = {
    VIEWER: 0,
    MODERATOR: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };

  const userLevel = roleHierarchy[currentRole] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole] ?? 0;

  if (userLevel < requiredLevel) {
    throw new Error("FORBIDDEN");
  }

  return { ...session, role: currentRole };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = await hashSessionToken(token).catch(() => null);
    if (tokenHash) {
      await prisma.adminSession.updateMany({
        where: { tokenHash, isActive: true },
        data: {
          isActive: false,
          lastActivity: new Date(),
        },
      }).catch(() => null);
    }
  }
  clearSessionCookie(cookieStore);
}

// Step-up confirmation grace + bad-attempt counters now live in a shared
// store (Upstash Redis when configured, in-memory fallback otherwise) —
// see auth-step-up-store.ts. The constants below stay here because
// requirePasswordConfirm is the only caller that needs to know about them.
const DEFAULT_CONFIRM_GRACE_MS = 10 * 60 * 1000;
const SECRET_ROTATION_GRACE_MS = 2 * 60 * 1000;
const STEP_UP_FAILURE_WINDOW_MS = 5 * 60 * 1000;
// Lockout was 10 min after 5 typos — easy to trigger on mobile during an
// incident, after which every sensitive action 403s for the duration.
// 5 min after 8 typos still resists brute force (8 attempts/5 min ≈ 1 / 37s,
// well below any realistic password-guessing throughput) without making the
// operator wait through an outage because of fat fingers.
const STEP_UP_LOCKOUT_MS = 5 * 60 * 1000;
const STEP_UP_MAX_FAILURES = 8;

export interface AdminStepUpOptions {
  operation?: string;
  mfaCode?: string | null;
  backupCode?: string | null;
  requireMfa?: boolean;
  maxAgeMs?: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function normalizeStepUpOperation(operation: string | undefined): string {
  return (operation || "sensitive_action").trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "_");
}

function stepUpCacheKey(session: AdminSession, operation: string): string {
  const sessionScope = session.sessionId || session.fingerprint || "legacy-session";
  return `${session.adminId}:${sessionScope}:${operation}`;
}

function stepUpGraceMs(operation: string, maxAgeMs?: number): number {
  if (typeof maxAgeMs === "number" && maxAgeMs >= 0) return maxAgeMs;
  if (operation.includes("key_rotation") || operation.includes("secret")) return SECRET_ROTATION_GRACE_MS;
  return DEFAULT_CONFIRM_GRACE_MS;
}

async function checkStepUpFailureLimit(key: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const lock = await getStepUpLockout(key);
  if (lock.locked) {
    return { allowed: false, retryAfterSec: lock.retryAfterSec };
  }
  return { allowed: true, retryAfterSec: 0 };
}

async function recordStepUpFailure(key: string): Promise<{ locked: boolean; retryAfterSec: number }> {
  return registerStepUpFailure({
    key,
    windowSec: Math.ceil(STEP_UP_FAILURE_WINDOW_MS / 1000),
    maxFailures: STEP_UP_MAX_FAILURES,
    lockoutSec: Math.ceil(STEP_UP_LOCKOUT_MS / 1000),
  });
}

export function clearAdminStepUpStateForTests() {
  clearStepUpStoreForTests();
}

async function writeStepUpAudit(
  session: AdminSession,
  action: "STEP_UP_SUCCESS" | "STEP_UP_FAILED",
  operation: string,
  options: AdminStepUpOptions,
  metadata: Record<string, unknown> = {},
) {
  await writeAdminAudit(session, {
    action,
    entityType: "AdminAuth",
    entityId: session.adminId,
    metadata: {
      operation,
      requireMfa: Boolean(options.requireMfa),
      ...metadata,
    },
    request: {
      ipAddress: options.ipAddress || "unknown",
      userAgent: options.userAgent || null,
    },
  });
}

export async function requirePasswordConfirm(
  session: AdminSession,
  password: string | undefined,
  options: AdminStepUpOptions = {},
): Promise<{ confirmed: boolean; error?: string; requiresMfa?: boolean; rateLimited?: boolean; retryAfterSec?: number }> {
  const operation = normalizeStepUpOperation(options.operation);
  const cacheKey = stepUpCacheKey(session, operation);
  const failureKey = `${cacheKey}:failure`;

  const graceMs = stepUpGraceMs(operation, options.maxAgeMs);
  if (graceMs > 0) {
    const recent = await hasRecentStepUpConfirm(cacheKey, graceMs);
    if (recent) {
      await writeStepUpAudit(session, "STEP_UP_SUCCESS", operation, options, { cached: true });
      return { confirmed: true };
    }
  }

  const failureLimit = await checkStepUpFailureLimit(failureKey);
  if (!failureLimit.allowed) {
    await writeStepUpAudit(session, "STEP_UP_FAILED", operation, options, {
      reason: "rate_limited",
      retryAfterSec: failureLimit.retryAfterSec,
    });
    return {
      confirmed: false,
      error: "Too many confirmation attempts. Please wait and try again.",
      rateLimited: true,
      retryAfterSec: failureLimit.retryAfterSec,
    };
  }

  if (!password) {
    await writeStepUpAudit(session, "STEP_UP_FAILED", operation, options, { reason: "missing_password" });
    return { confirmed: false, error: "Password confirmation required for this operation." };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: {
      password: true,
      isActive: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaBackupCodes: true,
    },
  });

  if (!admin || !admin.isActive) {
    await writeStepUpAudit(session, "STEP_UP_FAILED", operation, options, { reason: "admin_inactive" });
    return { confirmed: false, error: "Admin account not found or inactive." };
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    const lock = await recordStepUpFailure(failureKey);
    const ipAddress = options.ipAddress || "unknown";
    trackFailedPasswordConfirm(session.adminId, ipAddress);
    await writeStepUpAudit(session, "STEP_UP_FAILED", operation, options, {
      reason: "invalid_password",
      rateLimited: lock.locked,
      retryAfterSec: lock.retryAfterSec || undefined,
    });
    return {
      confirmed: false,
      error: lock.locked ? "Too many confirmation attempts. Please wait and try again." : "Incorrect password.",
      rateLimited: lock.locked,
      retryAfterSec: lock.retryAfterSec || undefined,
    };
  }

  if (options.requireMfa && admin.mfaEnabled) {
    let mfaValid = false;
    const secret = admin.mfaSecret ? decrypt(admin.mfaSecret) : "";
    const mfaCode = options.mfaCode?.trim();
    const backupCode = options.backupCode?.trim();

    if (mfaCode && secret) {
      mfaValid = verifyTOTP(secret, mfaCode);
    } else if (backupCode && admin.mfaBackupCodes) {
      const originalBackupCodes = admin.mfaBackupCodes || "[]";
      let storedHashes: string[] = [];
      try {
        const parsed = JSON.parse(originalBackupCodes);
        if (Array.isArray(parsed)) storedHashes = parsed.filter((item) => typeof item === "string");
      } catch {
        storedHashes = [];
      }
      const matchIndex = await verifyBackupCode(backupCode, storedHashes);
      if (matchIndex >= 0) {
        storedHashes.splice(matchIndex, 1);
        const consumed = await prisma.adminUser.updateMany({
          where: { id: session.adminId, mfaBackupCodes: originalBackupCodes },
          data: { mfaBackupCodes: JSON.stringify(storedHashes) },
        });
        mfaValid = consumed.count === 1;
      }
    }

    if (!mfaValid) {
      const lock = await recordStepUpFailure(failureKey);
      const ipAddress = options.ipAddress || "unknown";
      trackFailedPasswordConfirm(session.adminId, ipAddress);
      await writeStepUpAudit(session, "STEP_UP_FAILED", operation, options, {
        reason: "invalid_mfa",
        requiresMfa: true,
        rateLimited: lock.locked,
        retryAfterSec: lock.retryAfterSec || undefined,
      });
      return {
        confirmed: false,
        error: lock.locked
          ? "Too many confirmation attempts. Please wait and try again."
          : "MFA verification required for this operation.",
        requiresMfa: true,
        rateLimited: lock.locked,
        retryAfterSec: lock.retryAfterSec || undefined,
      };
    }
  }

  // Persist the confirm with a TTL matching the longest grace window — the
  // store will expire it on its own. We pick a generous ceiling so a
  // follow-up call inside the per-operation `stepUpGraceMs` can still find
  // it; the per-operation freshness check above gates by exact age.
  const ttlSec = Math.max(60, Math.ceil(graceMs / 1000));
  await rememberStepUpConfirm(cacheKey, ttlSec);
  await clearStepUpFailures(failureKey);
  const ipAddress = options.ipAddress || "unknown";
  trackSensitiveOp(session.adminId, ipAddress, operation);
  await writeStepUpAudit(session, "STEP_UP_SUCCESS", operation, options, { cached: false });
  return { confirmed: true };
}

export async function requirePermission(
  resource: string,
  action: "canRead" | "canCreate" | "canUpdate" | "canDelete",
  options: { minimumRole?: string; fallbackResources?: string[] } = {}
): Promise<AdminSession> {
  const session = await requireRole(options.minimumRole || "VIEWER");
  const resources = [resource, ...(options.fallbackResources || [])];

  for (const currentResource of resources) {
    if (await checkPermission(session.adminId, currentResource, action)) {
      return session;
    }
  }

  throw new Error("FORBIDDEN");
}

/**
 * Runtime authorization check.
 *
 * Fails CLOSED: any admin without a persisted row for `resource` is
 * denied regardless of role. This is a deliberate departure from the
 * old "legacy fallback" behavior, which silently granted role-default
 * access when rows were missing — a least-privilege violation that
 * created a gap between seed/create paths and enforcement.
 *
 * The one exception is SUPER_ADMIN: it short-circuits to allow so a
 * root operator can't lock themselves out even if their permission
 * rows are somehow corrupted or deleted. Demoting a SUPER_ADMIN to a
 * lower role still revokes access because the check reads the current
 * role, not the JWT claim.
 *
 * If an existing admin ends up with zero rows (pre-migration data,
 * manual DB surgery, etc.) they will receive a 403 on any gated
 * endpoint. Re-create or re-invite them through the team UI, or run
 * `buildDefaultPermissionMatrix(admin.role)` from
 * `./admin-permissions.ts` against their ID to backfill.
 */
export async function checkPermission(
  adminId: string,
  resource: string,
  action: "canRead" | "canCreate" | "canUpdate" | "canDelete"
): Promise<boolean> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    include: { permissions: true },
  });

  if (!admin || !admin.isActive) return false;

  // SUPER_ADMIN short-circuit — root operator always retains access.
  if (admin.role === "SUPER_ADMIN") return true;

  // Every other role needs an explicit row for the resource.
  const permission = admin.permissions.find((p: any) => p.resource === resource);
  if (!permission) return false;
  return permission[action];
}

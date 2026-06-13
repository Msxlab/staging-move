import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ADMIN_SESSION_TTL_SECONDS, createSession, generateFingerprint, hashSessionToken } from "@/lib/auth";
import {
  createAdminMfaTrustToken,
  expireAdminMfaTrustCookie,
  findValidAdminMfaTrustedDevice,
  getAdminMfaTrustCookie,
  rememberAdminMfaTrustedDevice,
  setAdminMfaTrustCookie,
} from "@/lib/admin-mfa-trusted-device";
import { trackFailedLogin, trackSuccessfulLogin } from "@/lib/security-monitor";
import { verifyTOTP, verifyBackupCode } from "@/lib/totp";
import { decrypt } from "@/lib/shared-encryption";
import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { resolveTrustedClientIpFromHeaders } from "@locateflow/shared/trusted-client-ip";

// Body validation. The password length cap is bcrypt's effective input
// limit (72 bytes) — anything longer is silently truncated by bcrypt
// itself, so accepting longer input is both useless and a CPU-DoS
// surface (callers could pass MB of "password" to burn CPU). The MFA
// fields are mutually exclusive at the application layer; here we just
// constrain shape so a corrupt request can't crash the route.
const adminLoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(72),
    mfaCode: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    backupCode: z
      .string()
      .trim()
      .min(8)
      .max(16)
      .optional(),
    rememberDevice: z.boolean().optional(),
  })
  .strict();

function parseLoginUA(ua: string) {
  const result = { browser: "Unknown", os: "Unknown", deviceType: "Desktop" };
  if (!ua) return result;
  if (ua.includes("Edg")) result.browser = "Edge";
  else if (ua.includes("OPR") || ua.includes("Opera")) result.browser = "Opera";
  else if (ua.includes("Chrome")) result.browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) result.browser = "Safari";
  else if (ua.includes("Firefox")) result.browser = "Firefox";
  if (ua.includes("Windows")) result.os = "Windows";
  else if (ua.includes("Mac OS")) result.os = "macOS";
  else if (ua.includes("Android")) result.os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) result.os = "iOS";
  else if (ua.includes("Linux")) result.os = "Linux";
  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) result.deviceType = "Mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) result.deviceType = "Tablet";
  return result;
}

async function writeLoginLog(input: {
  adminUserId?: string | null;
  email: string;
  success: boolean;
  failReason?: string | null;
  ip: string;
  ua: string;
  mfaUsed?: boolean;
  mfaMethod?: string | null;
}) {
  const parsed = parseLoginUA(input.ua);
  try {
    await prisma.adminLoginLog.create({
      data: {
        adminUserId: input.adminUserId || undefined,
        email: input.email,
        success: input.success,
        failReason: input.failReason || null,
        ipAddress: input.ip,
        userAgent: input.ua,
        browser: parsed.browser,
        os: parsed.os,
        mfaUsed: input.mfaUsed || false,
        mfaMethod: input.mfaMethod || null,
      },
    });
  } catch {}
}
// SEC-005: Rate limiter for admin login (5 attempts per 15 minutes per IP).
//
// Degradation contract (SEC-RL; mirrors the cron-guard precedent in
// apps/web/src/lib/cron-guard.ts and the admin step-up store):
//   - Upstash NOT configured  -> proceed on the in-process Map + loud warn.
//     Failing closed here would brick the only admin login path on low-cost
//     or first-boot deployments that have no Redis; the Map still enforces
//     the same limits per instance.
//   - Upstash configured but ERRORING -> FAIL CLOSED (503 via
//     `unavailable: true`). A degraded distributed limiter must not silently
//     hand brute-force protection to a per-instance Map whose counters an
//     attacker can dodge by spreading requests across replicas or waiting
//     out a deploy.
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes
const LOCKOUT_SECONDS = 30 * 60; // 30 minutes lockout after exceeding

interface AdminRateLimitPolicy {
  prefix: string;
  maxAttempts: number;
  windowSeconds: number;
  lockoutSeconds: number;
}

const ADMIN_LOGIN_RATE_LIMIT: AdminRateLimitPolicy = {
  prefix: "admin:login",
  maxAttempts: MAX_ATTEMPTS,
  windowSeconds: WINDOW_SECONDS,
  lockoutSeconds: LOCKOUT_SECONDS,
};

const ADMIN_MFA_RATE_LIMIT: AdminRateLimitPolicy = {
  prefix: "admin:mfa",
  maxAttempts: 4,
  windowSeconds: 5 * 60,
  lockoutSeconds: 15 * 60,
};

// In-memory fallback
interface LoginAttempt { count: number; resetAt: number; lockedUntil: number; }
const loginAttempts = new Map<string, LoginAttempt>();

const LIMITER_UNAVAILABLE_RETRY_SEC = 60;

const LOGIN_APP_ENV = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
const LOGIN_IS_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  LOGIN_APP_ENV === "production" ||
  LOGIN_APP_ENV === "staging" ||
  Boolean(process.env.DIGITALOCEAN_APP_ID);

let warnedLoginLimiterNoRedis = false;
let warnedLoginLimiterRedisError = false;

function warnLoginLimiterNoRedisOnce() {
  if (warnedLoginLimiterNoRedis) return;
  warnedLoginLimiterNoRedis = true;
  if (LOGIN_IS_PRODUCTION) {
    console.error(
      "[ADMIN-LOGIN-RL] UPSTASH_REDIS_REST_URL/_TOKEN are not configured — login rate limiting is per-instance in-memory only. Counters reset on every deploy/restart.",
    );
  } else {
    console.warn("[ADMIN-LOGIN-RL] Redis not configured — using in-memory login rate limiting (dev mode).");
  }
}

function scrubLimiterError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/https?:\/\/\S+/gi, "[URL_REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "[TOKEN_REDACTED]")
    .slice(0, 160);
}

async function writeLoginAuditLog(input: {
  action: "LOGIN_FAILED" | "LOGIN_BLOCKED" | "MFA_REQUIRED";
  email: string;
  ip: string;
  ua?: string;
  reason: string;
  adminId?: string;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminId || null,
      action: input.action,
      entityType: "AdminAuth",
      entityId: input.adminId || "login",
      changes: JSON.stringify({
        email: input.email,
        reason: input.reason,
        actor: input.adminId ? { adminId: input.adminId, userAgent: input.ua || null } : null,
      }),
      ipAddress: input.ip,
    },
  }).catch(() => null);
}

function resolveClientIP(request: NextRequest): string {
  return resolveTrustedClientIpFromHeaders(request.headers, {
    mode: process.env.TRUSTED_PROXY_HEADERS,
    vercelEnv: process.env.VERCEL_ENV,
    fallback: "unknown",
  });
}

function stableRateKeyHash(value: string | null | undefined): string {
  const input = value || "none";
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function buildAdminLoginRateKey(email: string, ip: string): string {
  return `email:${stableRateKeyHash(email.trim().toLowerCase())}:ip:${stableRateKeyHash(ip)}`;
}

function buildAdminMfaRateKey(adminId: string, ip: string): string {
  return `admin:${stableRateKeyHash(adminId)}:ip:${stableRateKeyHash(ip)}`;
}

async function checkLoginRateLimitRedis(
  key: string,
  policy: AdminRateLimitPolicy = ADMIN_LOGIN_RATE_LIMIT,
): Promise<{ allowed: boolean; retryAfterSec: number; unavailable?: boolean }> {
  const values = await getAdminRuntimeConfigValues([
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]);
  const url = values.UPSTASH_REDIS_REST_URL;
  const token = values.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.includes("REPLACE") || token.includes("REPLACE")) {
    // Unconfigured: documented availability fallback (per-instance Map) + warn.
    warnLoginLimiterNoRedisOnce();
    return checkLoginRateLimitMemory(key, policy);
  }

  try {
    const lockKey = `${policy.prefix}:lock:${key}`;
    const countKey = `${policy.prefix}:count:${key}`;
    const redisGet = async (path: string) => {
      const res = await fetch(`${url}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`UPSTASH_${res.status}`);
      return res.json();
    };

    // Check lockout first
    const lockData = await redisGet(`/get/${encodeURIComponent(lockKey)}`);
    if (lockData.result) {
      const ttlData = await redisGet(`/ttl/${encodeURIComponent(lockKey)}`);
      return { allowed: false, retryAfterSec: Math.max(ttlData.result || policy.lockoutSeconds, 1) };
    }

    // Increment counter
    const incrData = await redisGet(`/incr/${encodeURIComponent(countKey)}`);
    const count = incrData.result || 1;

    // Set TTL on first attempt
    if (count === 1) {
      try {
        await redisGet(`/expire/${encodeURIComponent(countKey)}/${policy.windowSeconds}`);
      } catch (err) {
        await redisGet(`/del/${encodeURIComponent(countKey)}`).catch(() => null);
        throw err;
      }
    }

    if (count > policy.maxAttempts) {
      // Lock the IP
      await redisGet(`/set/${encodeURIComponent(lockKey)}/locked/EX/${policy.lockoutSeconds}`);
      return { allowed: false, retryAfterSec: policy.lockoutSeconds };
    }

    return { allowed: true, retryAfterSec: 0 };
  } catch (err) {
    // Redis is CONFIGURED but erroring: FAIL CLOSED for this auth limiter.
    // Falling back to the per-instance Map here would let an attacker who can
    // induce (or wait for) Redis errors bypass the distributed counters. The
    // route maps `unavailable: true` to a 503 with Retry-After, so a healthy
    // operator retries shortly; brute force gets nothing.
    if (!warnedLoginLimiterRedisError) {
      warnedLoginLimiterRedisError = true;
      console.error(
        "[ADMIN-LOGIN-RL] Redis call failed with limiter configured — failing closed (503) for admin login:",
        scrubLimiterError(err),
      );
    }
    return { allowed: false, retryAfterSec: LIMITER_UNAVAILABLE_RETRY_SEC, unavailable: true };
  }
}

function checkLoginRateLimitMemory(
  key: string,
  policy: AdminRateLimitPolicy = ADMIN_LOGIN_RATE_LIMIT,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const memKey = `${policy.prefix}:${key}`;
  const entry = loginAttempts.get(memKey);

  if (entry && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }

  if (!entry || entry.resetAt < now) {
    loginAttempts.set(memKey, { count: 1, resetAt: now + policy.windowSeconds * 1000, lockedUntil: 0 });
    return { allowed: true, retryAfterSec: 0 };
  }

  entry.count++;
  if (entry.count > policy.maxAttempts) {
    entry.lockedUntil = now + policy.lockoutSeconds * 1000;
    return { allowed: false, retryAfterSec: policy.lockoutSeconds };
  }

  return { allowed: true, retryAfterSec: 0 };
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = adminLoginSchema.safeParse(body);
    if (!parsed.success) {
      // Generic message on shape failure — don't echo back the validator's
      // path/issue list, which would leak the schema.
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }
    const { email, password, mfaCode, backupCode, rememberDevice } = parsed.data;

    // SEC-005: Rate limiting
    const ip = resolveClientIP(request);
    const ua = request.headers.get("user-agent") || "unknown";
    const loginRateKey = buildAdminLoginRateKey(email, ip);
    const rateCheck = await checkLoginRateLimitRedis(loginRateKey);
    if (!rateCheck.allowed) {
      await prisma.rateLimitLog.create({
        data: {
          ipAddress: ip,
          endpoint: "POST /api/auth/login",
          count: MAX_ATTEMPTS,
          blocked: true,
          windowStart: new Date(Date.now() - WINDOW_SECONDS * 1000),
          windowEnd: new Date(Date.now() + rateCheck.retryAfterSec * 1000),
        },
      }).catch(() => null);
      await writeLoginAuditLog({
        action: "LOGIN_BLOCKED",
        email,
        ip,
        ua,
        reason: rateCheck.unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMIT_BLOCKED",
      });
      return NextResponse.json(
        {
          error: rateCheck.unavailable
            ? "Login temporarily unavailable. Please try again later."
            : "Too many login attempts. Please try again later.",
        },
        {
          status: rateCheck.unavailable ? 503 : 429,
          headers: { "Retry-After": String(rateCheck.retryAfterSec) },
        }
      );
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });

    // SEC-005: Unified error message — prevent username enumeration
    if (!admin || !admin.isActive) {
      trackFailedLogin(email, ip);
      const reason = admin ? "INACTIVE_ADMIN" : "UNKNOWN_EMAIL";
      await writeLoginAuditLog({ action: "LOGIN_FAILED", email, ip, ua, reason, adminId: admin?.id });
      await writeLoginLog({ adminUserId: admin?.id, email, success: false, failReason: reason, ip, ua });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      trackFailedLogin(email, ip);
      await writeLoginAuditLog({ action: "LOGIN_FAILED", email, ip, ua, reason: "INVALID_PASSWORD", adminId: admin.id });
      await writeLoginLog({ adminUserId: admin.id, email, success: false, failReason: "INVALID_PASSWORD", ip, ua });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // MFA check — if enabled, require TOTP, backup code, or a valid trusted device.
    const fp = await generateFingerprint(
      ip,
      ua,
      request.headers.get("accept-language"),
      request.headers.get("sec-ch-ua"),
    );
    let mfaTrustedDeviceUsed = false;
    let shouldExpireMfaTrustCookie = false;
    let trustedDeviceTokenToSet: string | null = null;

    if ((admin as any).mfaEnabled && (admin as any).mfaSecret) {
      const existingTrustToken = !mfaCode && !backupCode ? getAdminMfaTrustCookie(request) : null;
      if (existingTrustToken) {
        const trustedDevice = await findValidAdminMfaTrustedDevice({
          adminUserId: admin.id,
          token: existingTrustToken,
          fingerprint: fp,
        });
        mfaTrustedDeviceUsed = Boolean(trustedDevice);
        shouldExpireMfaTrustCookie = !trustedDevice;
      }

      if (!mfaTrustedDeviceUsed && !mfaCode && !backupCode) {
        await writeLoginAuditLog({ action: "MFA_REQUIRED", email, ip, ua, reason: "MFA_REQUIRED", adminId: admin.id });
        await writeLoginLog({ adminUserId: admin.id, email, success: false, failReason: "MFA_REQUIRED", ip, ua, mfaUsed: true, mfaMethod: null });
        const response = NextResponse.json({ error: "MFA required", requiresMfa: true }, { status: 403 });
        if (shouldExpireMfaTrustCookie) {
          expireAdminMfaTrustCookie(response, request.headers.get("host"));
        }
        return response;
      }

      if (!mfaTrustedDeviceUsed) {
        const mfaRateCheck = await checkLoginRateLimitRedis(
          buildAdminMfaRateKey(admin.id, ip),
          ADMIN_MFA_RATE_LIMIT,
        );
        if (!mfaRateCheck.allowed) {
          const mfaBlockReason = mfaRateCheck.unavailable ? "MFA_RATE_LIMIT_UNAVAILABLE" : "MFA_RATE_LIMIT_BLOCKED";
          await writeLoginAuditLog({
            action: "LOGIN_BLOCKED",
            email,
            ip,
            ua,
            reason: mfaBlockReason,
            adminId: admin.id,
          });
          await writeLoginLog({
            adminUserId: admin.id,
            email,
            success: false,
            failReason: mfaBlockReason,
            ip,
            ua,
            mfaUsed: true,
            mfaMethod: mfaCode ? "TOTP" : "BACKUP_CODE",
          });
          return NextResponse.json(
            {
              error: mfaRateCheck.unavailable
                ? "Login temporarily unavailable. Please try again later."
                : "Too many MFA attempts. Please try again later.",
            },
            {
              status: mfaRateCheck.unavailable ? 503 : 429,
              headers: { "Retry-After": String(mfaRateCheck.retryAfterSec) },
            },
          );
        }

        const secret = decrypt((admin as any).mfaSecret);
        if (!secret) {
          await writeLoginLog({ adminUserId: admin.id, email, success: false, failReason: "MFA_CONFIG_ERROR", ip, ua, mfaUsed: true, mfaMethod: mfaCode ? "TOTP" : "BACKUP_CODE" });
          return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        let mfaValid = false;

        if (mfaCode) {
          mfaValid = verifyTOTP(secret, mfaCode);
        } else if (backupCode) {
          // Verify and consume backup code. The DB column is a JSON string
          // of hashes; if the row got corrupted (manual edit, partial
          // migration), fall through to "invalid backup code" instead of
          // crashing the whole login route.
          const originalBackupCodes = (admin as any).mfaBackupCodes || "[]";
          let storedHashes: string[] = [];
          try {
            const decoded = JSON.parse(originalBackupCodes);
            if (Array.isArray(decoded)) storedHashes = decoded.filter((h) => typeof h === "string");
          } catch {
            storedHashes = [];
          }
          const matchIndex = await verifyBackupCode(backupCode, storedHashes);
          if (matchIndex >= 0) {
            // Remove used backup code
            storedHashes.splice(matchIndex, 1);
            const consumed = await prisma.adminUser.updateMany({
              where: { id: admin.id, mfaBackupCodes: originalBackupCodes },
              data: { mfaBackupCodes: JSON.stringify(storedHashes) },
            });
            mfaValid = consumed.count === 1;
          }
        }

        if (!mfaValid) {
          trackFailedLogin(email, ip);
          await writeLoginAuditLog({ action: "LOGIN_FAILED", email, ip, ua, reason: "INVALID_MFA", adminId: admin.id });
          await writeLoginLog({ adminUserId: admin.id, email, success: false, failReason: "INVALID_MFA", ip, ua, mfaUsed: true, mfaMethod: mfaCode ? "TOTP" : "BACKUP_CODE" });
          return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }
        if (backupCode) {
          await writeAdminAudit(
            {
              adminId: admin.id,
              email: admin.email,
              role: admin.role,
            },
            {
              action: "BACKUP_CODE_USED",
              entityType: "AdminAuth",
              entityId: admin.id,
              metadata: { operation: "admin_login", method: "BACKUP_CODE" },
              request: getAuditRequestMeta(request),
            },
          );
        }
        if (mfaCode && rememberDevice) {
          trustedDeviceTokenToSet = createAdminMfaTrustToken();
          const trustedParsedUA = parseLoginUA(ua);
          await rememberAdminMfaTrustedDevice({
            adminUserId: admin.id,
            token: trustedDeviceTokenToSet,
            fingerprint: fp,
            ipAddress: ip,
            userAgent: ua,
            deviceLabel: `${trustedParsedUA.browser} on ${trustedParsedUA.os}`,
          });
          await writeAdminAudit(
            {
              adminId: admin.id,
              email: admin.email,
              role: admin.role,
            },
            {
              action: "MFA_TRUSTED_DEVICE_CREATED",
              entityType: "AdminAuth",
              entityId: admin.id,
              metadata: { operation: "admin_login", expiresInDays: 30 },
              request: getAuditRequestMeta(request),
            },
          );
        }
      }
    }

    // Session fingerprinting — bind JWT to IP + User-Agent
    // Embed `mfaEnabled` in the JWT so the Edge-Runtime middleware can gate
    // access without a DB call. SUPER_ADMINs without MFA are steered to the
    // setup page (see admin middleware `applyMfaSetupGate`). The `mcp`
    // (mustChangePassword) claim is embedded for the same reason: an invited
    // admin who signs in with a temporary path is steered to
    // /set-password/change before any admin surface loads.
    const mustChangePassword = Boolean((admin as any).mustChangePassword);
    const token = await createSession(
      admin.id,
      admin.email,
      admin.role,
      fp,
      Boolean((admin as any).mfaEnabled),
      mustChangePassword,
    );

    // Create DB-tracked admin session
    const tokenH = await hashSessionToken(token);
    const parsedUA = parseLoginUA(ua);
    const mfaMethod = mfaTrustedDeviceUsed ? "TRUSTED_DEVICE" : mfaCode ? "TOTP" : backupCode ? "BACKUP_CODE" : null;
    const mfaWasUsed = Boolean((admin as any).mfaEnabled && ((admin as any).mfaSecret) && mfaMethod);
    try {
      await prisma.adminSession.create({
        data: {
          adminUserId: admin.id,
          tokenHash: tokenH,
          ipAddress: ip,
          userAgent: ua,
          browser: parsedUA.browser,
          os: parsedUA.os,
          deviceType: parsedUA.deviceType,
          expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000),
        },
      });
    } catch {}

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Track successful login for anomaly detection
    trackSuccessfulLogin(admin.email, ip, admin.id);

    await writeAdminAudit({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    }, {
      action: "LOGIN_SUCCESS",
      entityType: "AdminUser",
      entityId: admin.id,
      metadata: {
        mfaUsed: mfaWasUsed,
        mfaMethod,
        trustedDevice: mfaTrustedDeviceUsed,
      },
      request: getAuditRequestMeta(request),
    });

    // Write login log
    await writeLoginLog({
      adminUserId: admin.id, email, success: true, ip, ua,
      mfaUsed: mfaWasUsed, mfaMethod,
    });

    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        mfaEnabled: (admin as any).mfaEnabled || false,
        mustChangePassword,
      },
    });
    if (trustedDeviceTokenToSet) {
      setAdminMfaTrustCookie(response, trustedDeviceTokenToSet);
    }
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

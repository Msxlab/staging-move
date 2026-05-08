import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, generateFingerprint, hashSessionToken } from "@/lib/auth";
import { trackFailedLogin, trackSuccessfulLogin } from "@/lib/security-monitor";
import { verifyTOTP, verifyBackupCode } from "@/lib/totp";
import { decrypt } from "@/lib/shared-encryption";
import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";

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
// SEC-005: Rate limiter for admin login (5 attempts per 15 minutes per IP)
// Uses Upstash Redis when available, falls back to in-memory so admin access
// is not blocked during low-cost or first-boot deployments.
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

async function resolveAuditActorAdminId(email: string): Promise<string | null> {
  try {
    const matchedAdmin = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true },
    }).catch(() => null);
    if (matchedAdmin?.id) return matchedAdmin.id;

    const systemAdmin = await prisma.adminUser.findFirst({
      where: { isActive: true, role: "SUPER_ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }).catch(() => null);
    if (systemAdmin?.id) return systemAdmin.id;

    const fallbackAdmin = await prisma.adminUser.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }).catch(() => null);
    return fallbackAdmin?.id || null;
  } catch {
    return null;
  }
}

async function writeLoginAuditLog(input: {
  action: "LOGIN_FAILED" | "LOGIN_BLOCKED";
  email: string;
  ip: string;
  reason: string;
  adminId?: string;
}) {
  const auditAdminId = input.adminId || await resolveAuditActorAdminId(input.email);
  if (!auditAdminId) return;

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: auditAdminId,
      action: input.action,
      entityType: "AdminAuth",
      entityId: input.adminId || "login",
      changes: JSON.stringify({ email: input.email, reason: input.reason }),
      ipAddress: input.ip,
    },
  }).catch(() => null);
}

function resolveClientIP(request: NextRequest): string {
  if (process.env.VERCEL_ENV) {
    const vercelIp = request.headers.get("x-vercel-forwarded-for");
    if (vercelIp) return vercelIp.split(",")[0].trim();
  }

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unknown";
}

function stableRateKeyHash(value: string | null | undefined): string {
  return createHash("sha256").update(value || "none").digest("hex");
}

function buildAdminLoginRateKey(email: string, ip: string, userAgent: string): string {
  return `email:${stableRateKeyHash(email.trim().toLowerCase())}:ip:${stableRateKeyHash(ip)}:ua:${stableRateKeyHash(userAgent)}`;
}

function buildAdminMfaRateKey(adminId: string, ip: string, userAgent: string): string {
  return `admin:${stableRateKeyHash(adminId)}:ip:${stableRateKeyHash(ip)}:ua:${stableRateKeyHash(userAgent)}`;
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
  } catch {
    // Fallback to in-memory on Redis error. Upstash should improve distributed
    // protection, but it must not make the only admin login path unavailable.
    return checkLoginRateLimitMemory(key, policy);
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
    const { email, password, mfaCode, backupCode } = parsed.data;

    // SEC-005: Rate limiting
    const ip = resolveClientIP(request);
    const ua = request.headers.get("user-agent") || "unknown";
    const loginRateKey = buildAdminLoginRateKey(email, ip, ua);
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
      await writeLoginAuditLog({ action: "LOGIN_FAILED", email, ip, reason, adminId: admin?.id });
      await writeLoginLog({ adminUserId: admin?.id, email, success: false, failReason: reason, ip, ua });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      trackFailedLogin(email, ip);
      await writeLoginAuditLog({ action: "LOGIN_FAILED", email, ip, reason: "INVALID_PASSWORD", adminId: admin.id });
      await writeLoginLog({ adminUserId: admin.id, email, success: false, failReason: "INVALID_PASSWORD", ip, ua });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // MFA check — if enabled, require TOTP code or backup code
    if ((admin as any).mfaEnabled && (admin as any).mfaSecret) {
      if (!mfaCode && !backupCode) {
        await writeLoginLog({ adminUserId: admin.id, email, success: false, failReason: "MFA_REQUIRED", ip, ua, mfaUsed: true, mfaMethod: null });
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      const mfaRateCheck = await checkLoginRateLimitRedis(
        buildAdminMfaRateKey(admin.id, ip, ua),
        ADMIN_MFA_RATE_LIMIT,
      );
      if (!mfaRateCheck.allowed) {
        await writeLoginAuditLog({
          action: "LOGIN_BLOCKED",
          email,
          ip,
          reason: "MFA_RATE_LIMIT_BLOCKED",
          adminId: admin.id,
        });
        await writeLoginLog({
          adminUserId: admin.id,
          email,
          success: false,
          failReason: "MFA_RATE_LIMIT_BLOCKED",
          ip,
          ua,
          mfaUsed: true,
          mfaMethod: mfaCode ? "TOTP" : "BACKUP_CODE",
        });
        return NextResponse.json(
          { error: "Too many MFA attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(mfaRateCheck.retryAfterSec) } },
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
        await writeLoginAuditLog({ action: "LOGIN_FAILED", email, ip, reason: "INVALID_MFA", adminId: admin.id });
        await writeLoginLog({ adminUserId: admin.id, email, success: false, failReason: "INVALID_MFA", ip, ua, mfaUsed: true, mfaMethod: mfaCode ? "TOTP" : "BACKUP_CODE" });
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }
    }

    // Session fingerprinting — bind JWT to IP + User-Agent
    const fp = await generateFingerprint(
      ip,
      ua,
      request.headers.get("accept-language"),
      request.headers.get("sec-ch-ua"),
    );
    // Embed `mfaEnabled` in the JWT so the Edge-Runtime middleware can gate
    // access without a DB call. SUPER_ADMINs without MFA are steered to the
    // setup page (see admin middleware `applyMfaSetupGate`).
    const token = await createSession(
      admin.id,
      admin.email,
      admin.role,
      fp,
      Boolean((admin as any).mfaEnabled),
    );

    // Create DB-tracked admin session
    const tokenH = await hashSessionToken(token);
    const parsedUA = parseLoginUA(ua);
    const mfaWasUsed = Boolean((admin as any).mfaEnabled && ((admin as any).mfaSecret));
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
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        },
      });
    } catch {}

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Track successful login for anomaly detection
    trackSuccessfulLogin(admin.email, ip, admin.id);

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: "LOGIN",
        entityType: "AdminUser",
        entityId: admin.id,
        ipAddress: ip,
      },
    });

    // Write login log
    await writeLoginLog({
      adminUserId: admin.id, email, success: true, ip, ua,
      mfaUsed: mfaWasUsed, mfaMethod: mfaCode ? "TOTP" : backupCode ? "BACKUP_CODE" : null,
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        mfaEnabled: (admin as any).mfaEnabled || false,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

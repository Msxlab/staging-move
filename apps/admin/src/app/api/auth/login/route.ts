import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession, generateFingerprint, hashSessionToken } from "@/lib/auth";
import { trackFailedLogin, trackSuccessfulLogin } from "@/lib/security-monitor";
import { verifyTOTP, verifyBackupCode } from "@/lib/totp";
import { decrypt } from "@/lib/shared-encryption";

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
// Uses Upstash Redis when available, falls back to in-memory for development.
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes
const LOCKOUT_SECONDS = 30 * 60; // 30 minutes lockout after exceeding
const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

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

async function checkLoginRateLimitRedis(ip: string): Promise<{ allowed: boolean; retryAfterSec: number; unavailable?: boolean }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || url.includes("REPLACE")) {
    if (isProduction) {
      return { allowed: false, retryAfterSec: 60, unavailable: true };
    }
    return checkLoginRateLimitMemory(ip);
  }

  try {
    const lockKey = `admin:lock:${ip}`;
    const countKey = `admin:login:${ip}`;

    // Check lockout first
    const lockRes = await fetch(`${url}/get/${lockKey}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const lockData = await lockRes.json();
    if (lockData.result) {
      const ttlRes = await fetch(`${url}/ttl/${lockKey}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ttlData = await ttlRes.json();
      return { allowed: false, retryAfterSec: Math.max(ttlData.result || LOCKOUT_SECONDS, 1) };
    }

    // Increment counter
    const incrRes = await fetch(`${url}/incr/${countKey}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const incrData = await incrRes.json();
    const count = incrData.result || 1;

    // Set TTL on first attempt
    if (count === 1) {
      await fetch(`${url}/expire/${countKey}/${WINDOW_SECONDS}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (count > MAX_ATTEMPTS) {
      // Lock the IP
      await fetch(`${url}/set/${lockKey}/locked/EX/${LOCKOUT_SECONDS}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { allowed: false, retryAfterSec: LOCKOUT_SECONDS };
    }

    return { allowed: true, retryAfterSec: 0 };
  } catch {
    // Fallback to in-memory on Redis error
    if (isProduction) {
      return { allowed: false, retryAfterSec: 60, unavailable: true };
    }
    return checkLoginRateLimitMemory(ip);
  }
}

function checkLoginRateLimitMemory(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }

  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_SECONDS * 1000, lockedUntil: 0 });
    return { allowed: true, retryAfterSec: 0 };
  }

  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_SECONDS * 1000;
    return { allowed: false, retryAfterSec: LOCKOUT_SECONDS };
  }

  return { allowed: true, retryAfterSec: 0 };
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, mfaCode, backupCode } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // SEC-005: Rate limiting
    const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    const rateCheck = await checkLoginRateLimitRedis(ip);
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

    const ua = request.headers.get("user-agent") || "unknown";

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
        // Password is correct but MFA is needed
        return NextResponse.json({
          requiresMfa: true,
          message: "MFA verification required. Provide mfaCode or backupCode.",
        }, { status: 403 });
      }

      const secret = decrypt((admin as any).mfaSecret);
      if (!secret) {
        return NextResponse.json({ error: "MFA configuration error" }, { status: 500 });
      }

      let mfaValid = false;

      if (mfaCode) {
        mfaValid = verifyTOTP(secret, mfaCode);
      } else if (backupCode) {
        // Verify and consume backup code
        const storedHashes: string[] = (admin as any).mfaBackupCodes
          ? JSON.parse((admin as any).mfaBackupCodes)
          : [];
        const matchIndex = await verifyBackupCode(backupCode, storedHashes);
        if (matchIndex >= 0) {
          mfaValid = true;
          // Remove used backup code
          storedHashes.splice(matchIndex, 1);
          await prisma.adminUser.update({
            where: { id: admin.id },
            data: { mfaBackupCodes: JSON.stringify(storedHashes) },
          });
        }
      }

      if (!mfaValid) {
        trackFailedLogin(email, ip);
        await writeLoginAuditLog({ action: "LOGIN_FAILED", email, ip, reason: "INVALID_MFA", adminId: admin.id });
        await writeLoginLog({ adminUserId: admin.id, email, success: false, failReason: "INVALID_MFA", ip, ua, mfaUsed: true, mfaMethod: mfaCode ? "TOTP" : "BACKUP_CODE" });
        return NextResponse.json({ error: "Invalid MFA code" }, { status: 401 });
      }
    }

    // Session fingerprinting — bind JWT to IP + User-Agent
    const fp = await generateFingerprint(ip, ua);
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

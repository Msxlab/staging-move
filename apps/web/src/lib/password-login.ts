import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  createUserSession,
  generateFingerprint,
  generateMobileFingerprint,
} from "@/lib/user-auth";
import { rateLimit, getRateLimitKey, resolveClientIP } from "@/lib/rate-limit";
import {
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
} from "@/lib/login-lockout";
import { stableRateLimitHash } from "@/lib/rate-limit-policy";
import { emitSecurityEvent } from "@/lib/security-events";
import { decrypt } from "@/lib/shared-encryption";
import { verifyTOTP, verifyBackupCode } from "@/lib/totp";
import { extractRequestMeta } from "@/lib/audit";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";

const loginSchema = z.object({
  email: z.string().email().max(191).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
  mfaCode: z.string().length(6).optional(),
  backupCode: z.string().min(4).max(32).optional(),
});

type LoginClientType = "web" | "mobile";

export interface PasswordLoginOptions {
  clientType: LoginClientType;
  exposeBearerToken: boolean;
}

function parseUA(ua: string) {
  const r = { browser: "Unknown", os: "Unknown", deviceType: "Desktop" };
  if (!ua) return r;
  if (ua.includes("Edg")) r.browser = "Edge";
  else if (ua.includes("OPR") || ua.includes("Opera")) r.browser = "Opera";
  else if (ua.includes("Chrome")) r.browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) r.browser = "Safari";
  else if (ua.includes("Firefox")) r.browser = "Firefox";
  if (ua.includes("Windows")) r.os = "Windows";
  else if (ua.includes("Mac OS")) r.os = "macOS";
  else if (ua.includes("Android")) r.os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) r.os = "iOS";
  else if (ua.includes("Linux")) r.os = "Linux";
  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) r.deviceType = "Mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) r.deviceType = "Tablet";
  return r;
}

function sha256(value: string | null | undefined): string {
  return createHash("sha256").update(value || "none").digest("hex");
}

function buildLoginLockKey(email: string, ip: string, ua: string): string {
  return `email:${sha256(email.trim().toLowerCase())}:ip:${sha256(ip)}:ua:${sha256(ua)}`;
}

function emitLoginLockout(reason: string, lockKey: string, retryAfterSec: number) {
  emitSecurityEvent({
    type: "LOCKOUT_STARTED",
    severity: "warn",
    group: "auth_login",
    key: stableRateLimitHash(lockKey),
    retryAfterSeconds: retryAfterSec,
    context: { reason },
  });
}

function invalidMfaResponse() {
  return NextResponse.json({ error: "Invalid MFA code." }, { status: 401 });
}

export async function handlePasswordLogin(
  request: NextRequest,
  options: PasswordLoginOptions,
) {
  const ipKey = getRateLimitKey(request, "auth:login:ip");
  const ipRl = await rateLimit(ipKey, { limit: 10, windowSeconds: 15 * 60, failClosed: true });
  if (!ipRl.success) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((ipRl.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 });
  }

  const { email, password, mfaCode, backupCode } = parsed.data;
  const ip = resolveClientIP(request);
  const ua = request.headers.get("user-agent") || "";
  const lockKey = buildLoginLockKey(email, ip, ua);

  const lockState = await isLoginLocked(lockKey);
  if (lockState.locked) {
    return NextResponse.json(
      {
        error: lockState.unavailable
          ? "Login temporarily unavailable. Please try again later."
          : "Too many failed attempts. Please wait and try again.",
      },
      {
        status: lockState.unavailable ? 503 : 429,
        headers: { "Retry-After": String(lockState.retryAfterSec) },
      },
    );
  }

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

  if (!user || !user.passwordHash) {
    const nextState = await recordLoginFailure(lockKey);
    if (nextState.locked) {
      emitLoginLockout("UNKNOWN_OR_OAUTH_ONLY_ACCOUNT", lockKey, nextState.retryAfterSec);
      return NextResponse.json(
        { error: "Too many failed attempts. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(nextState.retryAfterSec) } },
      );
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    recordUserSecurityAudit({
      userId: user.id,
      action: "LOGIN_FAILED",
      entityId: user.id,
      changes: { reason: "INVALID_PASSWORD" },
      ...extractRequestMeta(request),
    });
    const nextState = await recordLoginFailure(lockKey);
    if (nextState.locked) {
      emitLoginLockout("INVALID_PASSWORD", lockKey, nextState.retryAfterSec);
      return NextResponse.json(
        { error: "Too many failed attempts. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(nextState.retryAfterSec) } },
      );
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (user.mfaEnabled && user.mfaSecret) {
    if (!mfaCode && !backupCode) {
      return NextResponse.json(
        { requiresMfa: true, message: "MFA verification required. Provide mfaCode or backupCode." },
        { status: 403 },
      );
    }

    const secret = decrypt(user.mfaSecret);
    if (!secret) {
      emitSecurityEvent({
        type: "MFA_FAILURE_BURST",
        severity: "error",
        group: "mfa_verify",
        key: stableRateLimitHash(`mfa_config:${user.id}`),
        context: { reason: "missing_decrypted_secret", userId: user.id },
      });
      return invalidMfaResponse();
    }

    let mfaValid = false;
    if (mfaCode) {
      mfaValid = verifyTOTP(secret, mfaCode);
    } else if (backupCode) {
      const originalBackupCodes = user.mfaBackupCodes || "[]";
      let storedHashes: string[] = [];
      try {
        const decoded = JSON.parse(originalBackupCodes);
        if (Array.isArray(decoded)) {
          storedHashes = decoded.filter((item) => typeof item === "string");
        }
      } catch {
        emitSecurityEvent({
          type: "MFA_FAILURE_BURST",
          severity: "error",
          group: "mfa_verify",
          key: stableRateLimitHash(`mfa_backup_corrupt:${user.id}`),
          context: { reason: "corrupt_backup_code_json", userId: user.id },
        });
        storedHashes = [];
      }
      const matchIndex = await verifyBackupCode(backupCode, storedHashes);
      if (matchIndex >= 0) {
        storedHashes.splice(matchIndex, 1);
        const consumed = await prisma.user.updateMany({
          where: { id: user.id, mfaBackupCodes: originalBackupCodes },
          data: { mfaBackupCodes: JSON.stringify(storedHashes) },
        });
        mfaValid = consumed.count === 1;
      }
    }

    if (!mfaValid) {
      recordUserSecurityAudit({
        userId: user.id,
        action: "MFA_FAILED",
        entityId: user.id,
        changes: { method: mfaCode ? "totp" : "backup_code" },
        ...extractRequestMeta(request),
      });
      emitSecurityEvent({
        type: "MFA_FAILURE_BURST",
        severity: "warn",
        group: "mfa_verify",
        key: stableRateLimitHash(`mfa_fail:${user.id}`),
        context: {
          method: mfaCode ? "totp" : "backup_code",
          userId: user.id,
        },
      });
      const nextState = await recordLoginFailure(lockKey);
      if (nextState.locked) {
        emitLoginLockout("MFA_FAIL_LOCKOUT", lockKey, nextState.retryAfterSec);
        return NextResponse.json(
          { error: "Too many failed attempts. Please wait and try again." },
          { status: 429, headers: { "Retry-After": String(nextState.retryAfterSec) } },
        );
      }
      return invalidMfaResponse();
    }
  }

  await clearLoginFailures(lockKey).catch(() => null);

  const parsedUA = parseUA(ua);
  const fp = options.clientType === "mobile"
    ? await generateMobileFingerprint(ua)
    : await generateFingerprint(ip, ua);
  const token = await createUserSession({
    userId: user.id,
    email: user.email,
    fingerprint: fp,
    clientType: options.clientType,
    ipAddress: ip,
    userAgent: ua,
    browser: parsedUA.browser,
    os: parsedUA.os,
    deviceType: parsedUA.deviceType,
  });
  recordUserSecurityAudit({
    userId: user.id,
    action: "LOGIN",
    entityId: user.id,
    changes: { status: "success", clientType: options.clientType },
    ...extractRequestMeta(request),
  });

  return NextResponse.json({
    success: true,
    ...(options.exposeBearerToken ? { token } : {}),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      emailVerified: Boolean(user.emailVerifiedAt),
      mfaEnabled: user.mfaEnabled,
    },
  });
}

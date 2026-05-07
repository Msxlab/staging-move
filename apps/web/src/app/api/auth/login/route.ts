import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  createUserSession,
  generateFingerprint,
  generateMobileFingerprint,
} from "@/lib/user-auth";
import { resolveClientIP } from "@/lib/rate-limit";
import {
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
} from "@/lib/login-lockout";
import {
  buildPolicyRateLimitKey,
  enforceRateLimitPolicy,
  stableRateLimitHash,
} from "@/lib/rate-limit-policy";
import { emitSecurityEvent } from "@/lib/security-events";
import { decrypt } from "@/lib/shared-encryption";
import { verifyTOTP, verifyBackupCode } from "@/lib/totp";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email().max(191).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
  mfaCode: z.string().length(6).optional(),
  backupCode: z.string().min(4).max(32).optional(),
});

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

export async function POST(request: NextRequest) {
  // General per-IP rate limit for the register/login cluster — absorbs
  // bursty clients without punishing individual accounts.
  const ipRl = await enforceRateLimitPolicy(request, "public_read", { routeId: "auth-login-preparse" });
  void ipRl.key;
  if (!ipRl.success) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((ipRl.resetAt - Date.now()) / 1000)) } },
    );
  }

  // Stricter per-IP lockout for password brute force: 5 *failed* attempts
  // within 15 min triggers a 30-min ban. Distinct from the bursty
  // rate-limit above — a legitimate user typing the wrong password once
  // on a NATed network won't lock out their neighbors because the
  // counter is reset on successful login (see clearLoginFailures).
  const ip = resolveClientIP(request);

  const lockState: { locked: boolean; retryAfterSec: number; unavailable?: boolean } = {
    locked: false,
    retryAfterSec: 0,
  };
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
  const ua = request.headers.get("user-agent") || "";
  const loginIdentity = { email, routeId: "password" };
  const loginRl = await enforceRateLimitPolicy(request, "auth_login", loginIdentity);
  if (!loginRl.success) {
    return NextResponse.json(
      {
        code: loginRl.policy.userFacingErrorCode,
        error: "Too many login attempts. Please wait and try again.",
      },
      { status: 429, headers: { "Retry-After": String(loginRl.retryAfterSeconds) } },
    );
  }

  const lockoutKey = buildPolicyRateLimitKey(request, "auth_login", loginIdentity);
  const focusedLockState = await isLoginLocked(lockoutKey);
  if (focusedLockState.locked) {
    console.warn("auth_lockout_hit", {
      route: "/api/auth/login",
      keyHash: stableRateLimitHash(lockoutKey),
      retryAfterSec: focusedLockState.retryAfterSec,
      unavailable: focusedLockState.unavailable === true,
    });
    return NextResponse.json(
      {
        code: focusedLockState.unavailable ? "AUTH_LIMIT_UNAVAILABLE" : "AUTH_COOLDOWN",
        error: focusedLockState.unavailable
          ? "Login temporarily unavailable. Please try again later."
          : "Too many failed attempts. Please wait and try again.",
      },
      {
        status: focusedLockState.unavailable ? 503 : 429,
        headers: { "Retry-After": String(focusedLockState.retryAfterSec) },
      },
    );
  }

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

  // SEC: single generic error — no user enumeration. A missing account
  // still consumes a lockout slot so an attacker cannot probe email
  // existence cheaply.
  if (!user || !user.passwordHash) {
    const nextState = await recordLoginFailure(lockoutKey);
    if (nextState.locked) {
      emitSecurityEvent({
        type: "LOCKOUT_STARTED",
        severity: "warn",
        group: "auth_login",
        key: stableRateLimitHash(lockoutKey),
        retryAfterSeconds: nextState.retryAfterSec,
        context: { reason: "UNKNOWN_OR_OAUTH_ONLY_ACCOUNT" },
      });
      return NextResponse.json(
        { error: "Too many failed attempts. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(nextState.retryAfterSec) } },
      );
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    const nextState = await recordLoginFailure(lockoutKey);
    if (nextState.locked) {
      emitSecurityEvent({
        type: "LOCKOUT_STARTED",
        severity: "warn",
        group: "auth_login",
        key: stableRateLimitHash(lockoutKey),
        retryAfterSeconds: nextState.retryAfterSec,
        context: { reason: "INVALID_PASSWORD" },
      });
      return NextResponse.json(
        { error: "Too many failed attempts. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(nextState.retryAfterSec) } },
      );
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // MFA gate.
  if (user.mfaEnabled && user.mfaSecret) {
    if (!mfaCode && !backupCode) {
      return NextResponse.json(
        { requiresMfa: true, message: "MFA verification required. Provide mfaCode or backupCode." },
        { status: 403 },
      );
    }

    const mfaRl = await enforceRateLimitPolicy(request, "mfa_verify", {
      email,
      userId: user.id,
      routeId: backupCode ? "login_backup_code" : "login_totp",
    });
    if (!mfaRl.success) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "MFA_LIMIT",
          entityType: "User",
          entityId: user.id,
          changes: JSON.stringify({ method: backupCode ? "backup_code" : "totp" }),
          ipAddress: ip,
          userAgent: ua,
        },
      }).catch(() => null);
      return NextResponse.json(
        {
          code: mfaRl.policy.userFacingErrorCode,
          error: "Too many verification attempts. Please wait and try again.",
        },
        { status: 429, headers: { "Retry-After": String(mfaRl.retryAfterSeconds) } },
      );
    }

    const secret = decrypt(user.mfaSecret);
    if (!secret) {
      return NextResponse.json({ error: "MFA configuration error." }, { status: 500 });
    }

    let mfaValid = false;
    if (mfaCode) {
      mfaValid = verifyTOTP(secret, mfaCode);
    } else if (backupCode) {
      const originalBackupCodes = user.mfaBackupCodes || "[]";
      let storedHashes: string[] = [];
      try {
        const decoded = JSON.parse(originalBackupCodes);
        if (Array.isArray(decoded)) storedHashes = decoded.filter((item) => typeof item === "string");
      } catch {
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
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "MFA_FAIL",
          entityType: "User",
          entityId: user.id,
          changes: JSON.stringify({ method: mfaCode ? "totp" : "backup_code" }),
          ipAddress: ip,
          userAgent: ua,
        },
      }).catch(() => null);
      emitSecurityEvent({
        type: "MFA_FAILURE_BURST",
        severity: "warn",
        group: "mfa_verify",
        key: stableRateLimitHash(`mfa_fail:${user.id}`),
        context: {
          method: mfaCode ? "totp" : "backup_code",
          // userId is hashed elsewhere; here it is a known-internal id
          // and not externally enumerable, so we keep it for triage.
          userId: user.id,
        },
      });
      const nextState = await recordLoginFailure(lockoutKey);
      if (nextState.locked) {
        emitSecurityEvent({
          type: "LOCKOUT_STARTED",
          severity: "warn",
          group: "auth_login",
          key: stableRateLimitHash(lockoutKey),
          retryAfterSeconds: nextState.retryAfterSec,
          context: { reason: "MFA_FAIL_LOCKOUT" },
        });
        return NextResponse.json(
          { error: "Too many failed attempts. Please wait and try again." },
          { status: 429, headers: { "Retry-After": String(nextState.retryAfterSec) } },
        );
      }
      return NextResponse.json({ error: "Invalid MFA code." }, { status: 401 });
    }
  }

  // Successful auth — reset the failure counter for this IP so legitimate
  // retries after a typo don't accumulate against future sessions.
  await clearLoginFailures(lockoutKey).catch(() => null);

  const parsedUA = parseUA(ua);
  // Mobile clients can signal their client type explicitly; otherwise fall
  // back to UA-derived deviceType. Mobile sessions use UA-only fingerprint
  // so network switches (Wi-Fi ↔ LTE) don't invalidate them.
  const clientHeader = (request.headers.get("x-client-type") || "").toLowerCase();
  const isMobileClient =
    clientHeader === "mobile" ||
    parsedUA.deviceType === "Mobile" ||
    parsedUA.deviceType === "Tablet";
  const fp = isMobileClient
    ? await generateMobileFingerprint(ua)
    : await generateFingerprint(ip, ua);
  const token = await createUserSession({
    userId: user.id,
    email: user.email,
    fingerprint: fp,
    clientType: isMobileClient ? "mobile" : "web",
    ipAddress: ip,
    userAgent: ua,
    browser: parsedUA.browser,
    os: parsedUA.os,
    deviceType: parsedUA.deviceType,
  });

  // Web receives the session via httpOnly cookie (set by createUserSession).
  // Mobile parses `token` from the JSON body and stores it in SecureStore.
  return NextResponse.json({
    success: true,
    token,
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

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  hashPassword,
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

// Lazily-computed throwaway bcrypt hash. Used to make the "no such user /
// OAuth-only account" path spend the same wall-clock time as a real password
// verification. Without it, the presence of a password-backed account is
// observable through response latency (bcrypt only runs when a passwordHash
// exists), which leaks account existence — a user-enumeration oracle.
let cachedDummyPasswordHash: string | null = null;
async function equalizePasswordTiming(password: string): Promise<void> {
  try {
    if (!cachedDummyPasswordHash) {
      cachedDummyPasswordHash = await hashPassword("locateflow-timing-equalizer");
    }
    await verifyPassword(password, cachedDummyPasswordHash);
  } catch {
    // The equalizer is best-effort and must never affect the login outcome.
  }
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
  // Coarse per-IP burst limit before parsing — absorbs scripted floods
  // without punishing per-user lockout.
  const ipRl = await enforceRateLimitPolicy(request, "public_read", {
    routeId: "auth-login-preparse",
    clientType: options.clientType,
  });
  if (!ipRl.success) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfterSeconds) } },
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

  // Per-(email,IP,UA) login attempt rate-limit. Distinct from the IP burst
  // limit above; this one drives lockout decisions.
  const loginIdentity = {
    email,
    routeId: options.clientType === "mobile" ? "mobile-login" : "password",
    clientType: options.clientType,
  } as const;
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

  const lockKey = buildPolicyRateLimitKey(request, "auth_login", loginIdentity);

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
    // Spend the same time as a genuine bcrypt check so this branch is
    // indistinguishable from a wrong password by response latency.
    await equalizePasswordTiming(password);
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

    // Per-(user, method) MFA verification limit. Distinct from the
    // login attempt limiter so legitimate password retries aren't
    // counted against MFA. The policy maps to userFacingErrorCode
    // "MFA_RATE_LIMITED".
    const mfaRl = await enforceRateLimitPolicy(request, "mfa_verify", {
      email,
      userId: user.id,
      routeId: backupCode ? "login_backup_code" : "login_totp",
      clientType: options.clientType,
    });
    if (!mfaRl.success) {
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
      hasPasswordLogin: Boolean(user.passwordHash),
      // Password-login path only succeeds when the user supplied a valid
      // password, so by definition they don't need to set one.
      needsPasswordSetup: false,
      mfaEnabled: user.mfaEnabled,
    },
  });
}

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
import { recordFailedLoginForAlerting } from "@/lib/security-alerts";
import { decrypt } from "@/lib/shared-encryption";
import { verifyTOTP, verifyBackupCode } from "@/lib/totp";
import { extractRequestMeta } from "@/lib/audit";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";
import {
  getConfiguredStoreReviewAccountEmails,
  provisionStoreReviewAccount,
} from "@/lib/store-review-account";
import { applyQaPersonaSubscriptionForUser } from "@/lib/qa-account";

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

/**
 * Resolves the native-app platform for the session label. The mobile client
 * sends an explicit `X-Client-Platform` header ("ios"/"android") on every
 * request; we trust that first. When it's absent (e.g. an older build) we fall
 * back to sniffing the descriptive `User-Agent` the client also sets
 * ("LocateFlow/<version> (iOS; Expo)"). Returns null for ordinary browsers.
 */
function detectMobileClient(
  ua: string,
  clientPlatformHeader?: string | null,
): "iOS" | "Android" | "Mobile" | null {
  const platform = clientPlatformHeader?.trim().toLowerCase();
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  if (platform === "ipados") return "iOS";

  // Fall back to the descriptive UA the mobile client sends. Only treat it as
  // the native app when the LocateFlow marker is present, so we never
  // mislabel a real mobile browser as the app.
  if (/LocateFlow/i.test(ua)) {
    if (/iOS|iPhone|iPad|iPod|Darwin/i.test(ua)) return "iOS";
    if (/Android/i.test(ua)) return "Android";
    return "Mobile";
  }
  return null;
}

/**
 * Computes the session device label for a known-native mobile request. Used by
 * the mobile OAuth handoff routes (exchange / apple-native) which create the
 * session directly rather than going through {@link parseUA}. Always returns a
 * "LocateFlow ..." browser label and an OS, never "Unknown browser".
 */
export function labelMobileSession(
  ua: string,
  clientPlatformHeader?: string | null,
): { browser: string; os: string } {
  const platform = detectMobileClient(ua, clientPlatformHeader) ?? "Mobile";
  if (platform === "iOS") return { browser: "LocateFlow iOS app", os: "iOS" };
  if (platform === "Android") return { browser: "LocateFlow Android app", os: "Android" };
  return { browser: "LocateFlow app", os: "Mobile" };
}

function parseUA(ua: string, clientPlatformHeader?: string | null) {
  const r = { browser: "Unknown", os: "Unknown", deviceType: "Desktop" };

  // Native app first: when the request carries our client-platform header (or a
  // LocateFlow User-Agent), label the session as the app instead of falling
  // through to browser parsing — the native UA has no Chrome/Safari token, so
  // it would otherwise resolve to "Unknown browser".
  const mobilePlatform = detectMobileClient(ua, clientPlatformHeader);
  if (mobilePlatform) {
    r.deviceType = "Mobile";
    if (mobilePlatform === "iOS") {
      r.browser = "LocateFlow iOS app";
      r.os = "iOS";
    } else if (mobilePlatform === "Android") {
      r.browser = "LocateFlow Android app";
      r.os = "Android";
    } else {
      r.browser = "LocateFlow app";
      r.os = "Mobile";
    }
    return r;
  }

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
    // Detection-only alarm counter (email to the operator past a burst
    // threshold). Fire-and-forget: it never throws/rejects by contract and
    // must never delay or alter the login response.
    void recordFailedLoginForAlerting({ email, ip, clientType: options.clientType });
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
    // Detection-only alarm counter — see the unknown-account branch above.
    void recordFailedLoginForAlerting({ email, ip, clientType: options.clientType });
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

  let emailVerifiedAt = user.emailVerifiedAt;
  const storeReviewEmails: string[] = await getConfiguredStoreReviewAccountEmails().catch((): string[] => []);
  const isStoreReviewAccount = storeReviewEmails.includes(user.email.toLowerCase());
  if (isStoreReviewAccount) {
    if (!emailVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
      emailVerifiedAt = new Date();
    }
    await provisionStoreReviewAccount({ userId: user.id, request }).catch((error) => {
      console.warn("Failed to provision store review account during login:", error);
    });
  }

  if (user.mfaEnabled && user.mfaSecret) {
    if (!mfaCode && !backupCode) {
      return NextResponse.json(
        // `code` lets the mobile API client (which drops the body on non-2xx
        // and surfaces only error+code) detect the MFA challenge. `requiresMfa`
        // is kept for the web browser flow. Additive — no status/contract change.
        { requiresMfa: true, code: "MFA_REQUIRED", message: "MFA verification required. Provide mfaCode or backupCode." },
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
      // MFA failures count as failed logins for the alarm too — a wrong-MFA
      // burst means someone already holds a valid password.
      void recordFailedLoginForAlerting({ email, ip, clientType: options.clientType });
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
  await applyQaPersonaSubscriptionForUser({ userId: user.id, email: user.email }).catch((error) => {
    console.warn("Failed to apply QA persona subscription during login:", error);
  });

  const parsedUA = parseUA(ua, request.headers.get("x-client-platform"));
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
      emailVerified: Boolean(emailVerifiedAt),
      hasPasswordLogin: Boolean(user.passwordHash),
      // Password-login path only succeeds when the user supplied a valid
      // password, so by definition they don't need to set one.
      needsPasswordSetup: false,
      mfaEnabled: user.mfaEnabled,
    },
  });
}

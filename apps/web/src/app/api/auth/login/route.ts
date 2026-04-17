import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  createUserSession,
  generateFingerprint,
} from "@/lib/user-auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
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
  // IP-based login rate limit (stricter than general API limit):
  // 10 attempts / 15 min / IP — shared with register endpoint bucket.
  const ipKey = getRateLimitKey(request, "auth:login:ip");
  const ipRl = await rateLimit(ipKey, { limit: 10, windowSeconds: 15 * 60 });
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
  const ua = request.headers.get("user-agent") || "";
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ip = forwardedFor.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";

  const user = await prisma.user.findUnique({ where: { email } });

  // SEC: single generic error — no user enumeration.
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
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

    const secret = decrypt(user.mfaSecret);
    if (!secret) {
      return NextResponse.json({ error: "MFA configuration error." }, { status: 500 });
    }

    let mfaValid = false;
    if (mfaCode) {
      mfaValid = verifyTOTP(secret, mfaCode);
    } else if (backupCode) {
      const storedHashes: string[] = user.mfaBackupCodes ? JSON.parse(user.mfaBackupCodes) : [];
      const matchIndex = await verifyBackupCode(backupCode, storedHashes);
      if (matchIndex >= 0) {
        mfaValid = true;
        storedHashes.splice(matchIndex, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaBackupCodes: JSON.stringify(storedHashes) },
        });
      }
    }

    if (!mfaValid) {
      return NextResponse.json({ error: "Invalid MFA code." }, { status: 401 });
    }
  }

  const fp = await generateFingerprint(ip, ua);
  const parsedUA = parseUA(ua);
  const token = await createUserSession({
    userId: user.id,
    email: user.email,
    fingerprint: fp,
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

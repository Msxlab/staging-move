import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";
import { shouldUseSecureAdminCookies } from "./auth";

export const ADMIN_MFA_TRUST_COOKIE_NAME = "admin_mfa_trust";
export const ADMIN_MFA_TRUST_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createAdminMfaTrustToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAdminMfaTrustToken(token: string): string {
  return sha256(`admin-mfa-trust:${token}`);
}

function hashAdminMfaTrustFingerprint(fingerprint: string): string {
  return sha256(`admin-mfa-trust-fp:${fingerprint}`);
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function adminCookieDomainCandidates(_host?: string | null): Array<string | undefined> {
  const configured = (process.env.ADMIN_SESSION_COOKIE_DOMAIN || process.env.SESSION_COOKIE_DOMAIN || "").trim();
  const candidates: Array<string | undefined> = [undefined];
  if (configured) candidates.push(configured);
  return Array.from(new Set(candidates));
}

function trustCookieOptions(domain?: string) {
  return {
    httpOnly: true,
    secure: shouldUseSecureAdminCookies(),
    sameSite: "strict" as const,
    path: "/api/auth/login",
    ...(domain ? { domain } : {}),
  };
}

export function getAdminMfaTrustCookie(request: NextRequest): string | null {
  const token = request.cookies.get(ADMIN_MFA_TRUST_COOKIE_NAME)?.value;
  return token && token.length >= 32 ? token : null;
}

export async function findValidAdminMfaTrustedDevice(input: {
  adminUserId: string;
  token: string;
  fingerprint: string;
}): Promise<{ id: string; expiresAt: Date } | null> {
  const now = new Date();
  const tokenHash = hashAdminMfaTrustToken(input.token);
  const fingerprintHash = hashAdminMfaTrustFingerprint(input.fingerprint);
  const device = await prisma.adminMfaTrustedDevice.findFirst({
    where: {
      adminUserId: input.adminUserId,
      tokenHash,
      fingerprintHash,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true, expiresAt: true },
  });

  if (!device) return null;

  await prisma.adminMfaTrustedDevice.updateMany({
    where: { id: device.id, revokedAt: null },
    data: { lastUsedAt: now },
  }).catch(() => null);

  return device;
}

export async function rememberAdminMfaTrustedDevice(input: {
  adminUserId: string;
  token: string;
  fingerprint: string;
  ipAddress: string;
  userAgent: string;
  deviceLabel: string;
}): Promise<Date> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_MFA_TRUST_MAX_AGE_SECONDS * 1000);
  const fingerprintHash = hashAdminMfaTrustFingerprint(input.fingerprint);

  await prisma.adminMfaTrustedDevice.updateMany({
    where: {
      adminUserId: input.adminUserId,
      fingerprintHash,
      revokedAt: null,
    },
    data: { revokedAt: now },
  }).catch(() => null);

  await prisma.adminMfaTrustedDevice.create({
    data: {
      adminUserId: input.adminUserId,
      tokenHash: hashAdminMfaTrustToken(input.token),
      fingerprintHash,
      deviceLabel: truncate(input.deviceLabel, 120),
      ipAddress: truncate(input.ipAddress, 45),
      userAgent: truncate(input.userAgent, 500),
      expiresAt,
    },
  });

  return expiresAt;
}

export async function revokeAdminMfaTrustedDevices(adminUserId: string): Promise<void> {
  await prisma.adminMfaTrustedDevice.updateMany({
    where: { adminUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  }).catch(() => null);
}

export function setAdminMfaTrustCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(ADMIN_MFA_TRUST_COOKIE_NAME, token, {
    ...trustCookieOptions(),
    maxAge: ADMIN_MFA_TRUST_MAX_AGE_SECONDS,
  });
  return response;
}

export function expireAdminMfaTrustCookie(response: NextResponse, host?: string | null): NextResponse {
  for (const domain of adminCookieDomainCandidates(host)) {
    response.cookies.set(ADMIN_MFA_TRUST_COOKIE_NAME, "", {
      ...trustCookieOptions(domain),
      maxAge: 0,
      expires: new Date(0),
    });
  }
  return response;
}

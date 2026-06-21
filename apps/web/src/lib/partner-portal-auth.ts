// Generic-partner self-service portal — magic-link "session" auth (R4d).
// Mirrors lib/mover-portal-auth.ts: an APPROVED partner requests a magic link by
// email; the link carries an opaque token whose sha256 hash is stored
// (PartnerPortalToken). The raw token lives in an httpOnly cookie and IS the
// session (14-day TTL, invalidated by revokedAt/expiry or the partner losing
// APPROVED status). A login request never reveals whether an email matches a
// partner (returns null silently; the route always answers generically).

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/user-auth";

export const PARTNER_PORTAL_COOKIE = "partner_portal";
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const TOKEN_TTL_SEC = Math.floor(TOKEN_TTL_MS / 1000);

export interface PartnerPortalSession {
  partnerId: string;
  email: string;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function requestPartnerPortalLink(
  email: string,
): Promise<{ token: string; partnerId: string; companyName: string } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const partner = await prisma.partner
    .findFirst({
      where: { contactEmail: normalized, status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      select: { id: true, companyName: true },
    })
    .catch(() => null);
  if (!partner) return null;

  // Cap to a single active link per partner and prune the table (audit P2):
  // supersede any prior tokens for this partner before issuing a new one, so the
  // row count stays bounded and an old link can't linger after a re-request.
  await prisma.partnerPortalToken.deleteMany({ where: { partnerId: partner.id } }).catch(() => {});

  const { token, hash } = generateOpaqueToken();
  await prisma.partnerPortalToken.create({
    data: {
      partnerId: partner.id,
      email: normalized,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return { token, partnerId: partner.id, companyName: partner.companyName };
}

export async function consumePartnerPortalToken(rawToken: string): Promise<PartnerPortalSession | null> {
  const session = await resolveTokenToSession(rawToken);
  if (!session) return null;
  const cookieStore = await cookies();
  cookieStore.set(PARTNER_PORTAL_COOKIE, rawToken, { ...cookieOptions(), maxAge: TOKEN_TTL_SEC });
  return session;
}

export async function getPartnerPortalSession(): Promise<PartnerPortalSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PARTNER_PORTAL_COOKIE)?.value;
  if (!raw) return null;
  return resolveTokenToSession(raw, { touch: true });
}

async function resolveTokenToSession(
  rawToken: string,
  opts: { touch?: boolean } = {},
): Promise<PartnerPortalSession | null> {
  const trimmed = rawToken?.trim();
  if (!trimmed) return null;
  const tokenHash = hashOpaqueToken(trimmed);
  const record = await prisma.partnerPortalToken
    .findUnique({
      where: { tokenHash },
      select: { id: true, partnerId: true, email: true, expiresAt: true, revokedAt: true },
    })
    .catch(() => null);
  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) return null;

  // The session must not outlive the partner's APPROVED status (an admin can
  // reject/needs-info a partner at any time).
  const partner = await prisma.partner
    .findUnique({ where: { id: record.partnerId }, select: { status: true } })
    .catch(() => null);
  if (!partner || partner.status !== "APPROVED") return null;

  if (opts.touch) {
    void prisma.partnerPortalToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { partnerId: record.partnerId, email: record.email };
}

export async function clearPartnerPortalSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PARTNER_PORTAL_COOKIE)?.value;
  if (raw) {
    const tokenHash = hashOpaqueToken(raw.trim());
    await prisma.partnerPortalToken
      .updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => {});
  }
  cookieStore.set(PARTNER_PORTAL_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

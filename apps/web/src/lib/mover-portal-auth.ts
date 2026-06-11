// Mover self-service portal — magic-link "session" auth (v2).
// =============================================================================
// An approved mover manages its own listing without a password: it requests a
// magic link by email, and the link carries an opaque token. We store only the
// token's sha256 hash (MoverPortalToken), put the raw token in an httpOnly
// cookie, and validate it per request — the token IS the session (multi-day
// TTL, invalidated by revokedAt or expiry). Reuses the same opaque-token
// helpers the email-verification / password-reset flows use.
//
// Privacy: a login request NEVER reveals whether an email matches an approved
// mover (requestMoverPortalLink returns null silently); the public route always
// answers with a generic "if it matches, we sent a link".

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/user-auth";

export const MOVER_PORTAL_COOKIE = "mover_portal";
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const TOKEN_TTL_SEC = Math.floor(TOKEN_TTL_MS / 1000);

export interface MoverPortalSession {
  movingCompanyId: string;
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

/**
 * Issue a magic-link token for an approved mover with this contact email.
 * Returns the RAW token (to embed in the emailed link) + the company, or null
 * when no approved mover matches — callers must treat null as "send nothing"
 * while still showing the generic success message (no account enumeration).
 */
export async function requestMoverPortalLink(
  email: string,
): Promise<{ token: string; movingCompanyId: string; companyName: string } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  // An approved application whose listing was created/linked is the gate.
  const application = await prisma.moverApplication
    .findFirst({
      where: { contactEmail: normalized, status: "APPROVED", linkedMovingCompanyId: { not: null } },
      orderBy: { reviewedAt: "desc" },
      select: { linkedMovingCompanyId: true, companyLegalName: true },
    })
    .catch(() => null);
  if (!application?.linkedMovingCompanyId) return null;

  // Confirm the linked company still exists + is active.
  const company = await prisma.movingCompany
    .findUnique({ where: { id: application.linkedMovingCompanyId }, select: { id: true, active: true } })
    .catch(() => null);
  if (!company || !company.active) return null;

  const { token, hash } = generateOpaqueToken();
  await prisma.moverPortalToken.create({
    data: {
      movingCompanyId: company.id,
      email: normalized,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return { token, movingCompanyId: company.id, companyName: application.companyLegalName };
}

/**
 * Validate a raw token (from the magic link) and, on success, set the portal
 * cookie. Returns the session or null. Used by the /enter route handler.
 */
export async function consumeMoverPortalToken(rawToken: string): Promise<MoverPortalSession | null> {
  const session = await resolveTokenToSession(rawToken);
  if (!session) return null;
  const cookieStore = await cookies();
  cookieStore.set(MOVER_PORTAL_COOKIE, rawToken, { ...cookieOptions(), maxAge: TOKEN_TTL_SEC });
  return session;
}

/** Read + validate the portal cookie. Best-effort bumps lastUsedAt. */
export async function getMoverPortalSession(): Promise<MoverPortalSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MOVER_PORTAL_COOKIE)?.value;
  if (!raw) return null;
  return resolveTokenToSession(raw, { touch: true });
}

async function resolveTokenToSession(
  rawToken: string,
  opts: { touch?: boolean } = {},
): Promise<MoverPortalSession | null> {
  const trimmed = rawToken?.trim();
  if (!trimmed) return null;
  const tokenHash = hashOpaqueToken(trimmed);
  const record = await prisma.moverPortalToken
    .findUnique({
      where: { tokenHash },
      select: { id: true, movingCompanyId: true, email: true, expiresAt: true, revokedAt: true },
    })
    .catch(() => null);
  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) return null;

  if (opts.touch) {
    void prisma.moverPortalToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { movingCompanyId: record.movingCompanyId, email: record.email };
}

/** Revoke the current token (logout) and clear the cookie. */
export async function clearMoverPortalSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MOVER_PORTAL_COOKIE)?.value;
  if (raw) {
    const tokenHash = hashOpaqueToken(raw.trim());
    await prisma.moverPortalToken
      .updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => {});
  }
  cookieStore.set(MOVER_PORTAL_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

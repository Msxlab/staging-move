import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Single-use, expiring set-password token primitives for the admin INVITE
 * flow (and forced first-login rotation). Mirrors the existing token-hash
 * pattern used by AdminActionOtp / WorkspaceInvitation: only sha256(token)
 * is ever stored — the plaintext is embedded in the invite link and never
 * persisted.
 */

export const INVITE_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
export const INVITE_TOKEN_MAX_ATTEMPTS = 10;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Generate a high-entropy, URL-safe token. 32 bytes → 43 base64url chars.
 * Returned plaintext is shown to the operator/invitee exactly once (in the
 * email link); only its hash is stored.
 */
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256Hex(token) };
}

/**
 * Constant-time comparison of two hex digests of equal length. Both inputs
 * here are sha256 hex (64 chars) so lengths always match; the length guard
 * is defense-in-depth.
 */
export function safeHashEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Mint a fresh set-password token for an admin, superseding any prior
 * unconsumed tokens for the same admin+purpose so only the newest link can
 * be redeemed. Returns the plaintext token (for the email) and the row's
 * expiry.
 */
export async function issueSetPasswordToken(opts: {
  adminUserId: string;
  purpose?: "INVITE" | "RESET";
  createdBy?: string | null;
  ttlMs?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const purpose = opts.purpose || "INVITE";
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (opts.ttlMs ?? INVITE_TOKEN_TTL_MS));
  const { token, tokenHash } = generateInviteToken();

  // Supersede prior unconsumed tokens for this admin+purpose.
  await prisma.adminSetPasswordToken.updateMany({
    where: { adminUserId: opts.adminUserId, purpose, consumedAt: null },
    data: { consumedAt: now },
  });

  await prisma.adminSetPasswordToken.create({
    data: {
      adminUserId: opts.adminUserId,
      purpose,
      tokenHash,
      expiresAt,
      createdBy: opts.createdBy ?? null,
    },
  });

  return { token, expiresAt };
}

export interface ResolvedSetPasswordToken {
  id: string;
  adminUserId: string;
  purpose: string;
  expiresAt: Date;
}

/**
 * Look up a set-password token by its plaintext value WITHOUT consuming it.
 * Returns null when the token is unknown, already consumed, or expired.
 * Used by the validation GET so the page can decide whether to render the
 * form before the invitee submits a new password.
 */
export async function resolveSetPasswordToken(
  token: string,
): Promise<ResolvedSetPasswordToken | null> {
  if (!token || token.length < 16 || token.length > 256) return null;
  const tokenHash = sha256Hex(token);
  const row = await prisma.adminSetPasswordToken.findUnique({
    where: { tokenHash },
    select: { id: true, adminUserId: true, purpose: true, expiresAt: true, consumedAt: true },
  });
  if (!row) return null;
  if (row.consumedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    purpose: row.purpose,
    expiresAt: row.expiresAt,
  };
}

/**
 * Atomically consume a set-password token. Returns the row only if this call
 * is the one that flipped consumedAt from null — a concurrent redeem of the
 * same token loses the race and gets null. Prevents a token from being used
 * twice even under simultaneous requests.
 */
export async function consumeSetPasswordToken(
  token: string,
): Promise<ResolvedSetPasswordToken | null> {
  const resolved = await resolveSetPasswordToken(token);
  if (!resolved) return null;
  const consumed = await prisma.adminSetPasswordToken.updateMany({
    where: { id: resolved.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return null;
  return resolved;
}

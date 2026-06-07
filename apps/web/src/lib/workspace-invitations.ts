/**
 * Workspace invitation token + seat helpers (doc 04).
 *
 * Token: `wsi_` + base64url(32 random bytes). Only the sha256 hash is stored;
 * the plaintext lives in the email (and, with no email configured in dev, is
 * returned to the authorized inviter as a fallback URL).
 */

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const PREFIX = "wsi_";
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInvitationToken(): { token: string; tokenHash: string; tokenLast4: string } {
  const token = PREFIX + randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token), tokenLast4: token.slice(-4) };
}

export function invitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

// Seat ceiling lives in @locateflow/shared (single source of truth across web,
// admin, and mobile). Re-exported so existing importers keep working.
export { seatLimitForPlan } from "@locateflow/shared";

/**
 * Used seats = non-suspended members + still-outstanding pending invitations.
 *
 * A PENDING invitation only consumes a seat while it can still be accepted, so
 * invitations whose `expiresAt` has passed are excluded — an expired invite can
 * never become a member, so holding a seat for it would wrongly block new
 * invites/joins. Pair this with the pending-list query (which applies the same
 * filter) so an expired invite stops counting AND stops showing as pending.
 */
export async function countUsedSeats(workspaceId: string): Promise<number> {
  const now = new Date();
  const [members, pending] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId, status: { not: "SUSPENDED" } } }),
    prisma.workspaceInvitation.count({
      where: { workspaceId, status: "PENDING", expiresAt: { gte: now } },
    }),
  ]);
  return members + pending;
}

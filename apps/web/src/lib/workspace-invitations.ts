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

/** Seat ceiling by plan (D21). Refined alongside entitlements (Dilim 5). */
export function seatLimitForPlan(plan: string): number {
  if (plan === "PRO") return 10;
  if (plan === "FAMILY") return 6;
  return 1; // Free / Individual — solo workspace
}

/** Used seats = non-suspended members + pending invitations. */
export async function countUsedSeats(workspaceId: string): Promise<number> {
  const [members, pending] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId, status: { not: "SUSPENDED" } } }),
    prisma.workspaceInvitation.count({ where: { workspaceId, status: "PENDING" } }),
  ]);
  return members + pending;
}

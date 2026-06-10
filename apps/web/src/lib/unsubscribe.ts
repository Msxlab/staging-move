import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * One-way HMAC tokens that identify the recipient of a marketing email
 * without a DB lookup. The token resists forgery as long as the secret
 * stays out of attacker hands; rotating the secret invalidates every
 * outstanding unsubscribe link, which is the simplest revocation story.
 *
 * Format: `${userId}.${base64url(HMAC-SHA256(userId))}`. We bind the
 * signature to the userId only — not to the email kind — so a single
 * link can also drive a "manage preferences" page without re-issuing.
 *
 * Reads EMAIL_UNSUBSCRIBE_SECRET if set; otherwise falls back to
 * USER_JWT_SECRET so deploys with only the JWT secret still work.
 */

const MIN_SECRET_LENGTH = 32;

function getSecret(): string {
  const dedicated = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (dedicated && dedicated.length >= MIN_SECRET_LENGTH) return dedicated;
  const jwtSecret = process.env.USER_JWT_SECRET;
  if (jwtSecret && jwtSecret.length >= MIN_SECRET_LENGTH) return jwtSecret;
  throw new Error("EMAIL_UNSUBSCRIBE_SECRET (or USER_JWT_SECRET) must be set and at least 32 characters");
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Buffer | null {
  try {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
  } catch {
    return null;
  }
}

export function signUnsubscribeToken(userId: string): string {
  if (!userId) throw new Error("userId is required");
  const secret = getSecret();
  const sig = createHmac("sha256", secret).update(userId).digest();
  return `${userId}.${base64UrlEncode(sig)}`;
}

export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const userId = token.slice(0, dot);
  const providedSigB64 = token.slice(dot + 1);

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }

  const provided = base64UrlDecode(providedSigB64);
  if (!provided) return null;
  const expected = createHmac("sha256", secret).update(userId).digest();
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  return userId;
}

/**
 * The set of email categories an end user is allowed to opt out of.
 * Maps to NotificationPreference.type values that are not security/auth.
 * Security-class emails (password-changed, MFA, account deletion) are
 * never opt-outable — the user needs them to recover their account.
 */
export type UnsubscribeKind = "marketing" | "reminder" | "all";

export const UNSUBSCRIBE_KINDS: UnsubscribeKind[] = ["marketing", "reminder", "all"];

export function parseUnsubscribeKind(input: string | null | undefined): UnsubscribeKind {
  if (input === "marketing" || input === "reminder") return input;
  return "all";
}

/**
 * Maps an unsubscribe choice to the NotificationPreference.type values
 * that should be flipped to enabled=false. "all" turns everything off.
 *
 * LIFECYCLE (abandoned-setup / win-back nudges) is folded into "reminder"
 * AND "all": those promotional nudges present themselves as reminder-class
 * and carry a `kind=reminder` one-click unsubscribe link, so opting out of
 * "reminder" MUST also silence LIFECYCLE — otherwise the opt-out mechanism
 * offered inside a lifecycle email fails to stop that very category, a
 * CAN-SPAM exposure. (The bounce/complaint webhook uses "all", so a spam
 * complaint now disables lifecycle too.)
 */
export function notificationTypesForKind(kind: UnsubscribeKind): string[] {
  if (kind === "marketing") return ["MARKETING"];
  if (kind === "reminder") return ["REMINDER", "LIFECYCLE"];
  return ["MARKETING", "REMINDER", "LIFECYCLE"];
}

/**
 * Builds the unsubscribe URL for inclusion in `List-Unsubscribe` and the
 * email body. Caller passes the resolved app URL since the email service
 * already does that lookup.
 */
export function buildUnsubscribeUrl(appUrl: string, token: string, kind?: UnsubscribeKind | null): string {
  const params = new URLSearchParams();
  params.set("t", token);
  if (kind && kind !== "all") params.set("k", kind);
  return `${appUrl.replace(/\/$/, "")}/unsubscribe?${params.toString()}`;
}

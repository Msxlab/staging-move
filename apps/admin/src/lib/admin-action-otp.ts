import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface AdminActionOtpScope {
  adminUserId: string;
  operation: string;
  targetId: string;
}

function getOtpHashSecret(): string {
  const secret = process.env.ADMIN_ACTION_OTP_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_ACTION_OTP_SECRET or ADMIN_JWT_SECRET must be set and at least 32 characters");
  }
  return secret;
}

function constantTimeHexEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function legacySha256AdminActionOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function hashAdminActionOtpCode(code: string, scope: AdminActionOtpScope): string {
  return createHmac("sha256", getOtpHashSecret())
    .update(`${scope.adminUserId}:${scope.operation}:${scope.targetId}:${code}`)
    .digest("hex");
}

export function verifyAdminActionOtpCode(
  code: string,
  storedHash: string,
  scope: AdminActionOtpScope,
): boolean {
  const hmacHash = hashAdminActionOtpCode(code, scope);
  if (constantTimeHexEqual(hmacHash, storedHash)) return true;

  // Compatibility for unexpired OTPs minted before the HMAC hardening deploy.
  return constantTimeHexEqual(legacySha256AdminActionOtpCode(code), storedHash);
}

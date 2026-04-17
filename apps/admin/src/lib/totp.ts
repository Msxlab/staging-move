/**
 * TOTP (Time-based One-Time Password) implementation using Node.js crypto.
 * Compatible with Google Authenticator, Authy, etc.
 * RFC 6238 compliant.
 */

import { createHmac, randomBytes } from "crypto";

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "sha1";
const BACKUP_CODE_COUNT = 8;

// ── Base32 encoding/decoding ──────────────────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let result = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    result += BASE32_CHARS[parseInt(chunk, 2)];
  }
  return result;
}

function base32Decode(encoded: string): Buffer {
  let bits = "";
  for (const char of encoded.toUpperCase().replace(/=+$/, "")) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// ── TOTP Core ──────────────────────────────────────────────

function generateHOTP(secret: Buffer, counter: bigint): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);

  const hmac = createHmac(TOTP_ALGORITHM, secret);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

function getCurrentCounter(): bigint {
  return BigInt(Math.floor(Date.now() / 1000 / TOTP_PERIOD));
}

// ── Public API ─────────────────────────────────────────────

/**
 * Generate a new TOTP secret (base32 encoded, 20 bytes = 160 bits).
 */
export function generateSecret(): string {
  const buffer = randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Generate a TOTP code from a base32 secret.
 */
export function generateTOTP(base32Secret: string): string {
  const secret = base32Decode(base32Secret);
  const counter = getCurrentCounter();
  return generateHOTP(secret, counter);
}

/**
 * Verify a TOTP code against a base32 secret.
 * Allows ±1 time step window to account for clock skew.
 */
export function verifyTOTP(base32Secret: string, code: string): boolean {
  if (!code || code.length !== TOTP_DIGITS) return false;

  const secret = base32Decode(base32Secret);
  const counter = getCurrentCounter();

  // Check current, previous, and next time steps
  for (let offset = -1n; offset <= 1n; offset++) {
    const expected = generateHOTP(secret, counter + offset);
    if (timingSafeEqual(expected, code)) return true;
  }
  return false;
}

/**
 * Generate a provisioning URI for QR code scanning.
 * Compatible with Google Authenticator, Authy, etc.
 */
export function generateProvisioningURI(
  base32Secret: string,
  email: string,
  issuer: string = "LocateFlow Admin"
): string {
  const encodedEmail = encodeURIComponent(email);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${base32Secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Generate backup codes (8 random 8-character codes).
 * Returns { codes: plaintext[], hashes: bcrypt hashes[] }.
 */
export async function generateBackupCodes(): Promise<{ codes: string[]; hashes: string[] }> {
  const codes: string[] = [];
  const hashes: string[] = [];

  const bcrypt = await import("bcryptjs");

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = randomBytes(4).toString("hex").toUpperCase(); // 8-char hex
    codes.push(code);
    hashes.push(await bcrypt.hash(code, 10));
  }

  return { codes, hashes };
}

/**
 * Verify a backup code against stored hashes.
 * Returns the index of the matched code (for removal) or -1 if not found.
 */
export async function verifyBackupCode(code: string, hashes: string[]): Promise<number> {
  const bcrypt = await import("bcryptjs");
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(code.toUpperCase(), hashes[i])) return i;
  }
  return -1;
}

// Constant-time string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

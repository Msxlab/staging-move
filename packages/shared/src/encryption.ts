/**
 * AES-256-GCM Encryption Module
 *
 * Provides application-level field encryption for sensitive data.
 * Format: enc_v1:<base64-iv>:<base64-ciphertext>:<base64-auth-tag>
 *
 * Requires FIELD_ENCRYPTION_KEY env variable (64-char hex = 256-bit key).
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const PREFIX = "enc_v1:";

function getKey(): Buffer | null {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  // Reject non-hex keys here, not just wrong-length ones: Buffer.from(badHex,
  // "hex") silently drops invalid chars and yields a short key, which would
  // otherwise blow up deep inside createCipheriv per request.
  if (!validateKeyFormat(hex ?? "")) return null;
  return Buffer.from(hex as string, "hex");
}

/**
 * Check whether a value is already encrypted (has our prefix).
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns the encrypted string in `enc_v1:<iv>:<ciphertext>:<tag>` format.
 * If the encryption key is not configured: throws in production (refusing to
 * store plaintext in PII columns), and returns the plaintext unchanged only in
 * development.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY_MISSING: FIELD_ENCRYPTION_KEY is required in production. Refusing to store plaintext.");
    }
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${encrypted.toString("base64")}:${authTag.toString("base64")}`;
}

/**
 * Decrypt an encrypted string.
 * If the value is not encrypted (no prefix), returns it unchanged (backward compatible).
 * If decryption key is not configured, returns the raw value in development
 * and throws in production.
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue;
  if (!isEncrypted(encryptedValue)) return encryptedValue;

  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY_MISSING: FIELD_ENCRYPTION_KEY is required in production. Cannot decrypt data.");
    }
    return encryptedValue;
  }

  try {
    const payload = encryptedValue.slice(PREFIX.length);
    const [ivB64, ciphertextB64, tagB64] = payload.split(":");
    if (!ivB64 || !ciphertextB64 || !tagB64) {
      throw new Error("ENCRYPTION_DECRYPT_FAILED: malformed encrypted value.");
    }

    const iv = Buffer.from(ivB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error instanceof Error
        ? error
        : new Error("ENCRYPTION_DECRYPT_FAILED: encrypted value could not be decrypted.");
    }
    console.warn("[ENCRYPTION] Failed to decrypt value; returning raw encrypted value in development.", error);
    return encryptedValue;
  }
}

/**
 * Encrypt a full JSON backup string using AES-256-GCM.
 * Returns { encryptedData, iv, authTag } all as base64.
 */
export function encryptBackup(jsonContent: string): {
  encryptedData: string;
  iv: string;
  authTag: string;
} | null {
  const key = getKey();
  if (!key) return null;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(jsonContent, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypt a backup that was encrypted with encryptBackup.
 */
export function decryptBackup(encryptedData: string, ivB64: string, authTagB64: string): string | null {
  const key = getKey();
  if (!key) return null;

  try {
    const iv = Buffer.from(ivB64, "base64");
    const ciphertext = Buffer.from(encryptedData, "base64");
    const authTag = Buffer.from(authTagB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Re-encrypt a value from the old key to the current key.
 * Used during key rotation to migrate encrypted fields.
 * Returns null if either key is invalid or decryption fails.
 */
export function reEncrypt(encryptedValue: string, oldKeyHex: string): string | null {
  if (!encryptedValue || !isEncrypted(encryptedValue)) return encryptedValue;

  const oldKey = oldKeyHex && oldKeyHex.length === 64 ? Buffer.from(oldKeyHex, "hex") : null;
  const newKey = getKey();
  if (!oldKey || !newKey) return null;

  try {
    // Decrypt with old key
    const payload = encryptedValue.slice(PREFIX.length);
    const [ivB64, ciphertextB64, tagB64] = payload.split(":");
    if (!ivB64 || !ciphertextB64 || !tagB64) return null;

    const iv = Buffer.from(ivB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, oldKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

    // Re-encrypt with new (current) key
    const newIv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, newKey, newIv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const newAuthTag = cipher.getAuthTag();

    return `${PREFIX}${newIv.toString("base64")}:${encrypted.toString("base64")}:${newAuthTag.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Validate that an encryption key hex string is valid (64-char hex = 256-bit).
 */
export function validateKeyFormat(keyHex: string): boolean {
  return typeof keyHex === "string" && keyHex.length === 64 && /^[0-9a-fA-F]+$/.test(keyHex);
}

/**
 * Sign backup data with HMAC-SHA256 for integrity verification.
 * Returns null if encryption key is not configured.
 */
export function signBackup(jsonContent: string): string | null {
  const key = getKey();
  if (!key) return null;
  return createHmac("sha256", key).update(jsonContent, "utf8").digest("hex");
}

/**
 * Verify a backup's HMAC-SHA256 signature.
 * Returns true if the signature matches, false otherwise.
 */
export function verifyBackupSignature(jsonContent: string, signature: string): boolean {
  const key = getKey();
  if (!key) return false;
  const expected = createHmac("sha256", key).update(jsonContent, "utf8").digest("hex");
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

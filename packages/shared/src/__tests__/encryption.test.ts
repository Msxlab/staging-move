import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to control the env variable for testing
const VALID_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encryption module", () => {
  let encryption: typeof import("../encryption");

  beforeEach(async () => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("with valid key", () => {
    beforeEach(async () => {
      vi.stubEnv("FIELD_ENCRYPTION_KEY", VALID_KEY);
      vi.stubEnv("NODE_ENV", "development");
      encryption = await import("../encryption");
    });

    it("should encrypt and decrypt a string correctly (roundtrip)", () => {
      const plaintext = "Hello, World!";
      const encrypted = encryption.encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.startsWith("enc_v1:")).toBe(true);
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for the same plaintext (random IV)", () => {
      const plaintext = "test-value";
      const enc1 = encryption.encrypt(plaintext);
      const enc2 = encryption.encrypt(plaintext);
      expect(enc1).not.toBe(enc2);
      // But both should decrypt to the same value
      expect(encryption.decrypt(enc1)).toBe(plaintext);
      expect(encryption.decrypt(enc2)).toBe(plaintext);
    });

    it("should return empty string for empty input", () => {
      expect(encryption.encrypt("")).toBe("");
      expect(encryption.decrypt("")).toBe("");
    });

    it("should handle non-encrypted values in decrypt (passthrough)", () => {
      const plaintext = "not-encrypted";
      expect(encryption.decrypt(plaintext)).toBe(plaintext);
    });

    it("should correctly identify encrypted values", () => {
      expect(encryption.isEncrypted("enc_v1:abc:def:ghi")).toBe(true);
      expect(encryption.isEncrypted("plaintext")).toBe(false);
      expect(encryption.isEncrypted(null)).toBe(false);
      expect(encryption.isEncrypted(undefined)).toBe(false);
    });

    it("should validate key format", () => {
      expect(encryption.validateKeyFormat(VALID_KEY)).toBe(true);
      expect(encryption.validateKeyFormat("short")).toBe(false);
      expect(encryption.validateKeyFormat("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")).toBe(false);
      expect(encryption.validateKeyFormat("")).toBe(false);
    });

    it("should handle unicode text", () => {
      const plaintext = "Héllo Wörld 🌍 日本語";
      const encrypted = encryption.encrypt(plaintext);
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle long text", () => {
      const plaintext = "A".repeat(10000);
      const encrypted = encryption.encrypt(plaintext);
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("without key (development mode)", () => {
    beforeEach(async () => {
      vi.stubEnv("FIELD_ENCRYPTION_KEY", "");
      vi.stubEnv("NODE_ENV", "development");
      encryption = await import("../encryption");
    });

    it("should return plaintext when encrypting without key in dev", () => {
      const plaintext = "sensitive-data";
      expect(encryption.encrypt(plaintext)).toBe(plaintext);
    });

    it("should return raw value when decrypting without key in dev", () => {
      const raw = "enc_v1:abc:def:ghi";
      expect(encryption.decrypt(raw)).toBe(raw);
    });
  });

  describe("without key (production mode)", () => {
    beforeEach(async () => {
      vi.stubEnv("FIELD_ENCRYPTION_KEY", "");
      vi.stubEnv("NODE_ENV", "production");
      encryption = await import("../encryption");
    });

    it("should throw when encrypting without key in production", () => {
      expect(() => encryption.encrypt("sensitive-data")).toThrow("ENCRYPTION_KEY_MISSING");
    });

    it("should throw when decrypting encrypted value without key in production", () => {
      expect(() => encryption.decrypt("enc_v1:abc:def:ghi")).toThrow("ENCRYPTION_KEY_MISSING");
    });
  });

  describe("backup encryption", () => {
    beforeEach(async () => {
      vi.stubEnv("FIELD_ENCRYPTION_KEY", VALID_KEY);
      vi.stubEnv("NODE_ENV", "development");
      encryption = await import("../encryption");
    });

    it("should encrypt and decrypt backup data", () => {
      const jsonData = JSON.stringify({ users: [{ id: 1 }] });
      const result = encryption.encryptBackup(jsonData);
      expect(result).not.toBeNull();
      if (result) {
        const decrypted = encryption.decryptBackup(result.encryptedData, result.iv, result.authTag);
        expect(decrypted).toBe(jsonData);
      }
    });

    it("should sign and verify backup data", () => {
      const jsonData = JSON.stringify({ test: true });
      const signature = encryption.signBackup(jsonData);
      expect(signature).not.toBeNull();
      if (signature) {
        expect(encryption.verifyBackupSignature(jsonData, signature)).toBe(true);
        expect(encryption.verifyBackupSignature(jsonData + "tampered", signature)).toBe(false);
      }
    });
  });
});

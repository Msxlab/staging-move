import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashAdminActionOtpCode,
  legacySha256AdminActionOtpCode,
  verifyAdminActionOtpCode,
} from "./admin-action-otp";

const ORIGINAL_ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ORIGINAL_ADMIN_ACTION_OTP_SECRET = process.env.ADMIN_ACTION_OTP_SECRET;
const scope = { adminUserId: "admin_1", operation: "user_hard_delete", targetId: "user_1" };

describe("admin action OTP hashing", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_JWT_SECRET", "admin-jwt-secret-at-least-32-characters");
    delete process.env.ADMIN_ACTION_OTP_SECRET;
  });

  afterEach(() => {
    if (ORIGINAL_ADMIN_JWT_SECRET === undefined) delete process.env.ADMIN_JWT_SECRET;
    else process.env.ADMIN_JWT_SECRET = ORIGINAL_ADMIN_JWT_SECRET;
    if (ORIGINAL_ADMIN_ACTION_OTP_SECRET === undefined) delete process.env.ADMIN_ACTION_OTP_SECRET;
    else process.env.ADMIN_ACTION_OTP_SECRET = ORIGINAL_ADMIN_ACTION_OTP_SECRET;
    vi.unstubAllEnvs();
  });

  it("stores a keyed HMAC hash instead of a bare six-digit SHA-256 hash", () => {
    const code = "123456";
    const hmac = hashAdminActionOtpCode(code, scope);
    const legacy = legacySha256AdminActionOtpCode(code);

    expect(hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(hmac).not.toBe(legacy);
    expect(verifyAdminActionOtpCode(code, hmac, scope)).toBe(true);
    expect(verifyAdminActionOtpCode("654321", hmac, scope)).toBe(false);
  });

  it("temporarily accepts legacy SHA-256 hashes for unexpired pre-hardening codes", () => {
    const legacy = legacySha256AdminActionOtpCode("123456");

    expect(verifyAdminActionOtpCode("123456", legacy, scope)).toBe(true);
  });
});

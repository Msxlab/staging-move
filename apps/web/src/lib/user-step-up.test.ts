import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  verifyPassword: vi.fn(),
  verifyTOTP: vi.fn(),
  verifyBackupCode: vi.fn(),
  decrypt: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));
vi.mock("@/lib/user-auth", () => ({ verifyPassword: mocks.verifyPassword }));
vi.mock("@/lib/totp", () => ({
  verifyTOTP: mocks.verifyTOTP,
  verifyBackupCode: mocks.verifyBackupCode,
}));
vi.mock("@/lib/shared-encryption", () => ({ decrypt: mocks.decrypt }));

import { verifyUserStepUp } from "./user-step-up";

describe("verifyUserStepUp — MFA integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.verifyTOTP.mockReturnValue(true);
    mocks.verifyBackupCode.mockResolvedValue(-1);
    mocks.decrypt.mockReturnValue("SECRET");
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("accepts a password alone for a NON-MFA user", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    });

    const result = await verifyUserStepUp({ userId: "u1", confirmPassword: "pw" });
    expect(result).toEqual({ ok: true, method: "password" });
  });

  it("REJECTS a correct password alone when the user has MFA enabled", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
      mfaEnabled: true,
      mfaSecret: "enc",
      mfaBackupCodes: null,
    });

    const result = await verifyUserStepUp({ userId: "u1", confirmPassword: "pw" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("STEP_UP_REQUIRED");
  });

  it("accepts a valid TOTP code for an MFA user (password optional)", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
      mfaEnabled: true,
      mfaSecret: "enc",
      mfaBackupCodes: null,
    });

    const result = await verifyUserStepUp({ userId: "u1", confirmPassword: "pw", mfaCode: "123456" });
    expect(result).toEqual({ ok: true, method: "mfa" });
  });

  it("rejects an MFA user who provides a password + wrong TOTP", async () => {
    mocks.verifyTOTP.mockReturnValue(false);
    mocks.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
      mfaEnabled: true,
      mfaSecret: "enc",
      mfaBackupCodes: null,
    });

    const result = await verifyUserStepUp({ userId: "u1", confirmPassword: "pw", mfaCode: "000000" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_STEP_UP");
  });

  it("accepts a valid backup code for an MFA user and consumes it", async () => {
    mocks.verifyBackupCode.mockResolvedValue(0);
    mocks.findUnique.mockResolvedValue({
      id: "u1",
      passwordHash: "hash",
      mfaEnabled: true,
      mfaSecret: "enc",
      mfaBackupCodes: JSON.stringify(["h1", "h2"]),
    });

    const result = await verifyUserStepUp({ userId: "u1", backupCode: "BACKUP" });
    expect(result).toEqual({ ok: true, method: "backup_code" });
    expect(mocks.updateMany).toHaveBeenCalled();
  });
});

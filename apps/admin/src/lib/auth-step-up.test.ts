import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("./db", () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    adminSession: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn() },
}));

vi.mock("./security-monitor", () => ({
  trackFailedPasswordConfirm: vi.fn(),
  trackSensitiveOp: vi.fn(),
}));

vi.mock("./audit", () => ({
  writeAdminAudit: vi.fn(() => Promise.resolve()),
}));

vi.mock("./shared-encryption", () => ({
  decrypt: vi.fn(() => "totp-secret"),
}));

vi.mock("./totp", () => ({
  verifyTOTP: vi.fn(() => true),
  verifyBackupCode: vi.fn(() => Promise.resolve(-1)),
}));

import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { writeAdminAudit } from "./audit";
import { trackFailedPasswordConfirm, trackSensitiveOp } from "./security-monitor";
import {
  clearAdminStepUpStateForTests,
  requirePasswordConfirm,
  type AdminSession,
} from "./auth";

const compareMock = bcrypt.compare as unknown as Mock;
const adminUserMock = prisma.adminUser as unknown as { findUnique: Mock };
const writeAdminAuditMock = writeAdminAudit as unknown as Mock;
const trackFailedPasswordConfirmMock = trackFailedPasswordConfirm as unknown as Mock;
const trackSensitiveOpMock = trackSensitiveOp as unknown as Mock;

const session: AdminSession = {
  adminId: "admin_1",
  email: "admin@example.com",
  role: "ADMIN",
  sessionId: "session_1",
};

describe("admin scoped step-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAdminStepUpStateForTests();
    adminUserMock.findUnique.mockResolvedValue({
      password: "hash",
      isActive: true,
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    });
    compareMock.mockResolvedValue(true);
  });

  it("caches a valid step-up only for the same operation group", async () => {
    await expect(
      requirePasswordConfirm(session, "Password-2026!", { operation: "runtime_config" }),
    ).resolves.toEqual({ confirmed: true });

    await expect(
      requirePasswordConfirm(session, undefined, { operation: "runtime_config" }),
    ).resolves.toEqual({ confirmed: true });

    const otherGroup = await requirePasswordConfirm(session, undefined, { operation: "backup_download" });
    expect(otherGroup.confirmed).toBe(false);
    expect(otherGroup.error).toContain("Password confirmation required");
  });

  it("does not let a password-only step-up satisfy an MFA-required operation", async () => {
    await expect(
      requirePasswordConfirm(session, "Password-2026!", { operation: "feature_flag_write" }),
    ).resolves.toEqual({ confirmed: true });

    adminUserMock.findUnique.mockResolvedValueOnce({
      password: "hash",
      isActive: true,
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: null,
    });

    const mfaRequired = await requirePasswordConfirm(session, undefined, {
      operation: "feature_flag_write",
      requireMfa: true,
    });

    expect(mfaRequired.confirmed).toBe(false);
    expect(mfaRequired.error).toContain("Password confirmation required");
  });

  it("expires cached step-up by operation grace window", async () => {
    await requirePasswordConfirm(session, "Password-2026!", { operation: "key_rotation" });

    const expired = await requirePasswordConfirm(session, undefined, {
      operation: "key_rotation",
      maxAgeMs: 0,
    });

    expect(expired.confirmed).toBe(false);
    expect(expired.error).toContain("Password confirmation required");
  });

  it("rate limits repeated bad confirmations", async () => {
    compareMock.mockResolvedValue(false);

    // STEP_UP_MAX_FAILURES is currently 8 — eight wrong attempts in the
    // window must trip the lockout. The threshold was raised from 5 after
    // admins kept getting locked out by mobile typos during incidents.
    let result = await requirePasswordConfirm(session, "wrong", { operation: "provider_delete" });
    for (let i = 0; i < 7; i++) {
      result = await requirePasswordConfirm(session, "wrong", { operation: "provider_delete" });
    }

    expect(result.confirmed).toBe(false);
    expect(result.rateLimited).toBe(true);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it("passes real IP metadata to step-up monitor and writes durable step-up audits", async () => {
    await expect(
      requirePasswordConfirm(session, "Password-2026!", {
        operation: "runtime_config",
        ipAddress: "203.0.113.44",
        userAgent: "Vitest Browser",
      }),
    ).resolves.toEqual({ confirmed: true });

    expect(trackSensitiveOpMock).toHaveBeenCalledWith("admin_1", "203.0.113.44", "runtime_config");
    expect(writeAdminAuditMock).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        action: "STEP_UP_SUCCESS",
        metadata: expect.objectContaining({ operation: "runtime_config" }),
        request: { ipAddress: "203.0.113.44", userAgent: "Vitest Browser" },
      }),
    );

    compareMock.mockResolvedValue(false);
    const failed = await requirePasswordConfirm(session, "wrong", {
      operation: "backup_download",
      ipAddress: "203.0.113.55",
      userAgent: "Vitest Browser",
    });

    expect(failed.confirmed).toBe(false);
    expect(trackFailedPasswordConfirmMock).toHaveBeenCalledWith("admin_1", "203.0.113.55");
    expect(writeAdminAuditMock).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        action: "STEP_UP_FAILED",
        metadata: expect.objectContaining({ operation: "backup_download", reason: "invalid_password" }),
        request: { ipAddress: "203.0.113.55", userAgent: "Vitest Browser" },
      }),
    );
  });
});

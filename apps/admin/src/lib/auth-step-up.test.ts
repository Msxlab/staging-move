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

vi.mock("./shared-encryption", () => ({
  decrypt: vi.fn(() => "totp-secret"),
}));

vi.mock("./totp", () => ({
  verifyTOTP: vi.fn(() => true),
  verifyBackupCode: vi.fn(() => Promise.resolve(-1)),
}));

import bcrypt from "bcryptjs";
import { prisma } from "./db";
import {
  clearAdminStepUpStateForTests,
  requirePasswordConfirm,
  type AdminSession,
} from "./auth";

const compareMock = bcrypt.compare as unknown as Mock;
const adminUserMock = prisma.adminUser as unknown as { findUnique: Mock };

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

    let result = await requirePasswordConfirm(session, "wrong", { operation: "provider_delete" });
    for (let i = 0; i < 4; i++) {
      result = await requirePasswordConfirm(session, "wrong", { operation: "provider_delete" });
    }

    expect(result.confirmed).toBe(false);
    expect(result.rateLimited).toBe(true);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });
});

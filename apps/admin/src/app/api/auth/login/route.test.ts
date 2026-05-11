import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  adminFindUnique: vi.fn(),
  adminUpdate: vi.fn(),
  adminUpdateMany: vi.fn(),
  adminFindFirst: vi.fn(),
  adminLoginLogCreate: vi.fn(),
  adminAuditLogCreate: vi.fn(),
  adminSessionCreate: vi.fn(),
  rateLimitLogCreate: vi.fn(),
  compare: vi.fn(),
  verifyTOTP: vi.fn(),
  verifyBackupCode: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: mocks.adminFindUnique,
      findFirst: mocks.adminFindFirst,
      update: mocks.adminUpdate,
      updateMany: mocks.adminUpdateMany,
    },
    adminLoginLog: { create: mocks.adminLoginLogCreate },
    adminAuditLog: { create: mocks.adminAuditLogCreate },
    adminSession: { create: mocks.adminSessionCreate },
    rateLimitLog: { create: mocks.rateLimitLogCreate },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mocks.compare },
}));

vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(() => Promise.resolve("admin-session-token")),
  generateFingerprint: vi.fn(() => Promise.resolve("fingerprint")),
  hashSessionToken: vi.fn(() => Promise.resolve("session-hash")),
}));

vi.mock("@/lib/security-monitor", () => ({
  trackFailedLogin: vi.fn(),
  trackSuccessfulLogin: vi.fn(),
}));

vi.mock("@/lib/totp", () => ({
  verifyTOTP: mocks.verifyTOTP,
  verifyBackupCode: mocks.verifyBackupCode,
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn(() => "totp-secret"),
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValues: vi.fn(() => Promise.resolve({})),
}));

import { POST } from "./route";

function request(email: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new NextRequest("https://admin.locateflow.com/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "Vitest Admin Browser",
      ...headers,
    },
    body: JSON.stringify({
      email,
      password: "wrong-password",
      ...extra,
    }),
  });
}

describe("admin login rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      password: "hash",
      firstName: "Admin",
      lastName: "User",
      role: "SUPER_ADMIN",
      isActive: true,
      mfaEnabled: false,
      mfaSecret: null,
    });
    mocks.adminFindFirst.mockResolvedValue({ id: "admin-1" });
    mocks.compare.mockResolvedValue(false);
    mocks.adminLoginLogCreate.mockResolvedValue({});
    mocks.adminAuditLogCreate.mockResolvedValue({});
    mocks.adminSessionCreate.mockResolvedValue({});
    mocks.rateLimitLogCreate.mockResolvedValue({});
    mocks.adminUpdate.mockResolvedValue({});
    mocks.adminUpdateMany.mockResolvedValue({ count: 1 });
    mocks.verifyTOTP.mockReturnValue(false);
    mocks.verifyBackupCode.mockResolvedValue(-1);
  });

  it("does not block a different admin email only because it shares the same IP", async () => {
    for (let i = 0; i < 5; i++) {
      const response = await POST(request("primary-admin@example.com"));
      expect(response.status).toBe(401);
    }

    const sameIpDifferentEmail = await POST(request("second-admin@example.com"));

    expect(sameIpDifferentEmail.status).toBe(401);
    expect(mocks.rateLimitLogCreate).not.toHaveBeenCalled();
  });

  it("applies a stricter admin login cooldown after repeated attempts for the same email bucket", async () => {
    for (let i = 0; i < 5; i++) {
      await POST(request("cooldown-admin@example.com"));
    }

    const response = await POST(request("cooldown-admin@example.com"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1800");
    expect(body.error).toBe("Too many login attempts. Please try again later.");
    expect(mocks.rateLimitLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ipAddress: "203.0.113.10",
        endpoint: "POST /api/auth/login",
        blocked: true,
      }),
    }));
  });

  it("does not allow User-Agent rotation to bypass the same email and IP cooldown", async () => {
    for (let i = 0; i < 5; i++) {
      const response = await POST(
        request("ua-rotation-admin@example.com", {}, { "user-agent": `Rotated UA ${i}` }),
      );
      expect(response.status).toBe(401);
    }

    const response = await POST(
      request("ua-rotation-admin@example.com", {}, { "user-agent": "Fresh UA" }),
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("Too many login attempts. Please try again later.");
  });

  it("returns an MFA challenge after a valid password without creating a session", async () => {
    mocks.compare.mockResolvedValue(true);
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin-mfa",
      email: "mfa-admin@example.com",
      password: "hash",
      firstName: "Mfa",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: "[]",
    });

    const response = await POST(request("mfa-admin@example.com"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ error: "MFA required", requiresMfa: true });
    expect(mocks.adminSessionCreate).not.toHaveBeenCalled();
    expect(mocks.adminAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "MFA_REQUIRED",
        adminUserId: "admin-mfa",
      }),
    }));
  });

  it("accepts a backup code once and writes backup-code audit metadata", async () => {
    mocks.compare.mockResolvedValue(true);
    mocks.verifyBackupCode.mockResolvedValue(0);
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin-backup",
      email: "backup-admin@example.com",
      password: "hash",
      firstName: "Backup",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: JSON.stringify(["hash-a", "hash-b"]),
    });

    const response = await POST(request("backup-admin@example.com", { backupCode: "ABCDEF12" }));

    expect(response.status).toBe(200);
    expect(mocks.adminUpdateMany).toHaveBeenCalledWith({
      where: { id: "admin-backup", mfaBackupCodes: JSON.stringify(["hash-a", "hash-b"]) },
      data: { mfaBackupCodes: JSON.stringify(["hash-b"]) },
    });
    expect(mocks.adminAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "BACKUP_CODE_USED", adminUserId: "admin-backup" }),
    }));
  });

  it("rejects backup code reuse and does not create a session", async () => {
    mocks.compare.mockResolvedValue(true);
    mocks.verifyBackupCode.mockResolvedValue(-1);
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin-reuse",
      email: "reuse-admin@example.com",
      password: "hash",
      firstName: "Reuse",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: JSON.stringify(["remaining-hash"]),
    });

    const response = await POST(request("reuse-admin@example.com", { backupCode: "ABCDEF12" }));

    expect(response.status).toBe(401);
    expect(mocks.adminSessionCreate).not.toHaveBeenCalled();
    expect(mocks.adminAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "LOGIN_FAILED", adminUserId: "admin-reuse" }),
    }));
  });
});

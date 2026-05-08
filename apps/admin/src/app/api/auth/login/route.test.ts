import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  adminFindUnique: vi.fn(),
  adminUpdate: vi.fn(),
  adminFindFirst: vi.fn(),
  adminLoginLogCreate: vi.fn(),
  adminAuditLogCreate: vi.fn(),
  adminSessionCreate: vi.fn(),
  rateLimitLogCreate: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: mocks.adminFindUnique,
      findFirst: mocks.adminFindFirst,
      update: mocks.adminUpdate,
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
  verifyTOTP: vi.fn(() => false),
  verifyBackupCode: vi.fn(() => Promise.resolve(-1)),
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn(() => "totp-secret"),
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValues: vi.fn(() => Promise.resolve({})),
}));

import { POST } from "./route";

function request(email: string, extra: Record<string, unknown> = {}) {
  return new NextRequest("https://admin.locateflow.com/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "Vitest Admin Browser",
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

  it("keeps wrong password, missing MFA, and wrong MFA responses stable", async () => {
    const email = "mfa-oracle-admin@example.com";
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin-2",
      email,
      password: "hash",
      firstName: "Mfa",
      lastName: "Admin",
      role: "ADMIN",
      isActive: true,
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: "[]",
    });

    mocks.compare.mockResolvedValueOnce(false);
    const wrongPassword = await POST(request(email));
    const wrongPasswordBody = await wrongPassword.json();

    mocks.compare.mockResolvedValueOnce(true);
    const missingMfa = await POST(request(email));
    const missingMfaBody = await missingMfa.json();

    mocks.compare.mockResolvedValueOnce(true);
    const wrongMfa = await POST(request(email, { mfaCode: "000000" }));
    const wrongMfaBody = await wrongMfa.json();

    expect(wrongPassword.status).toBe(401);
    expect(missingMfa.status).toBe(401);
    expect(wrongMfa.status).toBe(401);
    expect(wrongPasswordBody).toEqual({ error: "Invalid email or password" });
    expect(missingMfaBody).toEqual(wrongPasswordBody);
    expect(wrongMfaBody).toEqual(wrongPasswordBody);
  });
});

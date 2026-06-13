import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  adminFindUnique: vi.fn(),
  adminUpdate: vi.fn(),
  adminUpdateMany: vi.fn(),
  adminFindFirst: vi.fn(),
  adminLoginLogCreate: vi.fn(),
  adminAuditLogCreate: vi.fn(),
  adminSessionCreate: vi.fn(),
  adminMfaTrustedDeviceFindFirst: vi.fn(),
  adminMfaTrustedDeviceCreate: vi.fn(),
  adminMfaTrustedDeviceUpdateMany: vi.fn(),
  rateLimitLogCreate: vi.fn(),
  compare: vi.fn(),
  verifyTOTP: vi.fn(),
  verifyBackupCode: vi.fn(),
  getRuntimeConfigValues: vi.fn(() => Promise.resolve({} as Record<string, string | null>)),
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
    adminMfaTrustedDevice: {
      findFirst: mocks.adminMfaTrustedDeviceFindFirst,
      create: mocks.adminMfaTrustedDeviceCreate,
      updateMany: mocks.adminMfaTrustedDeviceUpdateMany,
    },
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
  shouldUseSecureAdminCookies: vi.fn(() => false),
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
  getAdminRuntimeConfigValues: mocks.getRuntimeConfigValues,
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
    mocks.adminMfaTrustedDeviceFindFirst.mockResolvedValue(null);
    mocks.adminMfaTrustedDeviceCreate.mockResolvedValue({});
    mocks.adminMfaTrustedDeviceUpdateMany.mockResolvedValue({ count: 1 });
    mocks.rateLimitLogCreate.mockResolvedValue({});
    mocks.adminUpdate.mockResolvedValue({});
    mocks.adminUpdateMany.mockResolvedValue({ count: 1 });
    mocks.verifyTOTP.mockReturnValue(false);
    mocks.verifyBackupCode.mockResolvedValue(-1);
    mocks.getRuntimeConfigValues.mockResolvedValue({});
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

  it("can ignore spoofed forwarded IP rotation when trusted proxy headers are disabled", async () => {
    const previous = process.env.TRUSTED_PROXY_HEADERS;
    process.env.TRUSTED_PROXY_HEADERS = "none";
    try {
      for (let i = 0; i < 5; i++) {
        const response = await POST(
          request("strict-proxy-admin@example.com", {}, { "x-forwarded-for": `198.51.100.${i + 1}` }),
        );
        expect(response.status).toBe(401);
      }

      const response = await POST(
        request("strict-proxy-admin@example.com", {}, { "x-forwarded-for": "198.51.100.250" }),
      );
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.error).toBe("Too many login attempts. Please try again later.");
      expect(mocks.rateLimitLogCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          ipAddress: "unknown",
          endpoint: "POST /api/auth/login",
          blocked: true,
        }),
      }));
    } finally {
      if (previous === undefined) delete process.env.TRUSTED_PROXY_HEADERS;
      else process.env.TRUSTED_PROXY_HEADERS = previous;
    }
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

  it("skips the MFA prompt when a valid trusted-device cookie matches the admin fingerprint", async () => {
    mocks.compare.mockResolvedValue(true);
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin-trusted",
      email: "trusted-admin@example.com",
      password: "hash",
      firstName: "Trusted",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: "[]",
    });
    mocks.adminMfaTrustedDeviceFindFirst.mockResolvedValue({
      id: "trusted-device-1",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await POST(request(
      "trusted-admin@example.com",
      { password: "correct-password" },
      { cookie: "admin_mfa_trust=trusted-token-value-that-is-long-enough" },
    ));

    expect(response.status).toBe(200);
    expect(mocks.verifyTOTP).not.toHaveBeenCalled();
    expect(mocks.adminMfaTrustedDeviceFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        adminUserId: "admin-trusted",
        revokedAt: null,
        expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      }),
    }));
    expect(mocks.adminMfaTrustedDeviceUpdateMany).toHaveBeenCalledWith({
      where: { id: "trusted-device-1", revokedAt: null },
      data: { lastUsedAt: expect.any(Date) },
    });
    expect(mocks.adminSessionCreate).toHaveBeenCalled();
    expect(mocks.adminAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "LOGIN_SUCCESS",
        changes: expect.stringContaining('"trustedDevice":true'),
      }),
    }));
  });

  it("creates a 30-day trusted-device cookie after a successful TOTP when requested", async () => {
    mocks.compare.mockResolvedValue(true);
    mocks.verifyTOTP.mockReturnValue(true);
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin-remember",
      email: "remember-admin@example.com",
      password: "hash",
      firstName: "Remember",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      isActive: true,
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: "[]",
    });

    const response = await POST(request("remember-admin@example.com", {
      password: "correct-password",
      mfaCode: "123456",
      rememberDevice: true,
    }));

    expect(response.status).toBe(200);
    expect(mocks.adminMfaTrustedDeviceCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        adminUserId: "admin-remember",
        deviceLabel: "Unknown on Unknown",
        expiresAt: expect.any(Date),
      }),
    }));
    expect(response.headers.get("set-cookie")).toContain("admin_mfa_trust=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");
  });

  it("does not trust a device from backup-code login even if the request asks for it", async () => {
    mocks.compare.mockResolvedValue(true);
    mocks.verifyBackupCode.mockResolvedValue(0);
    mocks.adminFindUnique.mockResolvedValue({
      id: "admin-backup-no-trust",
      email: "backup-no-trust@example.com",
      password: "hash",
      firstName: "Backup",
      lastName: "NoTrust",
      role: "SUPER_ADMIN",
      isActive: true,
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: JSON.stringify(["hash-a"]),
    });

    const response = await POST(request("backup-no-trust@example.com", {
      password: "correct-password",
      backupCode: "ABCDEF12",
      rememberDevice: true,
    }));

    expect(response.status).toBe(200);
    expect(mocks.adminMfaTrustedDeviceCreate).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie") || "").not.toContain("admin_mfa_trust=");
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

  describe("distributed limiter (Upstash configured)", () => {
    const REDIS_CONFIG = {
      UPSTASH_REDIS_REST_URL: "https://redis.example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token-1234567890",
    };

    function upstashResponse(result: unknown) {
      return {
        ok: true,
        json: () => Promise.resolve({ result }),
      } as unknown as Response;
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("counts attempts through Redis instead of the in-process Map", async () => {
      mocks.getRuntimeConfigValues.mockResolvedValue(REDIS_CONFIG);
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/get/")) return Promise.resolve(upstashResponse(null));
        if (url.includes("/incr/")) return Promise.resolve(upstashResponse(1));
        if (url.includes("/expire/")) return Promise.resolve(upstashResponse(1));
        return Promise.resolve(upstashResponse("OK"));
      });
      vi.stubGlobal("fetch", fetchMock);

      const response = await POST(request("redis-counting-admin@example.com"));

      expect(response.status).toBe(401);
      const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(calledUrls.some((url) => url.includes("/incr/") && url.includes(encodeURIComponent("admin:login")))).toBe(true);
    });

    it("locks the bucket via Redis once the counter exceeds the limit", async () => {
      mocks.getRuntimeConfigValues.mockResolvedValue(REDIS_CONFIG);
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/get/")) return Promise.resolve(upstashResponse(null));
        if (url.includes("/incr/")) return Promise.resolve(upstashResponse(6));
        return Promise.resolve(upstashResponse("OK"));
      });
      vi.stubGlobal("fetch", fetchMock);

      const response = await POST(request("redis-locked-admin@example.com"));
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("1800");
      expect(body.error).toBe("Too many login attempts. Please try again later.");
      const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(calledUrls.some((url) => url.includes("/set/") && url.includes(encodeURIComponent("admin:login:lock")))).toBe(true);
    });

    it("fails closed with 503 when Redis is configured but erroring", async () => {
      mocks.getRuntimeConfigValues.mockResolvedValue(REDIS_CONFIG);
      vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))));

      const response = await POST(request("redis-down-admin@example.com"));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(body.error).toBe("Login temporarily unavailable. Please try again later.");
      // The in-process fallback must NOT have been consulted: no password
      // verification ever ran (the request was denied before auth).
      expect(mocks.compare).not.toHaveBeenCalled();
      expect(mocks.adminAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: "LOGIN_BLOCKED" }),
      }));
    });

    it("fails closed with 503 on the MFA limiter when Redis errors mid-login", async () => {
      mocks.getRuntimeConfigValues.mockResolvedValue(REDIS_CONFIG);
      mocks.compare.mockResolvedValue(true);
      mocks.adminFindUnique.mockResolvedValue({
        id: "admin-mfa-degraded",
        email: "mfa-degraded@example.com",
        password: "hash",
        firstName: "Mfa",
        lastName: "Degraded",
        role: "SUPER_ADMIN",
        isActive: true,
        mfaEnabled: true,
        mfaSecret: "encrypted-secret",
        mfaBackupCodes: "[]",
      });
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes(encodeURIComponent("admin:mfa"))) {
          return Promise.reject(new Error("ECONNRESET"));
        }
        if (url.includes("/get/")) return Promise.resolve(upstashResponse(null));
        if (url.includes("/incr/")) return Promise.resolve(upstashResponse(1));
        return Promise.resolve(upstashResponse("OK"));
      });
      vi.stubGlobal("fetch", fetchMock);

      const response = await POST(request("mfa-degraded@example.com", { mfaCode: "123456" }));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error).toBe("Login temporarily unavailable. Please try again later.");
      expect(mocks.verifyTOTP).not.toHaveBeenCalled();
      expect(mocks.adminSessionCreate).not.toHaveBeenCalled();
    });
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

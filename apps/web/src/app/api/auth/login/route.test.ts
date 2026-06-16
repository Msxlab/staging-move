import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  verifyPassword: vi.fn(() => Promise.resolve(false)),
  hashPassword: vi.fn(() => Promise.resolve("$2a$12$dummyhashfortimingequalizer")),
  createUserSession: vi.fn(),
  generateFingerprint: vi.fn(() => Promise.resolve("fingerprint")),
  generateMobileFingerprint: vi.fn(() => Promise.resolve("mobile-fingerprint")),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  resolveClientIP: vi.fn(() => "203.0.113.10"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true, resetAt: Date.now() + 60_000 })),
}));

vi.mock("@/lib/login-lockout", () => ({
  isLoginLocked: vi.fn(() => Promise.resolve({ locked: false })),
  recordLoginFailure: vi.fn(() => Promise.resolve({ locked: false })),
  clearLoginFailures: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/security-alerts", () => ({
  recordFailedLoginForAlerting: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/store-review-account", () => ({
  getConfiguredStoreReviewAccountEmails: vi.fn(() => Promise.resolve([])),
  provisionStoreReviewAccount: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn(() => "totp-secret"),
}));

vi.mock("@/lib/totp", () => ({
  verifyTOTP: vi.fn(() => false),
  verifyBackupCode: vi.fn(() => Promise.resolve(-1)),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
  extractRequestMeta: vi.fn(() => ({ ipAddress: "203.0.113.10", userAgent: "Vitest" })),
}));

import { prisma } from "@/lib/db";
import { verifyPassword, createUserSession } from "@/lib/user-auth";
import { rateLimit } from "@/lib/rate-limit";
import { recordLoginFailure } from "@/lib/login-lockout";
import { recordFailedLoginForAlerting } from "@/lib/security-alerts";
import { getConfiguredStoreReviewAccountEmails, provisionStoreReviewAccount } from "@/lib/store-review-account";
import { verifyBackupCode } from "@/lib/totp";
import { createAuditLog } from "@/lib/audit";
import { POST } from "./route";
import { POST as MOBILE_POST } from "../../mobile/auth/login/route";

const userMock = prisma.user as unknown as { findFirst: Mock };
const userUpdateMock = prisma.user as unknown as { update: Mock };
const auditLogMock = prisma.auditLog as unknown as { create: Mock };
const verifyPasswordMock = verifyPassword as unknown as Mock;
const createUserSessionMock = createUserSession as unknown as Mock;
const rateLimitMock = rateLimit as unknown as Mock;
const recordLoginFailureMock = recordLoginFailure as unknown as Mock;
const recordFailedLoginForAlertingMock = recordFailedLoginForAlerting as unknown as Mock;
const getConfiguredStoreReviewAccountEmailsMock = getConfiguredStoreReviewAccountEmails as unknown as Mock;
const provisionStoreReviewAccountMock = provisionStoreReviewAccount as unknown as Mock;
const verifyBackupCodeMock = verifyBackupCode as unknown as Mock;
const createAuditLogMock = createAuditLog as unknown as Mock;

function makeRequest(body: unknown) {
  return new NextRequest("https://locateflow.com/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Vitest" },
    body: JSON.stringify(body),
  });
}

describe("login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userMock.findFirst.mockResolvedValue(null);
    userUpdateMock.update.mockResolvedValue({});
    auditLogMock.create.mockResolvedValue({});
    verifyPasswordMock.mockResolvedValue(false);
    createUserSessionMock.mockResolvedValue("session-token");
    rateLimitMock.mockResolvedValue({ success: true, resetAt: Date.now() + 60_000 });
    recordLoginFailureMock.mockResolvedValue({ locked: false });
    verifyBackupCodeMock.mockResolvedValue(-1);
    getConfiguredStoreReviewAccountEmailsMock.mockResolvedValue([]);
    provisionStoreReviewAccountMock.mockResolvedValue(undefined);
  });

  it("only looks up active non-deleted password users and returns a generic failure", async () => {
    const response = await POST(makeRequest({ email: "Deleted@Example.com", password: "Password-2026!" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Invalid email or password." });
    expect(userMock.findFirst).toHaveBeenCalledWith({
      where: { email: "deleted@example.com", deletedAt: null },
    });
    expect(recordLoginFailureMock).toHaveBeenCalledWith(expect.stringContaining("rl:auth_login"));
    expect(recordLoginFailureMock).not.toHaveBeenCalledWith("203.0.113.10");
    // The detection-only alarm counter sees every failed attempt (normalized
    // email + resolved client IP), including unknown-account ones.
    expect(recordFailedLoginForAlertingMock).toHaveBeenCalledWith({
      email: "deleted@example.com",
      ip: "203.0.113.10",
      clientType: "web",
    });
  });

  it("does not lock out a normal user before the failed-attempt threshold", async () => {
    userMock.findFirst.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      passwordHash: "hash",
      mfaEnabled: false,
      mfaSecret: null,
    });
    verifyPasswordMock.mockResolvedValue(false);
    recordLoginFailureMock.mockResolvedValue({ locked: false });

    const response = await POST(makeRequest({ email: "user@example.com", password: "wrong" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid email or password.");
    expect(recordFailedLoginForAlertingMock).toHaveBeenCalledWith({
      email: "user@example.com",
      ip: "203.0.113.10",
      clientType: "web",
    });
  });

  it("returns a temporary cooldown after repeated bad login attempts", async () => {
    userMock.findFirst.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      passwordHash: "hash",
      mfaEnabled: false,
      mfaSecret: null,
    });
    verifyPasswordMock.mockResolvedValue(false);
    recordLoginFailureMock.mockResolvedValue({ locked: true, retryAfterSec: 1800 });

    const response = await POST(makeRequest({ email: "user@example.com", password: "wrong" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1800");
    expect(body.error).toBe("Too many failed attempts. Please wait and try again.");
  });

  it("limits MFA backup-code guesses after the password is correct", async () => {
    userMock.findFirst.mockResolvedValue({
      id: "user-mfa",
      email: "mfa@example.com",
      passwordHash: "hash",
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: JSON.stringify(["hash-1"]),
    });
    verifyPasswordMock.mockResolvedValue(true);
    rateLimitMock
      .mockResolvedValueOnce({ success: true, resetAt: Date.now() + 60_000 })
      .mockResolvedValueOnce({ success: true, resetAt: Date.now() + 60_000 })
      .mockResolvedValueOnce({ success: false, resetAt: Date.now() + 60_000 });

    const response = await POST(makeRequest({
      email: "mfa@example.com",
      password: "correct",
      backupCode: "backup-1234",
    }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("MFA_RATE_LIMITED");
    expect(verifyBackupCodeMock).not.toHaveBeenCalled();
  });

  it("audits known-user password failures without storing the raw password", async () => {
    userMock.findFirst.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      passwordHash: "hash",
      mfaEnabled: false,
      mfaSecret: null,
    });
    verifyPasswordMock.mockResolvedValue(false);

    const response = await POST(makeRequest({ email: "user@example.com", password: "Password-2026!" }));

    expect(response.status).toBe(401);
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: "user_1",
        changes: { reason: "INVALID_PASSWORD" },
      }),
    );
    expect(JSON.stringify(createAuditLogMock.mock.calls)).not.toContain("Password-2026!");
  });

  it("audits successful login without storing the raw password", async () => {
    userMock.findFirst.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      firstName: "User",
      lastName: "Example",
      imageUrl: null,
      emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      passwordHash: "hash",
      mfaEnabled: false,
      mfaSecret: null,
    });
    verifyPasswordMock.mockResolvedValue(true);

    const response = await POST(makeRequest({ email: "user@example.com", password: "Password-2026!" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN",
        entityType: "User",
        entityId: "user_1",
        changes: { status: "success", clientType: "web" },
      }),
    );
    expect(JSON.stringify(createAuditLogMock.mock.calls)).not.toContain("Password-2026!");
  });

  it("does not expose the bearer token from the web login response", async () => {
    userMock.findFirst.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      firstName: "User",
      lastName: "Example",
      imageUrl: null,
      emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      passwordHash: "hash",
      mfaEnabled: false,
      mfaSecret: null,
    });
    verifyPasswordMock.mockResolvedValue(true);

    const response = await POST(makeRequest({ email: "user@example.com", password: "Password-2026!" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.token).toBeUndefined();
    expect(createUserSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ clientType: "web" }),
    );
  });

  it("returns a bearer token from the mobile login endpoint", async () => {
    userMock.findFirst.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      firstName: "User",
      lastName: "Example",
      imageUrl: null,
      emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      passwordHash: "hash",
      mfaEnabled: false,
      mfaSecret: null,
    });
    verifyPasswordMock.mockResolvedValue(true);

    const response = await MOBILE_POST(makeRequest({ email: "user@example.com", password: "Password-2026!" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBe("session-token");
    expect(createUserSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ clientType: "mobile" }),
    );
  });

  it("verifies and provisions the configured store review account on successful login", async () => {
    userMock.findFirst.mockResolvedValue({
      id: "review-user",
      email: "googlereview@locateflow.com",
      firstName: "Google",
      lastName: "Review",
      imageUrl: null,
      emailVerifiedAt: null,
      passwordHash: "hash",
      mfaEnabled: false,
      mfaSecret: null,
    });
    verifyPasswordMock.mockResolvedValue(true);
    getConfiguredStoreReviewAccountEmailsMock.mockResolvedValue(["googlereview@locateflow.com"]);

    const response = await MOBILE_POST(makeRequest({ email: "googlereview@locateflow.com", password: "Password-2026!" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.emailVerified).toBe(true);
    expect(userUpdateMock.update).toHaveBeenCalledWith({
      where: { id: "review-user" },
      data: { emailVerifiedAt: expect.any(Date) },
    });
    expect(provisionStoreReviewAccountMock).toHaveBeenCalledWith({
      userId: "review-user",
      request: expect.any(NextRequest),
    });
  });

  it("handles corrupt backup-code JSON without returning a 500", async () => {
    userMock.findFirst.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      firstName: "User",
      lastName: "Example",
      imageUrl: null,
      emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      passwordHash: "hash",
      mfaEnabled: true,
      mfaSecret: "encrypted-secret",
      mfaBackupCodes: "{not-json",
    });
    verifyPasswordMock.mockResolvedValue(true);
    verifyBackupCodeMock.mockResolvedValue(-1);

    const response = await POST(
      makeRequest({ email: "user@example.com", password: "Password-2026!", backupCode: "backup-code" }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Invalid MFA code." });
  });
});

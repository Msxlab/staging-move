import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  verifyPassword: vi.fn(() => Promise.resolve(false)),
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
import { createUserSession, verifyPassword } from "@/lib/user-auth";
import { createAuditLog } from "@/lib/audit";
import { verifyBackupCode } from "@/lib/totp";
import { POST } from "./route";
import { POST as MOBILE_POST } from "../../mobile/auth/login/route";

const userMock = prisma.user as unknown as { findFirst: Mock };
const createAuditLogMock = createAuditLog as unknown as Mock;
const createUserSessionMock = createUserSession as unknown as Mock;
const verifyPasswordMock = verifyPassword as unknown as Mock;
const verifyBackupCodeMock = verifyBackupCode as unknown as Mock;

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
    createUserSessionMock.mockResolvedValue("session-token");
    verifyPasswordMock.mockResolvedValue(false);
  });

  it("only looks up active non-deleted password users and returns a generic failure", async () => {
    const response = await POST(makeRequest({ email: "Deleted@Example.com", password: "Password-2026!" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Invalid email or password." });
    expect(userMock.findFirst).toHaveBeenCalledWith({
      where: { email: "deleted@example.com", deletedAt: null },
    });
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

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
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

import { prisma } from "@/lib/db";
import { verifyPassword, createUserSession } from "@/lib/user-auth";
import { rateLimit } from "@/lib/rate-limit";
import { recordLoginFailure } from "@/lib/login-lockout";
import { verifyBackupCode } from "@/lib/totp";
import { POST } from "./route";

const userMock = prisma.user as unknown as { findFirst: Mock };
const auditLogMock = prisma.auditLog as unknown as { create: Mock };
const verifyPasswordMock = verifyPassword as unknown as Mock;
const createUserSessionMock = createUserSession as unknown as Mock;
const rateLimitMock = rateLimit as unknown as Mock;
const recordLoginFailureMock = recordLoginFailure as unknown as Mock;
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
    auditLogMock.create.mockResolvedValue({});
    verifyPasswordMock.mockResolvedValue(false);
    createUserSessionMock.mockResolvedValue("session-token");
    rateLimitMock.mockResolvedValue({ success: true, resetAt: Date.now() + 60_000 });
    recordLoginFailureMock.mockResolvedValue({ locked: false });
    verifyBackupCodeMock.mockResolvedValue(-1);
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
});

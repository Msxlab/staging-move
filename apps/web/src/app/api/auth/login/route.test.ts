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

import { prisma } from "@/lib/db";
import { POST } from "./route";

const userMock = prisma.user as unknown as { findFirst: Mock };

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
});

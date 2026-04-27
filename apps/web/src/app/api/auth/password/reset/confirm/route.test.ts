import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    passwordResetToken: {
      findUnique: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/user-auth", () => ({
  hashOpaqueToken: vi.fn(() => "reset-hash"),
  hashPassword: vi.fn(() => Promise.resolve("new-hash")),
  validatePasswordPolicy: vi.fn(() => null),
  destroyAllUserSessions: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true, resetAt: Date.now() + 60_000 })),
}));

import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const rateLimitMock = rateLimit as unknown as Mock;
const tokenMock = prisma.passwordResetToken as unknown as { findUnique: Mock };

function makeRequest() {
  return new NextRequest("https://locateflow.com/api/auth/password/reset/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "reset-token", newPassword: "Valid-Password-2026!" }),
  });
}

describe("password reset confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true, resetAt: Date.now() + 60_000 });
    tokenMock.findUnique.mockResolvedValue(null);
  });

  it("rate limits reset confirmation attempts", async () => {
    rateLimitMock.mockResolvedValue({ success: false, resetAt: Date.now() + 60_000 });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("Too many requests. Please try again later.");
    expect(tokenMock.findUnique).not.toHaveBeenCalled();
  });
});

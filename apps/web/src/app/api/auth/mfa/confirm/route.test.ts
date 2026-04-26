import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user_1")),
}));

vi.mock("@/lib/totp", () => ({
  verifyTOTP: vi.fn(() => true),
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn(() => "secret"),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "auth:mfa:confirm:ip:203.0.113.10"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true, resetAt: Date.now() + 60_000 })),
}));

import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const rateLimitMock = rateLimit as unknown as Mock;
const userMock = prisma.user as unknown as { findUnique: Mock; update: Mock };

function makeRequest() {
  return new NextRequest("https://locateflow.com/api/auth/mfa/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mfaCode: "123456" }),
  });
}

describe("mfa confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true, resetAt: Date.now() + 60_000 });
    userMock.findUnique.mockResolvedValue({ mfaSecret: "encrypted", mfaEnabled: false });
    userMock.update.mockResolvedValue({});
  });

  it("applies both IP and per-user rate limits before validating the TOTP", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(rateLimitMock).toHaveBeenCalledWith(
      "auth:mfa:confirm:ip:203.0.113.10",
      { limit: 50, windowSeconds: 60 * 60 },
    );
    expect(rateLimitMock).toHaveBeenCalledWith(
      "auth:mfa:confirm:user:user_1",
      { limit: 5, windowSeconds: 60 },
    );
  });

  it("returns 429 when either MFA limit is exceeded", async () => {
    rateLimitMock
      .mockResolvedValueOnce({ success: true, resetAt: Date.now() + 60_000 })
      .mockResolvedValueOnce({ success: false, resetAt: Date.now() + 60_000 });

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);
    expect(userMock.findUnique).not.toHaveBeenCalled();
  });
});

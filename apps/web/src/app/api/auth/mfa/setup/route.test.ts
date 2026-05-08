import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/user-auth", () => ({
  requireDbUserId: vi.fn(),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("@/lib/totp", () => ({
  generateSecret: vi.fn(() => "secret"),
  generateProvisioningURI: vi.fn(() => "otpauth://totp/test"),
  generateBackupCodes: vi.fn(async () => ({ codes: [], hashes: [] })),
}));
vi.mock("@/lib/shared-encryption", () => ({ encrypt: vi.fn((value: string) => value) }));
vi.mock("@/lib/rate-limit-policy", () => ({
  enforceRateLimitPolicy: vi.fn(() =>
    Promise.resolve({
      success: true,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
    }),
  ),
}));
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve("data:image/png;base64,local-qr")),
  },
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/user-auth";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { POST } from "./route";

const userMock = prisma.user as unknown as { findUnique: Mock; update: Mock };
const enforceRateLimitPolicyMock = enforceRateLimitPolicy as unknown as Mock;

function request() {
  return new NextRequest("https://locateflow.com/api/auth/mfa/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "password" }),
  });
}

describe("mfa setup rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireDbUserId as unknown as Mock).mockResolvedValue("user_1");
    enforceRateLimitPolicyMock.mockResolvedValue({
      success: true,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
    });
    userMock.findUnique.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      passwordHash: "hash",
      mfaEnabled: false,
    });
    userMock.update.mockResolvedValue({});
  });

  it("returns 429 when the per-user setup limit is exceeded", async () => {
    (rateLimit as unknown as Mock)
      .mockResolvedValueOnce({ success: false, resetAt: Date.now() + 60_000 });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith(
      expect.stringContaining("rl:mfa_verify:user:"),
      expect.objectContaining({ limit: 5, windowSeconds: 5 * 60, failClosed: true }),
    );
  });

  it("returns a local QR data URL instead of an external QR service URL", async () => {
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.qrDataUrl).toBe("data:image/png;base64,local-qr");
    expect(JSON.stringify(body)).not.toContain("api.qrserver.com");
  });
});

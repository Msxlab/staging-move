import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/user-auth", () => ({
  requireDbUserId: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock("@/lib/totp", () => ({
  generateSecret: vi.fn(() => "secret"),
  generateProvisioningURI: vi.fn(() => "otpauth://totp/test"),
  generateBackupCodes: vi.fn(async () => ({ codes: [], hashes: [] })),
}));
vi.mock("@/lib/shared-encryption", () => ({ encrypt: vi.fn((value: string) => value) }));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "mfa-setup-ip-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true, resetAt: Date.now() + 60_000 })),
}));

import { requireDbUserId } from "@/lib/user-auth";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

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
});

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/user-auth", () => ({
  requireDbUserId: vi.fn(),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("@/lib/rate-limit-policy", () => ({
  enforceRateLimitPolicy: vi.fn(() =>
    Promise.resolve({
      success: true,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
    }),
  ),
}));
vi.mock("@/lib/user-security-audit", () => ({
  recordUserSecurityAudit: vi.fn(),
}));
vi.mock("@/lib/email-service", () => ({
  sendSecurityNoticeEmail: vi.fn(() => Promise.resolve()),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/user-auth";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";
import { POST } from "./route";

const userMock = prisma.user as unknown as { findUnique: Mock; update: Mock };
const enforceRateLimitPolicyMock = enforceRateLimitPolicy as unknown as Mock;
const recordUserSecurityAuditMock = recordUserSecurityAudit as unknown as Mock;

function request() {
  return new NextRequest("https://locateflow.com/api/auth/mfa/disable", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "password" }),
  });
}

describe("mfa disable rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireDbUserId as unknown as Mock).mockResolvedValue("user_1");
    enforceRateLimitPolicyMock.mockResolvedValue({
      success: true,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
    });
    userMock.findUnique.mockResolvedValue({
      email: "user@example.com",
      firstName: "User",
      preferredLocale: "en",
      passwordHash: "hash",
      mfaEnabled: true,
    });
    userMock.update.mockResolvedValue({});
  });

  it("returns 429 when the per-user disable limit is exceeded", async () => {
    enforceRateLimitPolicyMock.mockResolvedValueOnce({
      success: false,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
    });

    const response = await POST(request());

    expect(response.status).toBe(429);
  });

  it("audits MFA disable without storing the password", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(recordUserSecurityAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MFA_DISABLED",
        changes: { status: "success" },
      }),
    );
    expect(JSON.stringify(recordUserSecurityAuditMock.mock.calls)).not.toContain("password");
  });
});

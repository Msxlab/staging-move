import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

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
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";
import { POST } from "./route";

const enforceRateLimitPolicyMock = enforceRateLimitPolicy as unknown as Mock;
const recordUserSecurityAuditMock = recordUserSecurityAudit as unknown as Mock;
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
    enforceRateLimitPolicyMock.mockResolvedValue({
      success: true,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
    });
    userMock.findUnique.mockResolvedValue({
      email: "user@example.com",
      firstName: "User",
      preferredLocale: "en",
      mfaSecret: "encrypted",
      mfaEnabled: false,
    });
    userMock.update.mockResolvedValue({});
  });

  it("applies the MFA verify policy before validating the TOTP", async () => {
    const request = makeRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(enforceRateLimitPolicyMock).toHaveBeenCalledWith(
      request,
      "mfa_verify",
      { userId: "user_1", routeId: "mfa_confirm" },
    );
    expect(recordUserSecurityAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MFA_ENABLED",
        changes: { status: "success" },
      }),
    );
    expect(JSON.stringify(recordUserSecurityAuditMock.mock.calls)).not.toContain("123456");
  });

  it("returns 429 when the MFA policy limit is exceeded", async () => {
    enforceRateLimitPolicyMock.mockResolvedValueOnce({
      success: false,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);
    expect(userMock.findUnique).not.toHaveBeenCalled();
  });
});

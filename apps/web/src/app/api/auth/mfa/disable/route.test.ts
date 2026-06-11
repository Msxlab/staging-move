import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/user-auth", () => ({
  requireDbUserId: vi.fn(),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("@/lib/totp", () => ({
  verifyTOTP: vi.fn(() => true),
  verifyBackupCode: vi.fn(() => Promise.resolve(-1)),
}));
vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn(() => "DECRYPTEDSECRET"),
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
import { requireDbUserId, verifyPassword } from "@/lib/user-auth";
import { verifyTOTP, verifyBackupCode } from "@/lib/totp";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";
import { POST } from "./route";

const userMock = prisma.user as unknown as { findUnique: Mock; update: Mock; updateMany: Mock };
const enforceRateLimitPolicyMock = enforceRateLimitPolicy as unknown as Mock;
const recordUserSecurityAuditMock = recordUserSecurityAudit as unknown as Mock;
const verifyTOTPMock = verifyTOTP as unknown as Mock;
const verifyBackupCodeMock = verifyBackupCode as unknown as Mock;
const verifyPasswordMock = verifyPassword as unknown as Mock;

function request(body: Record<string, unknown>) {
  return new NextRequest("https://locateflow.com/api/auth/mfa/disable", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("mfa disable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireDbUserId as unknown as Mock).mockResolvedValue("user_1");
    verifyPasswordMock.mockResolvedValue(true);
    verifyTOTPMock.mockReturnValue(true);
    verifyBackupCodeMock.mockResolvedValue(-1);
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
      mfaSecret: "enc-secret",
      mfaBackupCodes: JSON.stringify(["hash-A", "hash-B"]),
    });
    userMock.update.mockResolvedValue({});
    userMock.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns 429 when the per-user disable limit is exceeded", async () => {
    enforceRateLimitPolicyMock.mockResolvedValueOnce({
      success: false,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
    });

    const response = await POST(request({ password: "password", mfaCode: "123456" }));

    expect(response.status).toBe(429);
    expect(enforceRateLimitPolicyMock).toHaveBeenCalledWith(
      expect.anything(),
      "mfa_verify",
      expect.objectContaining({ userId: "user_1" }),
    );
  });

  it("rejects a password-only disable when MFA is enabled (second factor required)", async () => {
    const response = await POST(request({ password: "password" }));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.code).toBe("MFA_CODE_REQUIRED");
    expect(json.requiresMfa).toBe(true);
    // MFA must NOT have been turned off.
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it("rejects when the password is correct but the TOTP code is wrong", async () => {
    verifyTOTPMock.mockReturnValue(false);

    const response = await POST(request({ password: "password", mfaCode: "000000" }));

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.code).toBe("MFA_CODE_INVALID");
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it("disables MFA with a valid password + valid TOTP code", async () => {
    const response = await POST(request({ password: "password", mfaCode: "123456" }));

    expect(response.status).toBe(200);
    expect(userMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
      }),
    );
    expect(recordUserSecurityAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MFA_DISABLED", changes: { status: "success" } }),
    );
    expect(JSON.stringify(recordUserSecurityAuditMock.mock.calls)).not.toContain("password");
  });

  it("disables MFA with a valid password + valid backup code, consuming the code", async () => {
    verifyTOTPMock.mockReturnValue(false);
    verifyBackupCodeMock.mockResolvedValue(0); // matches first stored hash

    const response = await POST(request({ password: "password", backupCode: "BACKUP-1" }));

    expect(response.status).toBe(200);
    // The matched backup code is removed via a compare-and-swap updateMany.
    expect(userMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "user_1" }),
      }),
    );
    expect(userMock.update).toHaveBeenCalled();
  });

  it("does not disable MFA when the backup-code CAS loses the race", async () => {
    verifyTOTPMock.mockReturnValue(false);
    verifyBackupCodeMock.mockResolvedValue(0);
    userMock.updateMany.mockResolvedValue({ count: 0 }); // concurrent consumer won

    const response = await POST(request({ password: "password", backupCode: "BACKUP-1" }));

    expect(response.status).toBe(403);
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it("rejects with 400 when MFA is not enabled at all", async () => {
    userMock.findUnique.mockResolvedValue({
      email: "user@example.com",
      firstName: "User",
      preferredLocale: "en",
      passwordHash: "hash",
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    });

    const response = await POST(request({ password: "password", mfaCode: "123456" }));
    expect(response.status).toBe(400);
  });
});

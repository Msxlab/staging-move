import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  targetFindUnique: vi.fn(),
  adminFindUnique: vi.fn(),
  otpUpdateMany: vi.fn(),
  otpCreate: vi.fn(),
  writeAdminAudit: vi.fn(),
  sendHardDeleteOtpEmail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: { findUnique: (...args: unknown[]) => mocks.adminFindUnique(...args) },
    adminActionOtp: {
      updateMany: (...args: unknown[]) => mocks.otpUpdateMany(...args),
      create: (...args: unknown[]) => mocks.otpCreate(...args),
    },
  },
  prismaUnsafe: {
    user: { findUnique: (...args: unknown[]) => mocks.targetFindUnique(...args) },
  },
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: vi.fn(() => ({ ipAddress: "203.0.113.10", userAgent: "vitest" })),
  writeAdminAudit: (...args: unknown[]) => mocks.writeAdminAudit(...args),
}));

vi.mock("@/lib/email", () => ({
  sendHardDeleteOtpEmail: (...args: unknown[]) => mocks.sendHardDeleteOtpEmail(...args),
}));

import { legacySha256AdminActionOtpCode } from "@/lib/admin-action-otp";
import { POST } from "./route";

const params = { params: Promise.resolve({ id: "user_1" }) };

function request() {
  return new NextRequest("https://admin.locateflow.com/api/users/user_1/hard-delete/otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmPassword: "pw", mfaCode: "123456" }),
  });
}

describe("POST /api/users/[id]/hard-delete/otp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_JWT_SECRET", "admin-jwt-secret-at-least-32-characters");
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "SUPER_ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.targetFindUnique.mockResolvedValue({ id: "user_1", email: "target@example.com" });
    mocks.adminFindUnique.mockResolvedValue({ email: "operator@example.com", isActive: true });
    mocks.otpUpdateMany.mockResolvedValue({ count: 0 });
    mocks.otpCreate.mockResolvedValue({});
    mocks.writeAdminAudit.mockResolvedValue(undefined);
    mocks.sendHardDeleteOtpEmail.mockResolvedValue(true);
  });

  it("sends the OTP to the acting admin, not the target user, and stores an HMAC hash", async () => {
    const res = await POST(request(), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ otpSent: true, recipientMaskedEmail: expect.any(String) });
    expect(mocks.sendHardDeleteOtpEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "operator@example.com",
      targetMaskedEmail: expect.stringContaining("@example.com"),
    }));
    expect(JSON.stringify(mocks.sendHardDeleteOtpEmail.mock.calls)).not.toContain('"to":"target@example.com"');

    const createArg = mocks.otpCreate.mock.calls[0][0];
    expect(createArg.data.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArg.data.codeHash).not.toBe(legacySha256AdminActionOtpCode(mocks.sendHardDeleteOtpEmail.mock.calls[0][0].code));
  });
});

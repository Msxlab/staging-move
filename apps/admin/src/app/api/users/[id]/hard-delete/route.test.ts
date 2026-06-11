import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  otpFindFirst: vi.fn(),
  otpUpdateMany: vi.fn(),
  writeAdminAudit: vi.fn(),
  verifyAdminActionOtpCode: vi.fn(),
  hardDeleteUser: vi.fn(),
  dispatchAlert: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminActionOtp: {
      findFirst: (...args: unknown[]) => mocks.otpFindFirst(...args),
      updateMany: (...args: unknown[]) => mocks.otpUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: vi.fn(() => ({ ipAddress: "203.0.113.10", userAgent: "vitest" })),
  writeAdminAudit: (...args: unknown[]) => mocks.writeAdminAudit(...args),
}));

vi.mock("@/lib/admin-action-otp", () => ({
  verifyAdminActionOtpCode: (...args: unknown[]) => mocks.verifyAdminActionOtpCode(...args),
}));

vi.mock("@/lib/hard-delete-user", () => ({
  hardDeleteUser: (...args: unknown[]) => mocks.hardDeleteUser(...args),
}));

vi.mock("@/lib/alert-dispatcher", () => ({
  dispatchAlert: (...args: unknown[]) => mocks.dispatchAlert(...args),
}));

import { POST } from "./route";

const params = { params: Promise.resolve({ id: "user_1" }) };

function request(body: Record<string, unknown> = { confirmPassword: "pw", mfaCode: "123456", otpCode: "654321" }) {
  return new NextRequest("https://admin.locateflow.com/api/users/user_1/hard-delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/users/[id]/hard-delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", email: "op@example.com", role: "SUPER_ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    // A valid, unconsumed, unexpired OTP.
    mocks.otpFindFirst.mockResolvedValue({
      id: "otp_1",
      codeHash: "hash",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    mocks.verifyAdminActionOtpCode.mockReturnValue(true);
    mocks.otpUpdateMany.mockResolvedValue({ count: 1 });
    mocks.writeAdminAudit.mockResolvedValue(undefined);
    mocks.dispatchAlert.mockResolvedValue(undefined);
  });

  it("succeeds and writes a USER_HARD_DELETED audit row when erasure succeeds", async () => {
    mocks.hardDeleteUser.mockResolvedValue({
      success: true,
      maskedEmail: "t***@e***.com",
      stripeCanceled: true,
      ownedWorkspacesTransferred: 0,
      ownedWorkspacesDeleted: 0,
      gdprRequestsPurged: 0,
    });

    const res = await POST(request(), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, hardDeleted: true });
    expect(mocks.hardDeleteUser).toHaveBeenCalledWith("user_1", { force: false });
    const actions = mocks.writeAdminAudit.mock.calls.map((c) => c[1].action);
    expect(actions).toContain("USER_HARD_DELETED");
    expect(actions).not.toContain("USER_HARD_DELETE_BLOCKED");
    expect(mocks.dispatchAlert).not.toHaveBeenCalled();
  });

  it("BLOCKS (409) with STRIPE_CANCEL_FAILED, audits, and alerts when Stripe cancel fails", async () => {
    mocks.hardDeleteUser.mockResolvedValue({
      success: false,
      blocked: true,
      code: "STRIPE_CANCEL_FAILED",
      maskedEmail: "t***@e***.com",
      stripeSubscriptionId: "sub_live_1",
    });

    const res = await POST(request(), params);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toMatchObject({
      reason: "STRIPE_CANCEL_FAILED",
      blocked: true,
      stripeSubscriptionId: "sub_live_1",
      canForce: true,
    });
    // No success row; a BLOCKED row IS written.
    const actions = mocks.writeAdminAudit.mock.calls.map((c) => c[1].action);
    expect(actions).toContain("USER_HARD_DELETE_BLOCKED");
    expect(actions).not.toContain("USER_HARD_DELETED");
    // An alert fired with the subscription id in the details.
    expect(mocks.dispatchAlert).toHaveBeenCalledTimes(1);
    const alertArgs = mocks.dispatchAlert.mock.calls[0];
    expect(alertArgs[0]).toBe("USER_HARD_DELETE_STRIPE_CANCEL_FAILED");
    expect(alertArgs[1]).toBe("HIGH");
    expect(String(alertArgs[3])).toContain("sub_live_1");
  });

  it("forwards force=true to hardDeleteUser when the operator forces", async () => {
    mocks.hardDeleteUser.mockResolvedValue({
      success: true,
      maskedEmail: "t***@e***.com",
      stripeCanceled: false,
      ownedWorkspacesTransferred: 0,
      ownedWorkspacesDeleted: 0,
      gdprRequestsPurged: 0,
    });

    const res = await POST(
      request({ confirmPassword: "pw", mfaCode: "123456", otpCode: "654321", force: true }),
      params,
    );

    expect(res.status).toBe(200);
    expect(mocks.hardDeleteUser).toHaveBeenCalledWith("user_1", { force: true });
    expect(mocks.dispatchAlert).not.toHaveBeenCalled();
  });

  it("does not treat a non-boolean force value as forcing", async () => {
    mocks.hardDeleteUser.mockResolvedValue({
      success: true,
      maskedEmail: "t***@e***.com",
      stripeCanceled: true,
      ownedWorkspacesTransferred: 0,
      ownedWorkspacesDeleted: 0,
      gdprRequestsPurged: 0,
    });

    await POST(
      request({ confirmPassword: "pw", mfaCode: "123456", otpCode: "654321", force: "true" }),
      params,
    );

    expect(mocks.hardDeleteUser).toHaveBeenCalledWith("user_1", { force: false });
  });
});

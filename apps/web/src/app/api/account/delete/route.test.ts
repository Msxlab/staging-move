import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn((_options?: unknown) => Promise.resolve("user-1")),
  userFindUnique: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  verifyUserStepUp: vi.fn(),
  getActiveAccountDeletionRequest: vi.fn(),
  createAccountDeletionRequest: vi.fn(),
  processAccountDeletionRequest: vi.fn(),
  createAuditLog: vi.fn(() => Promise.resolve()),
  sendSecurityNoticeEmail: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: (options?: unknown) => (mocks.requireDbUserId as any)(options),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (args: any) => (mocks.userFindUnique as any)(args),
    },
    subscription: {
      findUnique: (args: any) => (mocks.subscriptionFindUnique as any)(args),
    },
  },
}));

vi.mock("@/lib/rate-limit-policy", () => ({
  enforceRateLimitPolicy: vi.fn(() => Promise.resolve({
    success: true,
    remaining: 2,
    resetAt: Date.now() + 60_000,
    retryAfterSeconds: 60,
    policy: { userFacingErrorCode: "ACCOUNT_DELETE_RATE_LIMITED" },
    key: "delete-key",
  })),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: (input: any) => (mocks.createAuditLog as any)(input),
  extractRequestMeta: vi.fn(() => ({ ipAddress: "203.0.113.10", userAgent: "vitest" })),
}));

vi.mock("@/lib/user-step-up", () => ({
  verifyUserStepUp: (input: any) => (mocks.verifyUserStepUp as any)(input),
}));

vi.mock("@/lib/account-deletion", () => ({
  getActiveAccountDeletionRequest: (userId: string) => (mocks.getActiveAccountDeletionRequest as any)(userId),
  createAccountDeletionRequest: (input: any) => (mocks.createAccountDeletionRequest as any)(input),
  processAccountDeletionRequest: (id: string) => (mocks.processAccountDeletionRequest as any)(id),
}));

vi.mock("@/lib/email-service", () => ({
  sendSecurityNoticeEmail: (input: any) => (mocks.sendSecurityNoticeEmail as any)(input),
}));

import { POST } from "./route";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";

const rateLimitPolicyMock = enforceRateLimitPolicy as any;

function request(body: unknown = {}) {
  return new NextRequest("https://app.locateflow.com/api/account/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("account deletion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user-1");
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      firstName: "User",
      preferredLocale: "en",
    });
    mocks.subscriptionFindUnique.mockResolvedValue(null);
    mocks.verifyUserStepUp.mockResolvedValue({ ok: true, method: "password" });
    mocks.getActiveAccountDeletionRequest.mockResolvedValue(null);
    mocks.createAccountDeletionRequest.mockResolvedValue({ id: "gdpr-1" });
    mocks.processAccountDeletionRequest.mockResolvedValue({
      id: "gdpr-1",
      status: "COMPLETED",
      cleanup: { stripeCanceled: true, userDeleted: true },
    });
    rateLimitPolicyMock.mockResolvedValue({
      success: true,
      remaining: 2,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "ACCOUNT_DELETE_RATE_LIMITED" },
      key: "delete-key",
    });
  });

  it("blocks deletion request creation and processing without server-side step-up", async () => {
    mocks.verifyUserStepUp.mockResolvedValue({
      ok: false,
      code: "STEP_UP_REQUIRED",
      message: "Enter your password or a valid MFA code before deleting your account.",
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("STEP_UP_REQUIRED");
    expect(mocks.createAccountDeletionRequest).not.toHaveBeenCalled();
    expect(mocks.processAccountDeletionRequest).not.toHaveBeenCalled();
  });

  it("creates and processes a deletion request after valid step-up", async () => {
    const response = await POST(request({ confirmPassword: "correct-password" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("COMPLETED");
    expect(mocks.verifyUserStepUp).toHaveBeenCalledWith({
      userId: "user-1",
      confirmPassword: "correct-password",
      mfaCode: null,
      backupCode: null,
      confirmAccountDeletion: false,
    });
    expect(mocks.createAccountDeletionRequest).toHaveBeenCalledWith({
      userId: "user-1",
      source: "self_service",
      email: "user@example.com",
      stripeSubscriptionId: null,
    });
    expect(mocks.processAccountDeletionRequest).toHaveBeenCalledWith("gdpr-1");
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "ACCOUNT_DELETE",
      changes: expect.objectContaining({ stepUpMethod: "password" }),
    }));
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "ACCOUNT_DEL_PROC",
      entityId: "gdpr-1",
    }));
  });

  it("blocks OAuth-only deletion bypass without a server-side confirmation phrase", async () => {
    const response = await POST(request({ confirmAccountDeletion: true }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("DELETE_CONFIRMATION_REQUIRED");
    expect(mocks.verifyUserStepUp).not.toHaveBeenCalled();
    expect(mocks.createAccountDeletionRequest).not.toHaveBeenCalled();
  });

  it("passes OAuth-only deletion through when DELETE is confirmed server-side", async () => {
    mocks.verifyUserStepUp.mockResolvedValue({ ok: true, method: "oauth_only_account_deletion" });

    const response = await POST(request({ confirmAccountDeletion: true, confirmText: "DELETE" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("COMPLETED");
    expect(mocks.verifyUserStepUp).toHaveBeenCalledWith({
      userId: "user-1",
      confirmPassword: null,
      mfaCode: null,
      backupCode: null,
      confirmAccountDeletion: true,
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "ACCOUNT_DELETE",
      changes: expect.objectContaining({ stepUpMethod: "oauth_only_account_deletion" }),
    }));
  });

  it("applies a user-scoped cooldown before repeated delete attempts", async () => {
    rateLimitPolicyMock.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "ACCOUNT_DELETE_RATE_LIMITED" },
      key: "delete-key",
    });

    const response = await POST(request({ confirmPassword: "correct-password" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(body.code).toBe("ACCOUNT_DELETE_RATE_LIMITED");
    expect(mocks.verifyUserStepUp).not.toHaveBeenCalled();
    expect(mocks.processAccountDeletionRequest).not.toHaveBeenCalled();
  });

  it("limits backup-code step-up attempts for account deletion", async () => {
    rateLimitPolicyMock
      .mockResolvedValueOnce({
        success: true,
        remaining: 2,
        resetAt: Date.now() + 60_000,
        retryAfterSeconds: 60,
        policy: { userFacingErrorCode: "ACCOUNT_DELETE_RATE_LIMITED" },
        key: "delete-key",
      })
      .mockResolvedValueOnce({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 60_000,
        retryAfterSeconds: 60,
        policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
        key: "mfa-key",
      });

    const response = await POST(request({ confirmPassword: "correct-password", backupCode: "backup-123" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("MFA_RATE_LIMITED");
    expect(mocks.verifyUserStepUp).not.toHaveBeenCalled();
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  subscriptionUpdate: vi.fn(),
  auditCreate: vi.fn(),
  getAdminRuntimeConfigValue: vi.fn(),
  stripeUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: (...args: unknown[]) => mocks.subscriptionFindUnique(...args),
      update: (...args: unknown[]) => mocks.subscriptionUpdate(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValue: (...args: unknown[]) => mocks.getAdminRuntimeConfigValue(...args),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function Stripe() {
    return {
    subscriptions: {
      update: (...args: unknown[]) => mocks.stripeUpdate(...args),
    },
    };
  }),
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/users/user_1/subscription-actions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

describe("admin user subscription actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.subscriptionFindUnique.mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      provider: "STRIPE",
      plan: "INDIVIDUAL",
      stripeSubscriptionId: "sub_live_123",
      accessType: "PAID",
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      currentPeriodEndsAt: new Date("2026-06-01T00:00:00Z"),
    });
    mocks.stripeUpdate.mockResolvedValue({ current_period_end: 1780272000 });
    mocks.subscriptionUpdate.mockResolvedValue({ id: "sub_1", status: "CANCEL_AT_PERIOD_END" });
    mocks.getAdminRuntimeConfigValue.mockResolvedValue("sk_test_valid_secret_key_123456789");
    mocks.auditCreate.mockResolvedValue({});
  });

  it("requires subscriptions permission and MFA step-up", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({ action: "cancel_renewal", confirmPassword: "pw" }), {
      params: Promise.resolve({ id: "user_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1", role: "ADMIN" },
      "pw",
      expect.objectContaining({ operation: "billing_subscription_action", requireMfa: true }),
    );
    expect(mocks.subscriptionFindUnique).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "SUBSCRIPTION_ACTION_FAILED", entityType: "User", entityId: "user_1" }),
    });
  });

  it("writes STARTED before Stripe, uses idempotency, and completes only after DB success", async () => {
    const response = await POST(request({ action: "cancel_renewal", confirmPassword: "pw", mfaCode: "123456" }), {
      params: Promise.resolve({ id: "user_1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.stripeUpdate).toHaveBeenCalledWith(
      "sub_live_123",
      { cancel_at_period_end: true },
      expect.objectContaining({ idempotencyKey: expect.stringContaining("admin-subscription-action-v2:cancel_renewal:user_1:sub_1:ACTIVE:renewing") }),
    );
    const startedCall = mocks.auditCreate.mock.calls.find(([arg]) => arg.data.action === "SUBSCRIPTION_ACTION_STARTED");
    const completedCall = mocks.auditCreate.mock.calls.find(([arg]) => arg.data.action === "SUBSCRIPTION_ACTION_COMPLETED");
    expect(startedCall).toBeTruthy();
    expect(completedCall).toBeTruthy();
    expect(startedCall?.[0].data.changes).not.toContain("sub_live_123");
    expect(completedCall?.[0].data.changes).not.toContain("sub_live_123");
    expect(mocks.auditCreate.mock.invocationCallOrder[mocks.auditCreate.mock.calls.findIndex(([arg]) => arg.data.action === "SUBSCRIPTION_ACTION_STARTED")]).toBeLessThan(
      mocks.stripeUpdate.mock.invocationCallOrder[0],
    );
    expect(mocks.auditCreate.mock.invocationCallOrder[mocks.auditCreate.mock.calls.findIndex(([arg]) => arg.data.action === "SUBSCRIPTION_ACTION_COMPLETED")]).toBeGreaterThan(
      mocks.subscriptionUpdate.mock.invocationCallOrder[0],
    );
  });

  it("uses a retry-stable idempotency key for the same action and current-state window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T12:03:00.000Z"));
    try {
      const first = await POST(request({ action: "cancel_renewal", confirmPassword: "pw", mfaCode: "123456" }), {
        params: Promise.resolve({ id: "user_1" }),
      });
      const second = await POST(request({ action: "cancel_renewal", confirmPassword: "pw", mfaCode: "123456" }), {
        params: Promise.resolve({ id: "user_1" }),
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const firstKey = (mocks.stripeUpdate.mock.calls[0][2] as { idempotencyKey: string }).idempotencyKey;
      const secondKey = (mocks.stripeUpdate.mock.calls[1][2] as { idempotencyKey: string }).idempotencyKey;
      expect(firstKey).toBe(secondKey);
      expect(firstKey).toContain("admin-subscription-action-v2:cancel_renewal:user_1:sub_1:ACTIVE:renewing");
      expect(firstKey).not.toContain("sub_live_123");
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects cancel_trial unless the local Stripe subscription is trialing", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      provider: "STRIPE",
      stripeSubscriptionId: "sub_live_123",
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
    });

    const response = await POST(request({ action: "cancel_trial", confirmPassword: "pw", mfaCode: "123456" }), {
      params: Promise.resolve({ id: "user_1" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.stripeUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "SUBSCRIPTION_ACTION_FAILED", entityType: "Subscription", entityId: "sub_1" }),
    });
  });

  it("rejects cancel_renewal when renewal is already canceling", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      provider: "STRIPE",
      stripeSubscriptionId: "sub_live_123",
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
    });

    const response = await POST(request({ action: "cancel_renewal", confirmPassword: "pw", mfaCode: "123456" }), {
      params: Promise.resolve({ id: "user_1" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.stripeUpdate).not.toHaveBeenCalled();
  });

  it("rejects resume_renewal when renewal is not canceling", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      provider: "STRIPE",
      stripeSubscriptionId: "sub_live_123",
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
    });

    const response = await POST(request({ action: "resume_renewal", confirmPassword: "pw", mfaCode: "123456" }), {
      params: Promise.resolve({ id: "user_1" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.stripeUpdate).not.toHaveBeenCalled();
  });

  it("does not write DB mutations when Stripe provider update fails", async () => {
    mocks.stripeUpdate.mockRejectedValue({ type: "StripeAPIError", code: "api_error", message: "provider down" });

    const response = await POST(request({ action: "cancel_renewal", confirmPassword: "pw", mfaCode: "123456" }), {
      params: Promise.resolve({ id: "user_1" }),
    });

    expect(response.status).toBe(502);
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "SUBSCRIPTION_ACTION_FAILED", entityType: "Subscription", entityId: "sub_1" }),
    });
  });

  it("audits DB failure after Stripe success without marking completed", async () => {
    mocks.subscriptionUpdate.mockRejectedValue({ code: "P2002" });

    const response = await POST(request({ action: "cancel_renewal", confirmPassword: "pw", mfaCode: "123456" }), {
      params: Promise.resolve({ id: "user_1" }),
    });

    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);
    expect(response.status).toBe(500);
    expect(mocks.stripeUpdate).toHaveBeenCalled();
    expect(mocks.auditCreate.mock.calls.some(([arg]) => arg.data.action === "SUBSCRIPTION_ACTION_COMPLETED")).toBe(false);
    expect(serializedAudit).toContain("db_update_failed_after_provider_success");
    expect(serializedAudit).not.toContain("sub_live_123");
  });

  it("audits without raw Stripe provider IDs", async () => {
    const response = await POST(request({ action: "cancel_renewal", confirmPassword: "pw", mfaCode: "123456" }), {
      params: Promise.resolve({ id: "user_1" }),
    });

    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);
    const auditCall = mocks.auditCreate.mock.calls.find(([arg]) => arg.data.action === "SUBSCRIPTION_ACTION_COMPLETED");
    expect(auditCall).toBeTruthy();
    expect(response.status).toBe(200);
    expect(serializedAudit).not.toContain("sub_live_123");
    expect(serializedAudit).not.toContain("stripeSubscriptionId");
  });
});

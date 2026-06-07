import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  subscriptionUpdate: vi.fn(),
  auditCreate: vi.fn(),
  getAdminRuntimeConfigValue: vi.fn(),
  stripeCancel: vi.fn(),
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
    adminAuditLog: { create: (...args: unknown[]) => mocks.auditCreate(...args) },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValue: (...args: unknown[]) => mocks.getAdminRuntimeConfigValue(...args),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function Stripe() {
    return {
      subscriptions: {
        cancel: (...args: unknown[]) => mocks.stripeCancel(...args),
        update: (...args: unknown[]) => mocks.stripeUpdate(...args),
      },
    };
  }),
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/subscriptions/sub_1/cancel", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "sub_1" }) };

describe("admin subscription cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "ADMIN" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.subscriptionFindUnique.mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      provider: "STRIPE",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      accessType: "PAID",
      stripeSubscriptionId: "sub_live_123",
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      currentPeriodEndsAt: new Date("2026-06-01T00:00:00Z"),
    });
    mocks.stripeCancel.mockResolvedValue({ status: "canceled", current_period_end: 1780272000 });
    mocks.stripeUpdate.mockResolvedValue({ status: "active", cancel_at_period_end: true, current_period_end: 1780272000 });
    mocks.subscriptionUpdate.mockResolvedValue({ id: "sub_1", userId: "user_1", status: "CANCELED" });
    mocks.getAdminRuntimeConfigValue.mockResolvedValue("sk_test_valid_secret_key_123456789");
    mocks.auditCreate.mockResolvedValue({});
  });

  it("requires subscriptions canUpdate + ADMIN and MFA step-up", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: false, error: "MFA verification required for this operation.", requiresMfa: true });
    const res = await POST(request({ mode: "now", confirmPassword: "pw" }), params);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1", role: "ADMIN" },
      "pw",
      expect.objectContaining({ operation: "billing_subscription_cancel", requireMfa: true }),
    );
    expect(mocks.subscriptionFindUnique).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "SUBSCRIPTION_CANCEL_FAILED" }),
    });
  });

  it("cancels immediately and writes STARTED then COMPLETED without raw provider id", async () => {
    const res = await POST(request({ mode: "now", confirmPassword: "pw", mfaCode: "123456" }), params);
    expect(res.status).toBe(200);
    expect(mocks.stripeCancel).toHaveBeenCalledWith("sub_live_123");
    const serialized = JSON.stringify(mocks.auditCreate.mock.calls);
    expect(serialized).toContain("SUBSCRIPTION_CANCEL_STARTED");
    expect(serialized).toContain("SUBSCRIPTION_CANCEL_COMPLETED");
    expect(serialized).not.toContain("sub_live_123");
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sub_1" }, data: expect.objectContaining({ status: "CANCELED", cancelAtPeriodEnd: false }) }),
    );
  });

  it("period_end uses cancel_at_period_end:true and stores CANCEL_AT_PERIOD_END", async () => {
    const res = await POST(request({ mode: "period_end", confirmPassword: "pw", mfaCode: "123456" }), params);
    expect(res.status).toBe(200);
    expect(mocks.stripeUpdate).toHaveBeenCalledWith(
      "sub_live_123",
      { cancel_at_period_end: true },
      expect.objectContaining({ idempotencyKey: expect.stringContaining("admin-subscription-cancel:period_end:sub_1") }),
    );
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCEL_AT_PERIOD_END", cancelAtPeriodEnd: true }) }),
    );
  });

  it("rejects a non-Stripe subscription", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({ id: "sub_1", userId: "user_1", provider: "APP_STORE", status: "ACTIVE", stripeSubscriptionId: null });
    const res = await POST(request({ mode: "now", confirmPassword: "pw", mfaCode: "123456" }), params);
    expect(res.status).toBe(409);
    expect(mocks.stripeCancel).not.toHaveBeenCalled();
  });

  it("does not write DB mutation when Stripe cancel fails", async () => {
    mocks.stripeCancel.mockRejectedValue({ type: "StripeAPIError", code: "api_error" });
    const res = await POST(request({ mode: "now", confirmPassword: "pw", mfaCode: "123456" }), params);
    expect(res.status).toBe(502);
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.auditCreate.mock.calls)).toContain("provider_update_failed");
  });
});

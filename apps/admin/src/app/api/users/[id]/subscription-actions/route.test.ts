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
      stripeSubscriptionId: "sub_live_123",
      accessType: "PAID",
      status: "ACTIVE",
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
      data: expect.objectContaining({ action: "USER_BILLING_UPDATE_FAILED", entityType: "User", entityId: "user_1" }),
    });
  });

  it("updates Stripe and audits without storing raw Stripe subscription id", async () => {
    const response = await POST(request({ action: "cancel_renewal", confirmPassword: "pw", mfaCode: "123456" }), {
      params: Promise.resolve({ id: "user_1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.stripeUpdate).toHaveBeenCalledWith("sub_live_123", { cancel_at_period_end: true });
    const auditCall = mocks.auditCreate.mock.calls.find(([arg]) => arg.data.action === "USER_BILLING_UPDATED");
    expect(auditCall).toBeTruthy();
    expect(auditCall?.[0].data.changes).not.toContain("sub_live_123");
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  auditCreate: vi.fn(),
  getAdminRuntimeConfigValue: vi.fn(),
  invoicesList: vi.fn(),
  refundsCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: (...args: unknown[]) => mocks.subscriptionFindUnique(...args) },
    adminAuditLog: { create: (...args: unknown[]) => mocks.auditCreate(...args) },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValue: (...args: unknown[]) => mocks.getAdminRuntimeConfigValue(...args),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function Stripe() {
    return {
      invoices: { list: (...args: unknown[]) => mocks.invoicesList(...args) },
      refunds: { create: (...args: unknown[]) => mocks.refundsCreate(...args) },
    };
  }),
}));

import { GET, POST } from "./route";

function postRequest(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/subscriptions/sub_1/refund", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}
function getRequest() {
  return new NextRequest("https://admin.locateflow.com/api/subscriptions/sub_1/refund");
}
const params = { params: Promise.resolve({ id: "sub_1" }) };

describe("admin subscription refund", () => {
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
      stripeSubscriptionId: "sub_live_123",
      user: { id: "user_1", email: "buyer@example.com" },
    });
    mocks.invoicesList.mockResolvedValue({
      data: [{ id: "in_live_9", amount_paid: 1499, currency: "usd", payment_intent: "pi_live_77" }],
    });
    mocks.refundsCreate.mockResolvedValue({ id: "re_live_1", amount: 1499, currency: "usd", status: "succeeded" });
    mocks.getAdminRuntimeConfigValue.mockResolvedValue("sk_test_valid_secret_key_123456789");
    mocks.auditCreate.mockResolvedValue({});
  });

  it("GET previews the refundable amount + currency", async () => {
    const res = await GET(getRequest(), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ refundable: true, amount: 1499, currency: "usd" });
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it("requires canUpdate + ADMIN and MFA step-up before refunding", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: false, error: "MFA verification required for this operation.", requiresMfa: true });
    const res = await POST(postRequest({ confirmPassword: "pw" }), params);
    expect(res.status).toBe(403);
    expect(mocks.requirePermission).toHaveBeenCalledWith("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin_1", role: "ADMIN" },
      "pw",
      expect.objectContaining({ operation: "billing_subscription_refund", requireMfa: true }),
    );
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it("refunds the latest invoice payment_intent and audits the amount without raw ids", async () => {
    const res = await POST(postRequest({ confirmPassword: "pw", mfaCode: "123456", expectedAmount: 1499 }), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ refunded: true, amount: 1499, currency: "usd" });
    expect(mocks.refundsCreate).toHaveBeenCalledWith(
      { payment_intent: "pi_live_77", amount: 1499 },
      expect.objectContaining({ idempotencyKey: expect.stringContaining("admin-subscription-refund:sub_1") }),
    );
    const serialized = JSON.stringify(mocks.auditCreate.mock.calls);
    expect(serialized).toContain("SUBSCRIPTION_REFUND_STARTED");
    expect(serialized).toContain("SUBSCRIPTION_REFUND_COMPLETED");
    expect(serialized).toContain("1499");
    expect(serialized).not.toContain("pi_live_77");
    expect(serialized).not.toContain("in_live_9");
  });

  it("refuses when the confirmed amount no longer matches the latest invoice", async () => {
    const res = await POST(postRequest({ confirmPassword: "pw", mfaCode: "123456", expectedAmount: 999 }), params);
    expect(res.status).toBe(409);
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.auditCreate.mock.calls)).toContain("amount_mismatch");
  });

  it("409s when there is no paid invoice", async () => {
    mocks.invoicesList.mockResolvedValue({ data: [] });
    const res = await POST(postRequest({ confirmPassword: "pw", mfaCode: "123456" }), params);
    expect(res.status).toBe(409);
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it("502s and does not mark completed when Stripe refund fails", async () => {
    mocks.refundsCreate.mockRejectedValue({ type: "StripeAPIError", code: "charge_already_refunded" });
    const res = await POST(postRequest({ confirmPassword: "pw", mfaCode: "123456", expectedAmount: 1499 }), params);
    expect(res.status).toBe(502);
    const serialized = JSON.stringify(mocks.auditCreate.mock.calls);
    expect(serialized).toContain("provider_refund_failed");
    expect(serialized).not.toContain("SUBSCRIPTION_REFUND_COMPLETED");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rawUserFindUnique: vi.fn(),
  rawTransaction: vi.fn(),
  getAdminRuntimeConfigValue: vi.fn(),
  stripeCancel: vi.fn(),
  reconcileWorkspaceSeats: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  rawPrisma: {
    user: { findUnique: (...args: unknown[]) => mocks.rawUserFindUnique(...args) },
    $transaction: (...args: unknown[]) => mocks.rawTransaction(...args),
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValue: (...args: unknown[]) => mocks.getAdminRuntimeConfigValue(...args),
}));

vi.mock("@/lib/workspace-seats", () => ({
  reconcileWorkspaceSeats: (...args: unknown[]) => mocks.reconcileWorkspaceSeats(...args),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function Stripe() {
    return { subscriptions: { cancel: (...args: unknown[]) => mocks.stripeCancel(...args) } };
  }),
}));

import { hardDeleteUser } from "./hard-delete-user";

function makeTx(order: string[]) {
  return {
    userLoginSession: { updateMany: vi.fn() },
    userSession: { updateMany: vi.fn() },
    workspace: { findMany: vi.fn(() => []), delete: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    workspaceMember: { findFirst: vi.fn(), update: vi.fn() },
    movingPlan: { deleteMany: vi.fn() },
    gDPRRequest: { deleteMany: vi.fn(() => ({ count: 1 })) },
    waitlistSignup: { deleteMany: vi.fn() },
    notificationQueue: { deleteMany: vi.fn() },
    emailLog: { deleteMany: vi.fn() },
    user: { delete: vi.fn(() => order.push("db.delete")) },
  };
}

describe("hardDeleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unused");
    mocks.rawUserFindUnique.mockResolvedValue({
      id: "user_1",
      email: "target@example.com",
      subscription: { stripeSubscriptionId: "sub_live_1" },
    });
    mocks.getAdminRuntimeConfigValue.mockResolvedValue("sk_test_valid_secret_key_123456789");
    mocks.stripeCancel.mockResolvedValue({});
    mocks.reconcileWorkspaceSeats.mockResolvedValue(undefined);
  });

  it("cancels Stripe only after the DB erasure transaction commits", async () => {
    const order: string[] = [];
    mocks.rawTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn(makeTx(order));
      order.push("db.commit");
    });
    mocks.stripeCancel.mockImplementation(async () => {
      order.push("stripe.cancel");
      return {};
    });

    const result = await hardDeleteUser("user_1");

    expect(result.stripeCanceled).toBe(true);
    expect(order).toEqual(["db.delete", "db.commit", "stripe.cancel"]);
  });

  it("does not cancel Stripe when the DB erasure transaction fails", async () => {
    mocks.rawTransaction.mockRejectedValueOnce(new Error("db failed"));

    await expect(hardDeleteUser("user_1")).rejects.toThrow("db failed");
    expect(mocks.stripeCancel).not.toHaveBeenCalled();
  });
});

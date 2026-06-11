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

  it("cancels Stripe BEFORE the DB erasure transaction commits", async () => {
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

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.stripeCanceled).toBe(true);
    }
    // Stripe must be canceled before anything irreversible happens in the DB.
    expect(order).toEqual(["stripe.cancel", "db.delete", "db.commit"]);
  });

  it("BLOCKS the delete (no DB write) when a live subscription cannot be canceled", async () => {
    mocks.stripeCancel.mockRejectedValueOnce(new Error("stripe boom"));

    const result = await hardDeleteUser("user_1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.blocked).toBe(true);
      expect(result.code).toBe("STRIPE_CANCEL_FAILED");
      expect(result.stripeSubscriptionId).toBe("sub_live_1");
      expect(result.maskedEmail).toBe("t***@e***.com");
    }
    // The irreversible DB transaction must NOT have run.
    expect(mocks.rawTransaction).not.toHaveBeenCalled();
  });

  it("treats a missing/invalid Stripe key as a cancel failure and blocks (fail-closed)", async () => {
    // Empty key makes requireStripeSecretKey throw inside tryCancel → false.
    mocks.getAdminRuntimeConfigValue.mockResolvedValue("");

    const result = await hardDeleteUser("user_1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("STRIPE_CANCEL_FAILED");
    }
    expect(mocks.stripeCancel).not.toHaveBeenCalled();
    expect(mocks.rawTransaction).not.toHaveBeenCalled();
  });

  it("force=true proceeds with erasure even when the Stripe cancel fails", async () => {
    mocks.stripeCancel.mockRejectedValueOnce(new Error("stripe boom"));
    const order: string[] = [];
    mocks.rawTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn(makeTx(order));
      order.push("db.commit");
    });

    const result = await hardDeleteUser("user_1", { force: true });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.stripeCanceled).toBe(false);
    }
    expect(order).toEqual(["db.delete", "db.commit"]);
  });

  it("succeeds then deletes when Stripe cancel succeeds", async () => {
    const order: string[] = [];
    mocks.rawTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn(makeTx(order));
      order.push("db.commit");
    });

    const result = await hardDeleteUser("user_1");

    expect(mocks.stripeCancel).toHaveBeenCalledWith("sub_live_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.stripeCanceled).toBe(true);
    }
    expect(order).toContain("db.delete");
  });

  it("deletes cleanly for a user with NO subscription (Stripe untouched)", async () => {
    mocks.rawUserFindUnique.mockResolvedValue({
      id: "user_2",
      email: "nosub@example.com",
      subscription: null,
    });
    const order: string[] = [];
    mocks.rawTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn(makeTx(order));
      order.push("db.commit");
    });

    const result = await hardDeleteUser("user_2");

    expect(mocks.stripeCancel).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.stripeCanceled).toBe(true);
    }
    expect(order).toEqual(["db.delete", "db.commit"]);
  });

  it("does not cancel Stripe again or commit when the DB erasure transaction fails", async () => {
    // Stripe cancel succeeds first, then the DB transaction blows up. The
    // already-canceled subscription is acceptable (the intent was to delete),
    // and crucially the error propagates so the caller surfaces a failure.
    mocks.rawTransaction.mockRejectedValueOnce(new Error("db failed"));

    await expect(hardDeleteUser("user_1")).rejects.toThrow("db failed");
    expect(mocks.stripeCancel).toHaveBeenCalledTimes(1);
  });

  it("throws USER_NOT_FOUND when the user does not exist", async () => {
    mocks.rawUserFindUnique.mockResolvedValue(null);
    await expect(hardDeleteUser("missing")).rejects.toThrow("USER_NOT_FOUND");
    expect(mocks.stripeCancel).not.toHaveBeenCalled();
    expect(mocks.rawTransaction).not.toHaveBeenCalled();
  });
});

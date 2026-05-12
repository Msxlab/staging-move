import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gdprFindUnique: vi.fn(),
  gdprFindMany: vi.fn(),
  gdprCreate: vi.fn(),
  gdprUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  rawUserDelete: vi.fn(),
  destroyAllUserSessions: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  stripeCancel: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: function StripeMock() {
    return {
    subscriptions: {
      cancel: (...args: unknown[]) => mocks.stripeCancel(...args),
    },
    };
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    gDPRRequest: {
      findUnique: (...args: unknown[]) => mocks.gdprFindUnique(...args),
      findMany: (...args: unknown[]) => mocks.gdprFindMany(...args),
      create: (...args: unknown[]) => mocks.gdprCreate(...args),
      update: (...args: unknown[]) => mocks.gdprUpdate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
    },
  },
  rawPrisma: {
    user: {
      delete: (...args: unknown[]) => mocks.rawUserDelete(...args),
    },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

vi.mock("@/lib/user-auth", () => ({
  destroyAllUserSessions: (...args: unknown[]) => mocks.destroyAllUserSessions(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mocks.loggerError(...args),
  },
}));

import { processAccountDeletionRequest } from "./account-deletion";

function deletionRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "gdpr-1",
    type: "DELETE",
    status: "PENDING",
    userId: "user-1",
    requestData: JSON.stringify({
      source: "self_service",
      email: "user@example.com",
      stripeSubscriptionId: "sub_live_123",
      cleanup: {
        stripeCanceled: false,
        userDeleted: false,
        attempts: 0,
        lastAttemptAt: null,
        lastError: null,
      },
    }),
    ...overrides,
  };
}

describe("account deletion processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_ENV = "test";
    mocks.gdprFindUnique.mockResolvedValue(deletionRequest());
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      subscription: { stripeSubscriptionId: "sub_live_123" },
    });
    mocks.getRuntimeConfigValue.mockResolvedValue("sk_test_account_deletion");
    mocks.stripeCancel.mockResolvedValue({ id: "sub_live_123" });
    mocks.destroyAllUserSessions.mockResolvedValue(undefined);
    mocks.rawUserDelete.mockResolvedValue({ id: "user-1" });
    mocks.gdprUpdate.mockResolvedValue({});
  });

  it("cancels Stripe before hard-deleting the user", async () => {
    const result = await processAccountDeletionRequest("gdpr-1");

    expect(mocks.getRuntimeConfigValue).toHaveBeenCalledWith("STRIPE_SECRET_KEY");
    expect(mocks.stripeCancel).toHaveBeenCalledWith("sub_live_123");
    expect(mocks.destroyAllUserSessions).toHaveBeenCalledWith("user-1");
    expect(mocks.rawUserDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(result.status).toBe("COMPLETED");
    expect(result.cleanup?.stripeCanceled).toBe(true);
    expect(result.cleanup?.userDeleted).toBe(true);
  });

  it("does not hard-delete the user when Stripe cancellation fails", async () => {
    mocks.stripeCancel.mockRejectedValue(new Error("stripe unavailable"));

    const result = await processAccountDeletionRequest("gdpr-1");

    expect(mocks.destroyAllUserSessions).not.toHaveBeenCalled();
    expect(mocks.rawUserDelete).not.toHaveBeenCalled();
    expect(result.status).toBe("PROCESSING");
    expect(result.cleanup?.stripeCanceled).toBe(false);
    expect(result.cleanup?.userDeleted).toBe(false);
    expect(result.cleanup?.lastError).toBe("stripe unavailable");
  });

  it("logs Stripe cancellation failures without leaking the Stripe secret", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue("sk_test_should_not_appear");
    mocks.stripeCancel.mockRejectedValue(new Error("card processor down"));

    await processAccountDeletionRequest("gdpr-1");

    expect(mocks.loggerError).toHaveBeenCalledWith(
      "account_deletion_stripe_cancel_failed",
      expect.objectContaining({
        requestId: "gdpr-1",
        userId: "user-1",
        stripeSubscriptionId: "sub_live_123",
      }),
    );
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain("sk_test_should_not_appear");
  });
});

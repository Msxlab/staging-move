import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gdprFindUnique: vi.fn(),
  gdprFindMany: vi.fn(),
  gdprCreate: vi.fn(),
  gdprUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  rawMovingPlanDeleteMany: vi.fn(),
  rawUserUpdate: vi.fn(),
  rawUserDelete: vi.fn(),
  rawWaitlistDeleteMany: vi.fn(),
  rawNotificationQueueDeleteMany: vi.fn(),
  rawEmailLogDeleteMany: vi.fn(),
  rawLeadDeleteMany: vi.fn(),
  rawWorkspaceFindMany: vi.fn(),
  rawWorkspaceDelete: vi.fn(),
  workspaceMemberFindFirst: vi.fn(),
  destroyAllUserSessions: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  stripeCancel: vi.fn(),
  stripeUpdate: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: function StripeMock() {
    return {
    subscriptions: {
      cancel: (...args: unknown[]) => mocks.stripeCancel(...args),
      update: (...args: unknown[]) => mocks.stripeUpdate(...args),
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
    workspaceMember: {
      findFirst: (...args: unknown[]) => mocks.workspaceMemberFindFirst(...args),
    },
  },
  rawPrisma: {
    movingPlan: {
      deleteMany: (...args: unknown[]) => mocks.rawMovingPlanDeleteMany(...args),
    },
    user: {
      // processAccountDeletionRequest now looks the user up via rawPrisma so a
      // grace-soft-deleted user is still found at purge time.
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
      update: (...args: unknown[]) => mocks.rawUserUpdate(...args),
      delete: (...args: unknown[]) => mocks.rawUserDelete(...args),
    },
    workspace: {
      findMany: (...args: unknown[]) => mocks.rawWorkspaceFindMany(...args),
      delete: (...args: unknown[]) => mocks.rawWorkspaceDelete(...args),
    },
    // No-FK residue tables purged after the user delete (keyed by userId/email).
    waitlistSignup: {
      deleteMany: (...args: unknown[]) => mocks.rawWaitlistDeleteMany(...args),
    },
    notificationQueue: {
      deleteMany: (...args: unknown[]) => mocks.rawNotificationQueueDeleteMany(...args),
    },
    emailLog: {
      deleteMany: (...args: unknown[]) => mocks.rawEmailLogDeleteMany(...args),
    },
    // Lead has no FK to User; purged explicitly before the user delete
    // (LeadDispatch cascades from Lead) so no encrypted PII survives erasure.
    lead: {
      deleteMany: (...args: unknown[]) => mocks.rawLeadDeleteMany(...args),
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

import {
  processAccountDeletionRequest,
  scheduleAccountDeletionWithGrace,
  restoreAccountFromDeletion,
  signAccountRestoreToken,
} from "./account-deletion";

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
    mocks.stripeUpdate.mockResolvedValue({ id: "sub_live_123" });
    mocks.destroyAllUserSessions.mockResolvedValue(undefined);
    mocks.rawMovingPlanDeleteMany.mockResolvedValue({ count: 1 });
    mocks.rawWaitlistDeleteMany.mockResolvedValue({ count: 0 });
    mocks.rawNotificationQueueDeleteMany.mockResolvedValue({ count: 0 });
    mocks.rawEmailLogDeleteMany.mockResolvedValue({ count: 0 });
    mocks.rawLeadDeleteMany.mockResolvedValue({ count: 0 });
    mocks.rawUserUpdate.mockResolvedValue({ id: "user-1" });
    mocks.rawUserDelete.mockResolvedValue({ id: "user-1" });
    // Restore tokens are signed with USER_JWT_SECRET when no dedicated secret.
    process.env.USER_JWT_SECRET = "test-user-jwt-secret-at-least-32-chars-long";
    mocks.rawWorkspaceFindMany.mockResolvedValue([]);
    mocks.rawWorkspaceDelete.mockResolvedValue({ id: "ws-1" });
    mocks.workspaceMemberFindFirst.mockResolvedValue(null);
    mocks.gdprUpdate.mockResolvedValue({});
  });

  it("cancels Stripe and clears moving plans before hard-deleting the user", async () => {
    const result = await processAccountDeletionRequest("gdpr-1");

    expect(mocks.getRuntimeConfigValue).toHaveBeenCalledWith("STRIPE_SECRET_KEY");
    expect(mocks.stripeCancel).toHaveBeenCalledWith("sub_live_123");
    expect(mocks.destroyAllUserSessions).toHaveBeenCalledWith("user-1");
    expect(mocks.rawMovingPlanDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    // GDPR Art.17: the plaintext recipient email must be purged from EmailLog too.
    expect(mocks.rawEmailLogDeleteMany).toHaveBeenCalledWith({ where: { to: "user@example.com" } });
    // GDPR Art.17: Lead has no FK to User, so its encrypted PII must be purged
    // explicitly (LeadDispatch cascades from Lead) before the user delete.
    expect(mocks.rawLeadDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mocks.rawUserDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(result.status).toBe("COMPLETED");
    expect(result.cleanup?.stripeCanceled).toBe(true);
    expect(result.cleanup?.userDeleted).toBe(true);
  });

  it("clears an owned solo workspace before deleting the user (FK would otherwise block)", async () => {
    mocks.rawWorkspaceFindMany.mockResolvedValue([{ id: "ws-solo" }]);
    mocks.workspaceMemberFindFirst.mockResolvedValue(null); // no heir → hard delete

    const result = await processAccountDeletionRequest("gdpr-1");

    expect(mocks.rawWorkspaceDelete).toHaveBeenCalledWith({ where: { id: "ws-solo" } });
    expect(mocks.rawUserDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(result.status).toBe("COMPLETED");
  });

  it("does not hard-delete the user when Stripe cancellation fails", async () => {
    mocks.stripeCancel.mockRejectedValue(new Error("stripe unavailable"));

    const result = await processAccountDeletionRequest("gdpr-1");

    expect(mocks.destroyAllUserSessions).not.toHaveBeenCalled();
    expect(mocks.rawMovingPlanDeleteMany).not.toHaveBeenCalled();
    expect(mocks.rawUserDelete).not.toHaveBeenCalled();
    expect(result.status).toBe("PROCESSING");
    expect(result.cleanup?.stripeCanceled).toBe(false);
    expect(result.cleanup?.userDeleted).toBe(false);
    expect(result.cleanup?.lastError).toBe("stripe unavailable");
  });

  it("treats an already-canceled Stripe subscription as success and completes the erasure", async () => {
    // A previously-canceled sub (the common case: the grace flow set
    // cancel_at_period_end) makes a second cancel() throw resource_missing —
    // this must NOT wedge the GDPR erasure.
    const err = new Error("No such subscription: 'sub_live_123'") as Error & { code?: string };
    err.code = "resource_missing";
    mocks.stripeCancel.mockRejectedValue(err);

    const result = await processAccountDeletionRequest("gdpr-1");

    expect(mocks.rawUserDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(result.status).toBe("COMPLETED");
    expect(result.cleanup?.stripeCanceled).toBe(true);
    expect(result.cleanup?.userDeleted).toBe(true);
  });

  it("force-completes the erasure after the max Stripe attempts even if cancel keeps failing", async () => {
    // attempts already at MAX-1 so this run is the final attempt → erasure must
    // proceed regardless of Stripe, and ops is alerted to cancel manually. GDPR
    // Art. 17 erasure is never blocked indefinitely by a failing billing call.
    mocks.gdprFindUnique.mockResolvedValue(
      deletionRequest({
        requestData: JSON.stringify({
          source: "self_service",
          email: "user@example.com",
          stripeSubscriptionId: "sub_live_123",
          cleanup: { stripeCanceled: false, userDeleted: false, attempts: 4, lastAttemptAt: null, lastError: null },
        }),
      }),
    );
    mocks.stripeCancel.mockRejectedValue(new Error("stripe down"));

    const result = await processAccountDeletionRequest("gdpr-1");

    expect(mocks.rawUserDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(result.status).toBe("COMPLETED");
    expect(result.cleanup?.userDeleted).toBe(true);
    expect(result.cleanup?.stripeCanceled).toBe(false);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "account_deletion_forcing_erasure_stripe_unresolved",
      expect.objectContaining({ requestId: "gdpr-1", userId: "user-1", attempts: 5 }),
    );
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

  it("defers the purge while a grace window is still open (no erasure yet)", async () => {
    mocks.gdprFindUnique.mockResolvedValue(
      deletionRequest({
        requestData: JSON.stringify({
          source: "self_service",
          stripeSubscriptionId: "sub_live_123",
          scheduledPurgeAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          cleanup: {},
        }),
      }),
    );

    const result = await processAccountDeletionRequest("gdpr-1");

    expect(result.status).toBe("SCHEDULED");
    expect(mocks.rawUserDelete).not.toHaveBeenCalled();
    expect(mocks.rawMovingPlanDeleteMany).not.toHaveBeenCalled();
    expect(mocks.stripeCancel).not.toHaveBeenCalled();
  });

  it("schedules a grace deletion: pauses renewal, soft-deletes, kills sessions", async () => {
    const result = await scheduleAccountDeletionWithGrace("gdpr-1", 14);

    expect(mocks.stripeUpdate).toHaveBeenCalledWith("sub_live_123", { cancel_at_period_end: true });
    expect(mocks.rawUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
    expect(mocks.destroyAllUserSessions).toHaveBeenCalledWith("user-1");
    expect(mocks.rawUserDelete).not.toHaveBeenCalled(); // NOT physically purged yet
    expect(result.status).toBe("SCHEDULED");
  });

  it("restores a grace-deleted account from a valid token (un-soft-delete + resume + cancel request)", async () => {
    const token = signAccountRestoreToken("user-1", "gdpr-1")!;
    mocks.gdprFindUnique.mockResolvedValue(
      deletionRequest({
        status: "PENDING",
        requestData: JSON.stringify({
          source: "self_service",
          stripeSubscriptionId: "sub_live_123",
          scheduledPurgeAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          cleanup: {},
        }),
      }),
    );

    const result = await restoreAccountFromDeletion(token);

    expect(result.ok).toBe(true);
    expect(mocks.rawUserUpdate).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { deletedAt: null } });
    expect(mocks.stripeUpdate).toHaveBeenCalledWith("sub_live_123", { cancel_at_period_end: false });
    expect(mocks.gdprUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) }),
    );
  });

  it("rejects a forged or wrong-request restore token", async () => {
    const result = await restoreAccountFromDeletion("user-1.gdpr-1.not-a-valid-signature");
    expect(result.ok).toBe(false);
    expect(mocks.rawUserUpdate).not.toHaveBeenCalled();
  });
});

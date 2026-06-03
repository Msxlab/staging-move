import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  txWorkspaceFindMany: vi.fn(),
  txWorkspaceMemberFindFirst: vi.fn(),
  txWorkspaceAuthChallengeDeleteMany: vi.fn(),
  txNotificationQueueDeleteMany: vi.fn(),
  txAuditLogDeleteMany: vi.fn(),
  txGdprRequestDeleteMany: vi.fn(),
  txWaitlistSignupDeleteMany: vi.fn(),
  txEmailLogDeleteMany: vi.fn(),
  txMovingPlanDeleteMany: vi.fn(),
  txWorkspaceDeleteMany: vi.fn(),
  txUserDelete: vi.fn(),
}));

const tx = {
  workspace: {
    findMany: (...args: unknown[]) => mocks.txWorkspaceFindMany(...args),
    deleteMany: (...args: unknown[]) => mocks.txWorkspaceDeleteMany(...args),
  },
  workspaceMember: {
    findFirst: (...args: unknown[]) => mocks.txWorkspaceMemberFindFirst(...args),
  },
  workspaceAuthChallenge: {
    deleteMany: (...args: unknown[]) => mocks.txWorkspaceAuthChallengeDeleteMany(...args),
  },
  notificationQueue: {
    deleteMany: (...args: unknown[]) => mocks.txNotificationQueueDeleteMany(...args),
  },
  auditLog: {
    deleteMany: (...args: unknown[]) => mocks.txAuditLogDeleteMany(...args),
  },
  gDPRRequest: {
    deleteMany: (...args: unknown[]) => mocks.txGdprRequestDeleteMany(...args),
  },
  waitlistSignup: {
    deleteMany: (...args: unknown[]) => mocks.txWaitlistSignupDeleteMany(...args),
  },
  emailLog: {
    deleteMany: (...args: unknown[]) => mocks.txEmailLogDeleteMany(...args),
  },
  movingPlan: {
    deleteMany: (...args: unknown[]) => mocks.txMovingPlanDeleteMany(...args),
  },
  user: {
    delete: (...args: unknown[]) => mocks.txUserDelete(...args),
  },
};

vi.mock("@/lib/db", () => ({
  rawPrisma: {
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));

import {
  getQaResettableAccountEmail,
  isAllowlistedQaEmail,
  resetAllowlistedQaAccountForSignup,
  resetAllowlistedQaAccountOnLogout,
} from "./qa-account";

describe("QA resettable account guard", () => {
  const OLD_QA_RESETTABLE_EMAIL = process.env.QA_RESETTABLE_ACCOUNT_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QA_RESETTABLE_ACCOUNT_EMAIL;
    mocks.userFindUnique.mockResolvedValue({ id: "qa-user", email: "qa@example.com" });
    mocks.txWorkspaceFindMany.mockResolvedValue([]);
    mocks.txWorkspaceMemberFindFirst.mockResolvedValue(null);
    mocks.txWorkspaceAuthChallengeDeleteMany.mockResolvedValue({ count: 0 });
    mocks.txNotificationQueueDeleteMany.mockResolvedValue({ count: 0 });
    mocks.txAuditLogDeleteMany.mockResolvedValue({ count: 0 });
    mocks.txGdprRequestDeleteMany.mockResolvedValue({ count: 0 });
    mocks.txWaitlistSignupDeleteMany.mockResolvedValue({ count: 0 });
    mocks.txEmailLogDeleteMany.mockResolvedValue({ count: 0 });
    mocks.txMovingPlanDeleteMany.mockResolvedValue({ count: 0 });
    mocks.txWorkspaceDeleteMany.mockResolvedValue({ count: 0 });
    mocks.txUserDelete.mockResolvedValue({ id: "qa-user" });
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );
  });

  afterEach(() => {
    if (OLD_QA_RESETTABLE_EMAIL === undefined) delete process.env.QA_RESETTABLE_ACCOUNT_EMAIL;
    else process.env.QA_RESETTABLE_ACCOUNT_EMAIL = OLD_QA_RESETTABLE_EMAIL;
  });

  it("normalizes one exact deployment email and rejects multi-email config", () => {
    expect(getQaResettableAccountEmail({ QA_RESETTABLE_ACCOUNT_EMAIL: " QA@Example.com " })).toBe(
      "qa@example.com",
    );
    expect(getQaResettableAccountEmail({ QA_RESETTABLE_ACCOUNT_EMAIL: "qa@example.com,other@example.com" })).toBeNull();
    expect(getQaResettableAccountEmail({ QA_RESETTABLE_ACCOUNT_EMAIL: "QA <qa@example.com>" })).toBeNull();
  });

  it("matches only the allowlisted QA email", () => {
    const env = { QA_RESETTABLE_ACCOUNT_EMAIL: "qa@example.com" };

    expect(isAllowlistedQaEmail("QA@Example.com", env)).toBe(true);
    expect(isAllowlistedQaEmail("user@example.com", env)).toBe(false);
  });

  it("does nothing when config is disabled", async () => {
    await expect(
      resetAllowlistedQaAccountOnLogout({ userId: "qa-user", sessionEmail: "qa@example.com" }),
    ).resolves.toEqual({ reset: false, reason: "config_disabled" });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not reset when the session email is not the exact QA account", async () => {
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";

    await expect(
      resetAllowlistedQaAccountOnLogout({ userId: "user-1", sessionEmail: "user@example.com" }),
    ).resolves.toEqual({ reset: false, reason: "session_not_allowlisted" });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not reset on signup when the email is not the exact QA account", async () => {
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";

    await expect(
      resetAllowlistedQaAccountForSignup({ email: "user@example.com" }),
    ).resolves.toEqual({ reset: false, reason: "email_not_allowlisted" });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not reset when the database user email does not match the allowlisted account", async () => {
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";
    mocks.userFindUnique.mockResolvedValue({ id: "qa-user", email: "other@example.com" });

    await expect(
      resetAllowlistedQaAccountOnLogout({ userId: "qa-user", sessionEmail: "qa@example.com" }),
    ).resolves.toEqual({ reset: false, reason: "user_not_allowlisted" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("hard-resets the exact QA account and its non-cascading traces", async () => {
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";
    mocks.txWorkspaceFindMany.mockResolvedValue([{ id: "ws-1" }]);

    await expect(
      resetAllowlistedQaAccountOnLogout({ userId: "qa-user", sessionEmail: "QA@Example.com" }),
    ).resolves.toEqual({ reset: true });

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "qa-user" },
      select: { id: true, email: true },
    });
    expect(mocks.txWorkspaceMemberFindFirst).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", userId: { not: "qa-user" } },
      select: { id: true },
    });
    expect(mocks.txWorkspaceAuthChallengeDeleteMany).toHaveBeenCalledWith({ where: { userId: "qa-user" } });
    expect(mocks.txNotificationQueueDeleteMany).toHaveBeenCalledWith({ where: { userId: "qa-user" } });
    expect(mocks.txAuditLogDeleteMany).toHaveBeenCalledWith({ where: { userId: "qa-user" } });
    expect(mocks.txGdprRequestDeleteMany).toHaveBeenCalledWith({ where: { userId: "qa-user" } });
    expect(mocks.txWaitlistSignupDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "qa-user" },
          { email: "qa@example.com" },
        ],
      },
    });
    expect(mocks.txEmailLogDeleteMany).toHaveBeenCalledWith({ where: { to: "qa@example.com" } });
    expect(mocks.txMovingPlanDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "qa-user" },
          { workspaceId: { in: ["ws-1"] } },
        ],
      },
    });
    expect(mocks.txWorkspaceDeleteMany).toHaveBeenCalledWith({
      where: {
        ownerUserId: "qa-user",
        id: { in: ["ws-1"] },
      },
    });
    expect(mocks.txUserDelete).toHaveBeenCalledWith({ where: { id: "qa-user" } });
  });

  it("hard-resets an existing exact QA account during signup", async () => {
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";
    mocks.txWorkspaceFindMany.mockResolvedValue([{ id: "ws-1" }]);

    await expect(
      resetAllowlistedQaAccountForSignup({ email: "QA@Example.com" }),
    ).resolves.toEqual({ reset: true });

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { email: "qa@example.com" },
      select: { id: true, email: true },
    });
    expect(mocks.txMovingPlanDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "qa-user" },
          { workspaceId: { in: ["ws-1"] } },
        ],
      },
    });
    expect(mocks.txUserDelete).toHaveBeenCalledWith({ where: { id: "qa-user" } });
  });

  it("blocks reset instead of affecting another member in an owned workspace", async () => {
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";
    mocks.txWorkspaceFindMany.mockResolvedValue([{ id: "ws-shared" }]);
    mocks.txWorkspaceMemberFindFirst.mockResolvedValue({ id: "member-2" });

    await expect(
      resetAllowlistedQaAccountOnLogout({ userId: "qa-user", sessionEmail: "qa@example.com" }),
    ).resolves.toEqual({ reset: false, reason: "owned_workspace_has_other_members" });
    expect(mocks.txMovingPlanDeleteMany).not.toHaveBeenCalled();
    expect(mocks.txWorkspaceDeleteMany).not.toHaveBeenCalled();
    expect(mocks.txUserDelete).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  subscriptionUpsert: vi.fn(),
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
    subscription: {
      upsert: (...args: unknown[]) => mocks.subscriptionUpsert(...args),
    },
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));

import {
  applyQaPersonaSubscriptionForUser,
  getQaPersonaAccounts,
  getQaPersonaAccountForEmail,
  getQaResettableAccountEmail,
  getQaResettableAccountEmails,
  getStoreReviewAccountEmails,
  isAutoVerifiedTestEmail,
  isAllowlistedQaEmail,
  isStoreReviewAccountEmail,
  resetAllowlistedQaAccountForSignup,
  resetAllowlistedQaAccountOnLogout,
} from "./qa-account";

describe("QA resettable account guard", () => {
  const OLD_QA_RESETTABLE_EMAIL = process.env.QA_RESETTABLE_ACCOUNT_EMAIL;
  const OLD_QA_PERSONA_ACCOUNTS = process.env.QA_PERSONA_ACCOUNTS;
  const OLD_STORE_REVIEW_EMAILS = process.env.STORE_REVIEW_ACCOUNT_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QA_RESETTABLE_ACCOUNT_EMAIL;
    delete process.env.QA_PERSONA_ACCOUNTS;
    delete process.env.STORE_REVIEW_ACCOUNT_EMAILS;
    mocks.subscriptionUpsert.mockResolvedValue({ id: "sub-1" });
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
    if (OLD_QA_PERSONA_ACCOUNTS === undefined) delete process.env.QA_PERSONA_ACCOUNTS;
    else process.env.QA_PERSONA_ACCOUNTS = OLD_QA_PERSONA_ACCOUNTS;
    if (OLD_STORE_REVIEW_EMAILS === undefined) delete process.env.STORE_REVIEW_ACCOUNT_EMAILS;
    else process.env.STORE_REVIEW_ACCOUNT_EMAILS = OLD_STORE_REVIEW_EMAILS;
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

  it("normalizes exact QA persona accounts and keeps the legacy reset account as free", () => {
    const env = {
      QA_RESETTABLE_ACCOUNT_EMAIL: "Mobile.QA@LocateFlow.com",
      QA_PERSONA_ACCOUNTS: [
        "MobileIndividual@LocateFlow.com:individual",
        "mobilefamily@locateflow.com:FAMILY",
        "mobilepro@locateflow.com:PRO",
      ].join(","),
    };

    expect(getQaPersonaAccounts(env)).toEqual([
      { email: "mobile.qa@locateflow.com", plan: "FREE_TRIAL" },
      { email: "mobileindividual@locateflow.com", plan: "INDIVIDUAL" },
      { email: "mobilefamily@locateflow.com", plan: "FAMILY" },
      { email: "mobilepro@locateflow.com", plan: "PRO" },
    ]);
    expect(getQaResettableAccountEmails(env)).toEqual([
      "mobile.qa@locateflow.com",
      "mobileindividual@locateflow.com",
      "mobilefamily@locateflow.com",
      "mobilepro@locateflow.com",
    ]);
    expect(getQaPersonaAccountForEmail("MOBILEFAMILY@locateflow.com", env)).toEqual({
      email: "mobilefamily@locateflow.com",
      plan: "FAMILY",
    });
  });

  it("rejects malformed QA persona account config", () => {
    expect(
      getQaPersonaAccounts({
        QA_PERSONA_ACCOUNTS: "mobileindividual@locateflow.com:INDIVIDUAL,broken",
      }),
    ).toEqual([]);
    expect(
      getQaPersonaAccounts({
        QA_PERSONA_ACCOUNTS: "mobileindividual@locateflow.com:ENTERPRISE",
      }),
    ).toEqual([]);
  });

  it("normalizes store review emails from a deployment allowlist", () => {
    expect(
      getStoreReviewAccountEmails({
        STORE_REVIEW_ACCOUNT_EMAILS: " GoogleReview@LocateFlow.com, apple-review@locateflow.com ",
      }),
    ).toEqual(["googlereview@locateflow.com", "apple-review@locateflow.com"]);
    expect(
      getStoreReviewAccountEmails({
        STORE_REVIEW_ACCOUNT_EMAILS: "google <googlereview@locateflow.com>",
      }),
    ).toEqual([]);
  });

  it("also treats configured store-purchase tester emails as review-ready accounts", () => {
    expect(
      getStoreReviewAccountEmails({
        GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS: "googlereview@locateflow.com",
        APPLE_SANDBOX_PURCHASE_USER_EMAILS: "apple-review@locateflow.com",
      }),
    ).toEqual(["googlereview@locateflow.com", "apple-review@locateflow.com"]);
  });

  it("auto-verifies both QA and store review accounts without mixing the lists", () => {
    const env = {
      QA_RESETTABLE_ACCOUNT_EMAIL: "qa@example.com",
      STORE_REVIEW_ACCOUNT_EMAILS: "googlereview@locateflow.com",
    };

    expect(isAutoVerifiedTestEmail("QA@Example.com", env)).toBe(true);
    expect(isStoreReviewAccountEmail("GoogleReview@LocateFlow.com", env)).toBe(true);
    expect(isAutoVerifiedTestEmail("user@example.com", env)).toBe(false);
  });

  it("auto-verifies persona QA accounts without making them store-review accounts", () => {
    const env = {
      QA_PERSONA_ACCOUNTS: "mobileindividual@locateflow.com:INDIVIDUAL",
    };

    expect(isAllowlistedQaEmail("MobileIndividual@LocateFlow.com", env)).toBe(true);
    expect(isAutoVerifiedTestEmail("MobileIndividual@LocateFlow.com", env)).toBe(true);
    expect(isStoreReviewAccountEmail("MobileIndividual@LocateFlow.com", env)).toBe(false);
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

  it("hard-resets an existing store review account during signup only", async () => {
    process.env.STORE_REVIEW_ACCOUNT_EMAILS = "googlereview@locateflow.com";
    mocks.userFindUnique.mockResolvedValue({
      id: "review-user",
      email: "googlereview@locateflow.com",
    });

    await expect(
      resetAllowlistedQaAccountForSignup({ email: "GoogleReview@LocateFlow.com" }),
    ).resolves.toEqual({ reset: true });

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { email: "googlereview@locateflow.com" },
      select: { id: true, email: true },
    });
    expect(mocks.txUserDelete).toHaveBeenCalledWith({ where: { id: "review-user" } });

    await expect(
      resetAllowlistedQaAccountOnLogout({
        userId: "review-user",
        sessionEmail: "googlereview@locateflow.com",
      }),
    ).resolves.toEqual({ reset: false, reason: "config_disabled" });
  });

  it("hard-resets an exact persona QA account on logout", async () => {
    process.env.QA_PERSONA_ACCOUNTS = "mobileindividual@locateflow.com:INDIVIDUAL";
    mocks.userFindUnique.mockResolvedValue({
      id: "qa-individual",
      email: "mobileindividual@locateflow.com",
    });

    await expect(
      resetAllowlistedQaAccountOnLogout({
        userId: "qa-individual",
        sessionEmail: "MobileIndividual@LocateFlow.com",
      }),
    ).resolves.toEqual({ reset: true });

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "qa-individual" },
      select: { id: true, email: true },
    });
    expect(mocks.txUserDelete).toHaveBeenCalledWith({ where: { id: "qa-individual" } });
  });

  it("applies a free QA persona subscription grant without touching billing providers", async () => {
    process.env.QA_PERSONA_ACCOUNTS = "mobile.qa@locateflow.com:FREE_TRIAL";
    const now = new Date("2026-06-14T12:00:00.000Z");

    await expect(
      applyQaPersonaSubscriptionForUser({
        userId: "qa-user",
        email: "mobile.qa@locateflow.com",
        now,
      }),
    ).resolves.toEqual({
      applied: true,
      email: "mobile.qa@locateflow.com",
      plan: "FREE_TRIAL",
    });

    expect(mocks.subscriptionUpsert).toHaveBeenCalledWith({
      where: { userId: "qa-user" },
      update: expect.objectContaining({
        plan: "FREE_TRIAL",
        status: "FREE_ACCESS",
        provider: "TRIAL",
        accessType: "FREE_ACCESS",
        freeAccessEndsAt: new Date("2026-06-28T12:00:00.000Z"),
        premiumGrantedBy: null,
      }),
      create: expect.objectContaining({
        userId: "qa-user",
        plan: "FREE_TRIAL",
        status: "FREE_ACCESS",
        provider: "TRIAL",
        accessType: "FREE_ACCESS",
      }),
    });
  });

  it("applies a paid QA persona as an admin premium grant with no billing token", async () => {
    process.env.QA_PERSONA_ACCOUNTS = "mobilepro@locateflow.com:PRO";
    const now = new Date("2026-06-14T12:00:00.000Z");

    await expect(
      applyQaPersonaSubscriptionForUser({
        userId: "qa-pro",
        email: "mobilepro@locateflow.com",
        now,
      }),
    ).resolves.toEqual({
      applied: true,
      email: "mobilepro@locateflow.com",
      plan: "PRO",
    });

    expect(mocks.subscriptionUpsert).toHaveBeenCalledWith({
      where: { userId: "qa-pro" },
      update: expect.objectContaining({
        plan: "PRO",
        status: "ACTIVE",
        provider: "ADMIN",
        platform: null,
        accessType: "PAID",
        premiumUntil: new Date("2036-06-14T12:00:00.000Z"),
        premiumGrantedBy: "QA_PERSONA",
      }),
      create: expect.objectContaining({
        userId: "qa-pro",
        plan: "PRO",
        status: "ACTIVE",
        provider: "ADMIN",
        platform: null,
        accessType: "PAID",
        premiumGrantedBy: "QA_PERSONA",
      }),
    });
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

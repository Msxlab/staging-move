import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  oauthFindUnique: vi.fn(),
  oauthCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    oAuthAccount: {
      findUnique: (...args: unknown[]) => mocks.oauthFindUnique(...args),
      create: (...args: unknown[]) => mocks.oauthCreate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
      create: (...args: unknown[]) => mocks.userCreate(...args),
      update: (...args: unknown[]) => mocks.userUpdate(...args),
    },
    userLoginSession: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

vi.mock("@/lib/user-jwt-secret", () => ({
  getUserJwtSecretKey: vi.fn(() => new TextEncoder().encode("x".repeat(32))),
}));

vi.mock("@/lib/oauth", () => ({
  hashForOAuthLog: vi.fn(() => "email-hash"),
  logSafeOAuthEvent: vi.fn(),
  oauthUserIdHint: vi.fn((value: string | null | undefined) => value?.slice(-6)),
  summarizeOAuthError: vi.fn(() => ({})),
}));

vi.mock("@/lib/billing", () => ({
  ensureSubscriptionDefaults: vi.fn(() => Promise.resolve({ id: "sub-1" })),
}));

import { findOrLinkOAuthUserWithStatus } from "./user-auth";
import { logSafeOAuthEvent } from "@/lib/oauth";
import { ensureSubscriptionDefaults } from "@/lib/billing";

const logSafeOAuthEventMock = logSafeOAuthEvent as unknown as Mock;
const ensureSubscriptionDefaultsMock = ensureSubscriptionDefaults as unknown as Mock;

describe("OAuth user linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.oauthFindUnique.mockResolvedValue(null);
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: "created-user" });
  });

  it("does not reuse an OAuth link attached to a soft-deleted user", async () => {
    mocks.oauthFindUnique.mockResolvedValue({
      userId: "deleted-user",
      user: { deletedAt: new Date("2026-04-01T00:00:00Z") },
    });

    await expect(
      findOrLinkOAuthUserWithStatus({
        provider: "google",
        providerId: "google-sub",
        email: "deleted@example.com",
      }),
    ).rejects.toThrow("OAUTH_EXISTING_DELETED_USER_BLOCKED");
    expect(mocks.oauthCreate).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(ensureSubscriptionDefaultsMock).not.toHaveBeenCalled();
    expect(logSafeOAuthEventMock).toHaveBeenCalledWith("oauth_account_link_diagnostic", {
      provider: "google",
      reason: "existing_oauth_deleted_user",
      oauthUserIdHint: "d-user",
      oauthAccountUserDeleted: true,
      activeOAuthMatch: false,
    });
  });

  it("logs in through an existing active OAuth link, including after admin restore", async () => {
    mocks.oauthFindUnique.mockResolvedValue({
      userId: "restored-user",
      user: { deletedAt: null },
    });

    await expect(
      findOrLinkOAuthUserWithStatus({
        provider: "google",
        providerId: "google-sub",
        email: "restored@example.com",
      }),
    ).resolves.toEqual({ userId: "restored-user", isNewUser: false, wasLinkedNow: false });

    expect(mocks.oauthCreate).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(ensureSubscriptionDefaultsMock).toHaveBeenCalledWith("restored-user");
    expect(logSafeOAuthEventMock).toHaveBeenCalledWith("oauth_account_link_diagnostic", {
      provider: "google",
      reason: "existing_oauth_active_user",
      oauthUserIdHint: "d-user",
      oauthAccountUserDeleted: false,
      activeOAuthMatch: true,
    });
  });

  it("does not link a provider to a soft-deleted user with the same email", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "deleted-user",
      emailVerifiedAt: new Date("2026-04-01T00:00:00Z"),
      deletedAt: new Date("2026-04-02T00:00:00Z"),
    });

    await expect(
      findOrLinkOAuthUserWithStatus({
        provider: "apple",
        providerId: "apple-sub",
        email: "deleted@example.com",
      }),
    ).rejects.toThrow("OAUTH_EXISTING_DELETED_USER_BLOCKED");
    expect(mocks.oauthCreate).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(logSafeOAuthEventMock).toHaveBeenCalledWith("oauth_account_link_diagnostic", {
      provider: "apple",
      reason: "email_match_deleted_user",
      emailUserIdHint: "d-user",
      emailHash: "email-hash",
      emailMatchDeleted: true,
      activeEmailMatch: false,
    });
  });

  it("links a verified provider to an active password user and marks email verified", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "password-user",
      emailVerifiedAt: null,
      deletedAt: null,
    });

    await expect(
      findOrLinkOAuthUserWithStatus({
        provider: "google",
        providerId: "google-sub",
        email: "Password@Example.com",
      }),
    ).resolves.toEqual({ userId: "password-user", isNewUser: false, wasLinkedNow: true });

    expect(mocks.oauthCreate).toHaveBeenCalledWith({
      data: {
        userId: "password-user",
        provider: "google",
        providerId: "google-sub",
      },
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "password-user" },
      data: { emailVerifiedAt: expect.any(Date) },
    });
    expect(ensureSubscriptionDefaultsMock).toHaveBeenCalledWith("password-user");
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("creates a new provider-verified OAuth account with emailVerifiedAt set", async () => {
    await expect(
      findOrLinkOAuthUserWithStatus({
        provider: "google",
        providerId: "google-sub",
        email: "New@Example.com",
        firstName: "New",
        lastName: "User",
        imageUrl: "https://example.com/avatar.png",
        allowNewAccount: true,
      }),
    ).resolves.toEqual({ userId: "created-user", isNewUser: true, wasLinkedNow: false });

    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: {
        email: "new@example.com",
        firstName: "New",
        lastName: "User",
        imageUrl: "https://example.com/avatar.png",
        emailVerifiedAt: expect.any(Date),
        oauthAccounts: {
          create: { provider: "google", providerId: "google-sub" },
        },
      },
    });
    expect(ensureSubscriptionDefaultsMock).toHaveBeenCalledWith("created-user");
  });
});

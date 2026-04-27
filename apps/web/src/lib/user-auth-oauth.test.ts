import { beforeEach, describe, expect, it, vi } from "vitest";

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
  summarizeOAuthError: vi.fn(() => ({})),
}));

import { findOrLinkOAuthUserWithStatus } from "./user-auth";

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
  });
});

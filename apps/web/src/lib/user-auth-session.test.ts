import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookieGet: vi.fn(),
  cookieGetAll: vi.fn(),
  cookieSet: vi.fn(),
  headersGet: vi.fn(),
  jwtVerify: vi.fn(),
  userLoginSessionFindFirst: vi.fn(),
  userLoginSessionUpdateMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.cookieDelete,
    get: mocks.cookieGet,
    getAll: mocks.cookieGetAll,
    set: mocks.cookieSet,
  })),
  headers: vi.fn(async () => ({
    get: mocks.headersGet,
  })),
}));

vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "signed-token"; }
  },
  jwtVerify: mocks.jwtVerify,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userLoginSession: {
      findFirst: mocks.userLoginSessionFindFirst,
      updateMany: mocks.userLoginSessionUpdateMany,
    },
  },
}));

vi.mock("@/lib/user-jwt-secret", () => ({
  getUserJwtSecretKey: vi.fn(() => new TextEncoder().encode("test-user-jwt-secret-32-characters")),
}));

vi.mock("@/lib/email-verification-gate", () => ({
  needsEmailVerificationGate: vi.fn(() => false),
}));

vi.mock("@/lib/oauth", () => ({
  hashForOAuthLog: vi.fn((value: string) => value),
  logSafeOAuthEvent: vi.fn(),
  oauthUserIdHint: vi.fn((value: string) => value),
  summarizeOAuthError: vi.fn(() => ({})),
}));

vi.mock("@/lib/billing", () => ({
  ensureSubscriptionDefaults: vi.fn(),
}));

import { getUserSession } from "./user-auth";

describe("getUserSession duplicate cookies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieGetAll.mockReturnValue([
      { name: "user_session", value: "stale-token" },
    ]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "stale-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      const normalized = name.toLowerCase();
      if (normalized === "cookie") {
        return "theme=dark; user_session=stale-token; user_session=valid-token";
      }
      if (normalized === "user-agent") return "Test Browser";
      return null;
    });
    mocks.jwtVerify.mockImplementation(async (token: string) => {
      if (token === "stale-token" || token === "valid-token") {
        return { payload: { userId: "user-1", email: "user@example.com" } };
      }
      throw new Error("invalid token");
    });
    mocks.userLoginSessionUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("tries later same-name user_session cookies when the first token has no DB session", async () => {
    mocks.userLoginSessionFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "session-valid",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 60_000),
        userAgent: "Test Browser",
      });

    await expect(getUserSession()).resolves.toMatchObject({
      userId: "user-1",
      email: "user@example.com",
      sessionId: "session-valid",
    });

    expect(mocks.jwtVerify).toHaveBeenCalledTimes(2);
    expect(mocks.userLoginSessionFindFirst).toHaveBeenCalledTimes(2);
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});

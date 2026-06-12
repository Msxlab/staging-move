import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookieGet: vi.fn(),
  cookieGetAll: vi.fn(),
  cookieSet: vi.fn(),
  headersGet: vi.fn(),
  jwtVerify: vi.fn(),
  needsEmailVerificationGate: vi.fn(() => false),
  rawUserFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
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
  rawPrisma: {
    user: {
      findUnique: mocks.rawUserFindUnique,
    },
  },
  prisma: {
    userLoginSession: {
      findFirst: mocks.userLoginSessionFindFirst,
      updateMany: mocks.userLoginSessionUpdateMany,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

vi.mock("@/lib/user-jwt-secret", () => ({
  getUserJwtSecretKey: vi.fn(() => new TextEncoder().encode("test-user-jwt-secret-32-characters")),
}));

vi.mock("@/lib/email-verification-gate", () => ({
  needsEmailVerificationGate: mocks.needsEmailVerificationGate,
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

import {
  createUserAuthDiagnostics,
  generateFingerprint,
  generateMobileFingerprint,
  getUserSession,
  requireDbUserId,
  requireVerifiedUser,
} from "./user-auth";

async function legacyWebIpFingerprint(ip: string, userAgent: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${userAgent || "unknown"}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
    mocks.rawUserFindUnique.mockResolvedValue({
      id: "user-1",
      emailVerifiedAt: new Date("2026-04-29T12:00:00Z"),
      passwordHash: "hash",
      deletedAt: null,
      oauthAccounts: [],
    });
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", deletedAt: null });
    mocks.needsEmailVerificationGate.mockReturnValue(false);
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

    const diagnostics = createUserAuthDiagnostics();

    await expect(getUserSession({ diagnostics })).resolves.toMatchObject({
      userId: "user-1",
      email: "user@example.com",
      sessionId: "session-valid",
    });

    expect(diagnostics).toMatchObject({
      cookieCandidatesCount: 2,
      jwtCandidateValidCount: 2,
      dbSessionFound: true,
      sessionExpired: false,
      fingerprintMatched: true,
      finalFailureCode: null,
    });
    expect(mocks.jwtVerify).toHaveBeenCalledTimes(2);
    expect(mocks.userLoginSessionFindFirst).toHaveBeenCalledTimes(2);
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("returns null when all session cookies are stale", async () => {
    mocks.jwtVerify.mockRejectedValue(new Error("invalid token"));
    const diagnostics = createUserAuthDiagnostics();

    await expect(getUserSession({ diagnostics })).resolves.toBeNull();

    expect(diagnostics).toMatchObject({
      cookieCandidatesCount: 2,
      jwtCandidateValidCount: 0,
      finalFailureCode: "JWT_INVALID",
    });
    expect(mocks.userLoginSessionFindFirst).not.toHaveBeenCalled();
  });

  it("returns null for an expired DB session", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      if (name.toLowerCase() === "cookie") return "user_session=valid-token";
      if (name.toLowerCase() === "user-agent") return "Test Browser";
      return null;
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-expired",
      userId: "user-1",
      expiresAt: new Date(Date.now() - 60_000),
      userAgent: "Test Browser",
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(getUserSession({ diagnostics })).resolves.toBeNull();

    expect(diagnostics).toMatchObject({
      jwtCandidateValidCount: 1,
      dbSessionFound: true,
      sessionExpired: true,
      fingerprintMatched: true,
      finalFailureCode: "SESSION_EXPIRED",
    });
    expect(mocks.userLoginSessionUpdateMany).toHaveBeenCalled();
  });

  it("returns null for a fingerprint mismatch", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      const normalized = name.toLowerCase();
      if (normalized === "cookie") return "user_session=valid-token";
      if (normalized === "user-agent") return "Test Browser";
      if (normalized === "x-forwarded-for") return "203.0.113.10";
      return null;
    });
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: {
        userId: "user-1",
        email: "user@example.com",
        fp: "stored-fingerprint",
        fpMode: "web",
      },
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-mismatch",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Different Browser",
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(getUserSession({ diagnostics })).resolves.toBeNull();

    expect(diagnostics).toMatchObject({
      jwtCandidateValidCount: 1,
      dbSessionFound: true,
      fingerprintMatched: false,
      finalFailureCode: "FINGERPRINT_MISMATCH",
    });
    expect(mocks.userLoginSessionUpdateMany).toHaveBeenCalled();
  });

  it("can reject a fingerprint mismatch without invalidating the DB session", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      const normalized = name.toLowerCase();
      if (normalized === "cookie") return "user_session=valid-token";
      if (normalized === "user-agent") return "NativeImageLoader/1.0";
      if (normalized === "x-forwarded-for") return "203.0.113.10";
      return null;
    });
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: {
        userId: "user-1",
        email: "user@example.com",
        fp: await generateMobileFingerprint("LocateFlow/1.0.2 (iOS; Expo)"),
        fpMode: "mobile",
      },
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-mobile",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "LocateFlow/1.0.2 (iOS; Expo)",
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(getUserSession({
      diagnostics,
      invalidateOnFingerprintMismatch: false,
    })).resolves.toBeNull();

    expect(diagnostics).toMatchObject({
      jwtCandidateValidCount: 1,
      dbSessionFound: true,
      fingerprintMatched: false,
      finalFailureCode: "FINGERPRINT_MISMATCH",
    });
    expect(mocks.userLoginSessionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("keeps new web sessions valid across IP changes when the UA fingerprint matches", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      const normalized = name.toLowerCase();
      if (normalized === "cookie") return "user_session=valid-token";
      if (normalized === "user-agent") return "Test Browser";
      if (normalized === "x-forwarded-for") return "203.0.113.10";
      return null;
    });
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: {
        userId: "user-1",
        email: "user@example.com",
        fp: await generateFingerprint("198.51.100.10", "Test Browser"),
        fpMode: "web",
      },
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-valid",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Test Browser",
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(getUserSession({ diagnostics })).resolves.toMatchObject({
      userId: "user-1",
      sessionId: "session-valid",
    });

    expect(diagnostics).toMatchObject({
      jwtCandidateValidCount: 1,
      dbSessionFound: true,
      fingerprintMatched: true,
      finalFailureCode: null,
    });
    expect(mocks.userLoginSessionUpdateMany).not.toHaveBeenCalled();
  });

  it("keeps legacy IP-bound web sessions valid across IP changes when the stored UA matches", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      const normalized = name.toLowerCase();
      if (normalized === "cookie") return "user_session=valid-token";
      if (normalized === "user-agent") return "Test Browser";
      if (normalized === "x-forwarded-for") return "203.0.113.10";
      return null;
    });
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: {
        userId: "user-1",
        email: "user@example.com",
        fp: await legacyWebIpFingerprint("198.51.100.10", "Test Browser"),
        fpMode: "web",
      },
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-legacy-web",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Test Browser",
      ipAddress: "198.51.100.10",
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(getUserSession({ diagnostics })).resolves.toMatchObject({
      userId: "user-1",
      sessionId: "session-legacy-web",
    });

    expect(diagnostics).toMatchObject({
      jwtCandidateValidCount: 1,
      dbSessionFound: true,
      fingerprintMatched: true,
      finalFailureCode: null,
    });
    expect(mocks.userLoginSessionUpdateMany).not.toHaveBeenCalled();
  });

  it("treats legacy web sessions with null userAgent as untrusted on fingerprint mismatch", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      const normalized = name.toLowerCase();
      if (normalized === "cookie") return "user_session=valid-token";
      if (normalized === "user-agent") return "Test Browser";
      if (normalized === "x-forwarded-for") return "203.0.113.10";
      return null;
    });
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: {
        userId: "user-1",
        email: "user@example.com",
        fp: "ip-bound-fingerprint-from-login",
        fpMode: "web",
      },
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-valid",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: null,
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(getUserSession({ diagnostics })).resolves.toBeNull();

    expect(diagnostics).toMatchObject({
      fingerprintMatched: false,
      finalFailureCode: "FINGERPRINT_MISMATCH",
    });
    expect(mocks.userLoginSessionUpdateMany).toHaveBeenCalled();
  });

  it("keeps mobile sessions valid across IP changes when the UA fingerprint matches", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      const normalized = name.toLowerCase();
      if (normalized === "cookie") return "user_session=valid-token";
      if (normalized === "user-agent") return "LocateFlowMobile/1.0";
      if (normalized === "x-forwarded-for") return "198.51.100.22";
      return null;
    });
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: {
        userId: "user-1",
        email: "user@example.com",
        fp: await generateMobileFingerprint("LocateFlowMobile/1.0"),
        fpMode: "mobile",
      },
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-mobile",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "LocateFlowMobile/1.0",
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(getUserSession({ diagnostics })).resolves.toMatchObject({
      userId: "user-1",
      sessionId: "session-mobile",
    });

    expect(diagnostics).toMatchObject({
      fingerprintMatched: true,
      finalFailureCode: null,
    });
    expect(mocks.userLoginSessionUpdateMany).not.toHaveBeenCalled();
  });

  it("returns the canonical DB session user id after the JWT user id matches", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      if (name.toLowerCase() === "cookie") return "user_session=valid-token";
      if (name.toLowerCase() === "user-agent") return "Test Browser";
      return null;
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-valid",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Test Browser",
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(requireDbUserId({ diagnostics })).resolves.toBe("user-1");

    expect(diagnostics).toMatchObject({
      dbSessionFound: true,
      jwtUserFound: true,
      jwtUserMatchesSession: true,
      sessionUserFound: true,
      dbUserFound: true,
      canonicalUserFound: true,
      canonicalUserDeleted: false,
      userLookupClient: "raw",
      finalFailureCode: null,
    });
    expect(mocks.rawUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        emailVerifiedAt: true,
        passwordHash: true,
        deletedAt: true,
        oauthAccounts: { select: { id: true } },
      },
    });
  });

  it("invalidates a DB session when its userId does not match the JWT userId", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      if (name.toLowerCase() === "cookie") return "user_session=valid-token";
      if (name.toLowerCase() === "user-agent") return "Test Browser";
      return null;
    });
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: { userId: "jwt-user", email: "user@example.com" },
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-valid",
      userId: "session-user",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Test Browser",
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(requireDbUserId({ diagnostics })).rejects.toThrow("UNAUTHORIZED");

    expect(diagnostics).toMatchObject({
      dbSessionFound: true,
      jwtUserFound: true,
      jwtUserMatchesSession: false,
      sessionUserFound: null,
      dbUserFound: null,
      finalFailureCode: "SESSION_USER_MISMATCH",
    });
    expect(mocks.rawUserFindUnique).not.toHaveBeenCalled();
    expect(mocks.userLoginSessionUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), isActive: true },
      data: { isActive: false },
    });
    expect(mocks.cookieSet).toHaveBeenCalledWith("user_session", "", expect.objectContaining({ maxAge: 0 }));
  });

  it("invalidates a DB session when the JWT is missing a user id claim", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      if (name.toLowerCase() === "cookie") return "user_session=valid-token";
      if (name.toLowerCase() === "user-agent") return "Test Browser";
      return null;
    });
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: { email: "user@example.com" },
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-valid",
      userId: "session-user",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Test Browser",
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(requireDbUserId({ diagnostics })).rejects.toThrow("UNAUTHORIZED");

    expect(diagnostics).toMatchObject({
      dbSessionFound: true,
      jwtUserFound: false,
      jwtUserMatchesSession: false,
      sessionUserFound: null,
      dbUserFound: null,
      finalFailureCode: "JWT_USER_NOT_FOUND",
    });
    expect(mocks.rawUserFindUnique).not.toHaveBeenCalled();
    expect(mocks.userLoginSessionUpdateMany).toHaveBeenCalled();
  });

  it("reports DB_USER_NOT_FOUND only after a matching session user is hard-missing", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      if (name.toLowerCase() === "cookie") return "user_session=valid-token";
      if (name.toLowerCase() === "user-agent") return "Test Browser";
      return null;
    });
    mocks.userLoginSessionFindFirst.mockResolvedValue({
      id: "session-valid",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Test Browser",
    });
    mocks.rawUserFindUnique.mockResolvedValueOnce(null);
    const diagnostics = createUserAuthDiagnostics();

    await expect(requireDbUserId({ diagnostics })).rejects.toThrow("UNAUTHORIZED");

    expect(diagnostics).toMatchObject({
      dbSessionFound: true,
      jwtUserFound: true,
      jwtUserMatchesSession: true,
      sessionUserFound: false,
      dbUserFound: false,
      canonicalUserFound: false,
      canonicalUserDeleted: null,
      userLookupClient: "raw",
      finalFailureCode: "DB_USER_NOT_FOUND",
    });
  });

  it("reports ACCOUNT_DELETED when the matching session user is soft-deleted", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      if (name.toLowerCase() === "cookie") return "user_session=valid-token";
      if (name.toLowerCase() === "user-agent") return "Test Browser";
      return null;
    });
    mocks.userLoginSessionFindFirst.mockResolvedValue({
      id: "session-valid",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Test Browser",
    });
    mocks.rawUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      deletedAt: new Date("2026-04-29T12:00:00Z"),
    });
    const diagnostics = createUserAuthDiagnostics();

    await expect(requireDbUserId({ distinguishDeleted: true, diagnostics })).rejects.toThrow("ACCOUNT_DELETED");

    expect(diagnostics).toMatchObject({
      dbSessionFound: true,
      jwtUserMatchesSession: true,
      sessionUserFound: true,
      dbUserFound: false,
      canonicalUserFound: true,
      canonicalUserDeleted: true,
      userLookupClient: "raw",
      finalFailureCode: "ACCOUNT_DELETED",
    });
  });

  it("throws EMAIL_VERIFICATION_REQUIRED with diagnostics for unverified users", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      if (name.toLowerCase() === "cookie") return "user_session=valid-token";
      if (name.toLowerCase() === "user-agent") return "Test Browser";
      return null;
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-valid",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Test Browser",
    });
    mocks.rawUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      emailVerifiedAt: null,
      passwordHash: "hash",
      deletedAt: null,
      oauthAccounts: [],
    });
    mocks.needsEmailVerificationGate.mockReturnValueOnce(true);
    const diagnostics = createUserAuthDiagnostics();

    await expect(requireVerifiedUser({ diagnostics })).rejects.toThrow("EMAIL_VERIFICATION_REQUIRED");

    expect(diagnostics).toMatchObject({
      dbUserFound: true,
      canonicalUserFound: true,
      canonicalUserDeleted: false,
      userLookupClient: "raw",
      emailVerified: false,
      finalFailureCode: "EMAIL_VERIFICATION_REQUIRED",
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("uses the canonical raw user for verified-user auth without a second soft-delete-filtered lookup", async () => {
    mocks.cookieGetAll.mockReturnValue([{ name: "user_session", value: "valid-token" }]);
    mocks.cookieGet.mockReturnValue({ name: "user_session", value: "valid-token" });
    mocks.headersGet.mockImplementation((name: string) => {
      if (name.toLowerCase() === "cookie") return "user_session=valid-token";
      if (name.toLowerCase() === "user-agent") return "Test Browser";
      return null;
    });
    mocks.userLoginSessionFindFirst.mockResolvedValueOnce({
      id: "session-valid",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Test Browser",
    });
    mocks.rawUserFindUnique.mockResolvedValueOnce({
      id: "user-1",
      emailVerifiedAt: new Date("2026-04-29T12:00:00Z"),
      passwordHash: "hash",
      deletedAt: null,
      oauthAccounts: [],
    });
    mocks.userFindUnique.mockResolvedValueOnce(null);
    mocks.needsEmailVerificationGate.mockReturnValueOnce(false);
    const diagnostics = createUserAuthDiagnostics();

    await expect(requireVerifiedUser({ diagnostics })).resolves.toBe("user-1");

    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(diagnostics).toMatchObject({
      jwtUserFound: true,
      jwtUserMatchesSession: true,
      sessionUserFound: true,
      dbUserFound: true,
      canonicalUserFound: true,
      canonicalUserDeleted: false,
      userLookupClient: "raw",
      emailVerified: true,
      finalFailureCode: null,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mobileOAuthCodeCreate: vi.fn(),
  mobileOAuthCodeFindUnique: vi.fn(),
  mobileOAuthCodeUpdateMany: vi.fn(),
  generateOpaqueToken: vi.fn(() => ({ token: "raw-handoff-code", hash: "handoff-hash" })),
  hashOpaqueToken: vi.fn(() => "handoff-hash"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mobileOAuthCode: {
      create: (args: any) => (mocks.mobileOAuthCodeCreate as any)(args),
      findUnique: (args: any) => (mocks.mobileOAuthCodeFindUnique as any)(args),
      updateMany: (args: any) => (mocks.mobileOAuthCodeUpdateMany as any)(args),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  generateOpaqueToken: () => mocks.generateOpaqueToken(),
  hashOpaqueToken: (token: string) => (mocks.hashOpaqueToken as any)(token),
}));

import {
  buildMobileOAuthRedirectUrl,
  consumeMobileOAuthExchangeCode,
  createMobileOAuthExchangeCode,
  normalizeMobileOAuthCodeChallenge,
  normalizeMobileOAuthRedirectUri,
  normalizeMobileOAuthState,
} from "./mobile-oauth";

const VALID_VERIFIER = "A".repeat(43);
const VALID_CHALLENGE = "DwBzhbb51LfusnSGBa_hqYSgo7-j8BTQnip4TOnlzRo";

function activeRecord() {
  return {
    id: "handoff-1",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    codeChallenge: VALID_CHALLENGE,
    user: {
      id: "user-1",
      email: "mobile@example.com",
      firstName: "Mobile",
      lastName: "User",
      imageUrl: null,
      emailVerifiedAt: new Date("2026-04-27T12:00:00Z"),
      mfaEnabled: false,
      deletedAt: null,
    },
  };
}

describe("mobile OAuth handoff codes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MOBILE_OAUTH_REDIRECT_URIS;
    mocks.mobileOAuthCodeCreate.mockResolvedValue({});
    mocks.mobileOAuthCodeFindUnique.mockResolvedValue(activeRecord());
    mocks.mobileOAuthCodeUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("validates mobile redirect URIs against an allowlist", () => {
    expect(normalizeMobileOAuthRedirectUri("locateflow://oauth")).toBe("locateflow://oauth");
    expect(normalizeMobileOAuthRedirectUri("locateflow:///oauth")).toBe("locateflow:///oauth");
    expect(normalizeMobileOAuthRedirectUri("https://app.locateflow.com/mobile/oauth")).toBe(
      "https://app.locateflow.com/mobile/oauth",
    );
    expect(normalizeMobileOAuthRedirectUri("exp://192.168.1.5:8081/--/oauth")).toBe(
      "exp://192.168.1.5:8081/--/oauth",
    );
    expect(normalizeMobileOAuthRedirectUri("https://evil.example/callback")).toBeNull();
  });

  it("uses the configured redirect allowlist when one is present", () => {
    process.env.MOBILE_OAUTH_REDIRECT_URIS = "locateflow://oauth";

    expect(normalizeMobileOAuthRedirectUri("locateflow://oauth")).toBe("locateflow://oauth");
    expect(normalizeMobileOAuthRedirectUri("locateflow:///oauth")).toBeNull();
    expect(normalizeMobileOAuthRedirectUri("exp://192.168.1.5:8081/--/oauth")).toBeNull();
  });

  it("validates mobile state values before echoing them to the native callback", () => {
    expect(normalizeMobileOAuthState("abcDEF_123-456789")).toBe("abcDEF_123-456789");
    expect(normalizeMobileOAuthState("bad state with spaces")).toBeNull();
    expect(normalizeMobileOAuthState("short")).toBeNull();
  });

  it("validates mobile PKCE challenge values before storing them", () => {
    expect(normalizeMobileOAuthCodeChallenge(VALID_CHALLENGE)).toBe(VALID_CHALLENGE);
    expect(normalizeMobileOAuthCodeChallenge("short")).toBeNull();
    expect(normalizeMobileOAuthCodeChallenge(`${VALID_CHALLENGE}=`)).toBeNull();
  });

  it("creates a short-lived one-time code without putting bearer tokens in the redirect", async () => {
    await expect(createMobileOAuthExchangeCode({
      userId: "user-1",
      provider: "google",
      redirectUri: "locateflow://oauth",
      codeChallenge: VALID_CHALLENGE,
    })).resolves.toBe("raw-handoff-code");

    expect(mocks.mobileOAuthCodeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        provider: "google",
        redirectUri: "locateflow://oauth",
        codeHash: "handoff-hash",
        codeChallenge: VALID_CHALLENGE,
        expiresAt: expect.any(Date),
      }),
    });

    const redirectUrl = buildMobileOAuthRedirectUrl({
      redirectUri: "locateflow://oauth",
      code: "raw-handoff-code",
      provider: "google",
      state: "mobile-state-123456",
    }).toString();
    expect(redirectUrl).toContain("code=raw-handoff-code");
    expect(redirectUrl).toContain("state=mobile-state-123456");
    expect(redirectUrl).not.toContain("token=");
  });

  it("exchanges an unused unexpired code exactly once", async () => {
    await expect(consumeMobileOAuthExchangeCode("raw-handoff-code", {
      codeVerifier: VALID_VERIFIER,
    })).resolves.toMatchObject({
      ok: true,
      user: { id: "user-1", email: "mobile@example.com" },
    });

    expect(mocks.hashOpaqueToken).toHaveBeenCalledWith("raw-handoff-code");
    expect(mocks.mobileOAuthCodeUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "handoff-1",
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("rejects replayed codes", async () => {
    mocks.mobileOAuthCodeFindUnique.mockResolvedValue({ ...activeRecord(), usedAt: new Date() });

    await expect(consumeMobileOAuthExchangeCode("raw-handoff-code")).resolves.toEqual({
      ok: false,
      error: "REPLAYED_CODE",
    });
    expect(mocks.mobileOAuthCodeUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects rows that do not carry a stored PKCE challenge", async () => {
    mocks.mobileOAuthCodeFindUnique.mockResolvedValue({ ...activeRecord(), codeChallenge: null });

    await expect(consumeMobileOAuthExchangeCode("raw-handoff-code", {
      codeVerifier: VALID_VERIFIER,
    })).resolves.toEqual({
      ok: false,
      error: "PKCE_CHALLENGE_REQUIRED",
    });
    expect(mocks.mobileOAuthCodeUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects exchanges without a verifier", async () => {
    await expect(consumeMobileOAuthExchangeCode("raw-handoff-code")).resolves.toEqual({
      ok: false,
      error: "PKCE_VERIFIER_REQUIRED",
    });
    expect(mocks.mobileOAuthCodeUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects expired codes", async () => {
    mocks.mobileOAuthCodeFindUnique.mockResolvedValue({
      ...activeRecord(),
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(consumeMobileOAuthExchangeCode("raw-handoff-code")).resolves.toEqual({
      ok: false,
      error: "EXPIRED_CODE",
    });
    expect(mocks.mobileOAuthCodeUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects concurrent exchange attempts after another request consumes the code", async () => {
    mocks.mobileOAuthCodeUpdateMany.mockResolvedValue({ count: 0 });

    await expect(consumeMobileOAuthExchangeCode("raw-handoff-code", {
      codeVerifier: VALID_VERIFIER,
    })).resolves.toEqual({
      ok: false,
      error: "REPLAYED_CODE",
    });
  });
});

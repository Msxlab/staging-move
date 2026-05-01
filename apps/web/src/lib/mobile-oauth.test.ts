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
  normalizeMobileOAuthRedirectUri,
} from "./mobile-oauth";

function activeRecord() {
  return {
    id: "handoff-1",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
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

  it("creates a short-lived one-time code without putting bearer tokens in the redirect", async () => {
    await expect(createMobileOAuthExchangeCode({
      userId: "user-1",
      provider: "google",
      redirectUri: "locateflow://oauth",
    })).resolves.toBe("raw-handoff-code");

    expect(mocks.mobileOAuthCodeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        provider: "google",
        redirectUri: "locateflow://oauth",
        codeHash: "handoff-hash",
        expiresAt: expect.any(Date),
      }),
    });

    const redirectUrl = buildMobileOAuthRedirectUrl({
      redirectUri: "locateflow://oauth",
      code: "raw-handoff-code",
      provider: "google",
    }).toString();
    expect(redirectUrl).toContain("code=raw-handoff-code");
    expect(redirectUrl).not.toContain("token=");
  });

  it("exchanges an unused unexpired code exactly once", async () => {
    await expect(consumeMobileOAuthExchangeCode("raw-handoff-code")).resolves.toMatchObject({
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

    await expect(consumeMobileOAuthExchangeCode("raw-handoff-code")).resolves.toEqual({
      ok: false,
      error: "REPLAYED_CODE",
    });
  });
});

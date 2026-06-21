import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  partnerFindFirst: vi.fn(),
  partnerFindUnique: vi.fn(),
  tokenCreate: vi.fn(),
  tokenFindUnique: vi.fn(),
  tokenUpdate: vi.fn(),
  tokenUpdateMany: vi.fn(),
  tokenDeleteMany: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  secureSessionCookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    partner: { findFirst: mocks.partnerFindFirst, findUnique: mocks.partnerFindUnique },
    partnerPortalToken: {
      create: mocks.tokenCreate,
      findUnique: mocks.tokenFindUnique,
      update: mocks.tokenUpdate,
      updateMany: mocks.tokenUpdateMany,
      deleteMany: mocks.tokenDeleteMany,
    },
  },
}));
vi.mock("@/lib/user-auth", () => ({
  generateOpaqueToken: () => ({ token: "raw-token", hash: "hash-of-raw" }),
  hashOpaqueToken: (t: string) => `hash-of-${t}`,
  shouldUseSecureSessionCookies: mocks.secureSessionCookies,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }),
}));

import {
  PARTNER_PORTAL_COOKIE,
  consumePartnerPortalToken,
  getPartnerPortalSession,
  requestPartnerPortalLink,
} from "./partner-portal-auth";

describe("partner-portal-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tokenCreate.mockResolvedValue({});
    mocks.tokenUpdate.mockResolvedValue({});
    mocks.tokenDeleteMany.mockResolvedValue({ count: 0 });
    mocks.secureSessionCookies.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues a token for an APPROVED partner by contact email; supersedes prior links", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    mocks.partnerFindFirst.mockResolvedValue({ id: "ptr_1", companyName: "Sparkle" });
    const result = await requestPartnerPortalLink("Ops@Sparkle.com ");
    expect(result).toEqual({ token: "raw-token", partnerId: "ptr_1", companyName: "Sparkle" });
    expect(mocks.partnerFindFirst.mock.calls[0][0].where).toMatchObject({ contactEmail: "ops@sparkle.com", status: "APPROVED" });
    // Prior tokens for this partner are pruned before a new one is issued (audit P2).
    expect(mocks.tokenDeleteMany).toHaveBeenCalledWith({ where: { partnerId: "ptr_1" } });
    expect(mocks.tokenCreate).toHaveBeenCalled();
    expect(mocks.tokenCreate.mock.calls[0][0].data.expiresAt).toEqual(new Date("2026-06-22T12:00:00.000Z"));
  });

  it("returns null with no token for an unknown / non-approved email (no enumeration)", async () => {
    mocks.partnerFindFirst.mockResolvedValue(null);
    expect(await requestPartnerPortalLink("nobody@x.com")).toBeNull();
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it("resolves a live token to a session only while the partner stays APPROVED", async () => {
    mocks.cookieGet.mockReturnValue({ value: "raw-token" });
    mocks.tokenFindUnique.mockResolvedValue({
      id: "tok_1",
      partnerId: "ptr_1",
      email: "ops@sparkle.com",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mocks.partnerFindUnique.mockResolvedValue({ status: "APPROVED" });
    expect(await getPartnerPortalSession()).toEqual({ partnerId: "ptr_1", email: "ops@sparkle.com" });
  });

  it("rejects a revoked/expired token and a no-longer-approved partner", async () => {
    mocks.cookieGet.mockReturnValue({ value: "raw-token" });
    // revoked
    mocks.tokenFindUnique.mockResolvedValueOnce({ id: "t", partnerId: "p", email: "e", expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() });
    expect(await getPartnerPortalSession()).toBeNull();
    // valid token but partner no longer approved
    mocks.tokenFindUnique.mockResolvedValueOnce({ id: "t", partnerId: "p", email: "e", expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
    mocks.partnerFindUnique.mockResolvedValueOnce({ status: "REJECTED" });
    expect(await getPartnerPortalSession()).toBeNull();
  });

  it("returns null when there is no portal cookie", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    expect(await getPartnerPortalSession()).toBeNull();
  });

  it("uses the shared staging/https secure-cookie policy", async () => {
    mocks.secureSessionCookies.mockReturnValue(true);
    mocks.tokenFindUnique.mockResolvedValue({
      id: "tok_1",
      partnerId: "ptr_1",
      email: "ops@sparkle.com",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mocks.partnerFindUnique.mockResolvedValue({ status: "APPROVED" });

    await consumePartnerPortalToken("raw-token");

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      PARTNER_PORTAL_COOKIE,
      "raw-token",
      expect.objectContaining({ secure: true }),
    );
  });
});

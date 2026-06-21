import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applicationFindFirst: vi.fn(),
  companyFindUnique: vi.fn(),
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
    moverApplication: { findFirst: mocks.applicationFindFirst },
    movingCompany: { findUnique: mocks.companyFindUnique },
    moverPortalToken: {
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
  MOVER_PORTAL_COOKIE,
  consumeMoverPortalToken,
  getMoverPortalSession,
  requestMoverPortalLink,
} from "./mover-portal-auth";

describe("mover-portal-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tokenCreate.mockResolvedValue({});
    mocks.tokenUpdate.mockResolvedValue({});
    mocks.tokenUpdateMany.mockResolvedValue({ count: 0 });
    mocks.tokenDeleteMany.mockResolvedValue({ count: 0 });
    mocks.secureSessionCookies.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues a token for an approved listed mover and supersedes prior links", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    mocks.applicationFindFirst.mockResolvedValue({
      linkedMovingCompanyId: "mc_1",
      companyLegalName: "North Star Moving",
    });
    mocks.companyFindUnique.mockResolvedValue({ id: "mc_1", active: true });

    const result = await requestMoverPortalLink(" Ops@Mover.com ");

    expect(result).toEqual({
      token: "raw-token",
      movingCompanyId: "mc_1",
      companyName: "North Star Moving",
    });
    expect(mocks.applicationFindFirst.mock.calls[0][0].where).toMatchObject({
      contactEmail: "ops@mover.com",
      status: "APPROVED",
      linkedMovingCompanyId: { not: null },
    });
    expect(mocks.companyFindUnique).toHaveBeenCalledWith({
      where: { id: "mc_1" },
      select: { id: true, active: true },
    });
    expect(mocks.tokenDeleteMany).toHaveBeenCalledWith({ where: { movingCompanyId: "mc_1" } });
    expect(mocks.tokenCreate.mock.calls[0][0].data).toMatchObject({
      movingCompanyId: "mc_1",
      email: "ops@mover.com",
      tokenHash: "hash-of-raw",
      expiresAt: new Date("2026-06-22T12:00:00.000Z"),
    });
  });

  it("returns null without issuing a token when no approved linked application matches", async () => {
    mocks.applicationFindFirst.mockResolvedValue(null);

    await expect(requestMoverPortalLink("nobody@example.com")).resolves.toBeNull();
    expect(mocks.companyFindUnique).not.toHaveBeenCalled();
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it("returns null without issuing a token when the linked company is inactive", async () => {
    mocks.applicationFindFirst.mockResolvedValue({
      linkedMovingCompanyId: "mc_1",
      companyLegalName: "North Star Moving",
    });
    mocks.companyFindUnique.mockResolvedValue({ id: "mc_1", active: false });

    await expect(requestMoverPortalLink("ops@mover.com")).resolves.toBeNull();
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it("resolves a live token to a session only while the moving company stays active", async () => {
    mocks.cookieGet.mockReturnValue({ value: "raw-token" });
    mocks.tokenFindUnique.mockResolvedValue({
      id: "tok_1",
      movingCompanyId: "mc_1",
      email: "ops@mover.com",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mocks.companyFindUnique.mockResolvedValue({ active: true });

    expect(await getMoverPortalSession()).toEqual({ movingCompanyId: "mc_1", email: "ops@mover.com" });
    expect(mocks.tokenUpdate).toHaveBeenCalledWith({
      where: { id: "tok_1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("rejects revoked/expired tokens and inactive companies", async () => {
    mocks.cookieGet.mockReturnValue({ value: "raw-token" });

    mocks.tokenFindUnique.mockResolvedValueOnce({
      id: "tok_1",
      movingCompanyId: "mc_1",
      email: "ops@mover.com",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });
    await expect(getMoverPortalSession()).resolves.toBeNull();

    mocks.tokenFindUnique.mockResolvedValueOnce({
      id: "tok_1",
      movingCompanyId: "mc_1",
      email: "ops@mover.com",
      expiresAt: new Date(Date.now() - 1),
      revokedAt: null,
    });
    await expect(getMoverPortalSession()).resolves.toBeNull();

    mocks.tokenFindUnique.mockResolvedValueOnce({
      id: "tok_1",
      movingCompanyId: "mc_1",
      email: "ops@mover.com",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mocks.companyFindUnique.mockResolvedValueOnce({ active: false });
    await expect(getMoverPortalSession()).resolves.toBeNull();
  });

  it("sets a 24-hour session cookie after consuming a live token", async () => {
    mocks.tokenFindUnique.mockResolvedValue({
      id: "tok_1",
      movingCompanyId: "mc_1",
      email: "ops@mover.com",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mocks.companyFindUnique.mockResolvedValue({ active: true });

    await expect(consumeMoverPortalToken("raw-token")).resolves.toEqual({
      movingCompanyId: "mc_1",
      email: "ops@mover.com",
    });
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      MOVER_PORTAL_COOKIE,
      "raw-token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 86_400 }),
    );
  });

  it("uses the shared staging/https secure-cookie policy", async () => {
    mocks.secureSessionCookies.mockReturnValue(true);
    mocks.tokenFindUnique.mockResolvedValue({
      id: "tok_1",
      movingCompanyId: "mc_1",
      email: "ops@mover.com",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    mocks.companyFindUnique.mockResolvedValue({ active: true });

    await consumeMoverPortalToken("raw-token");

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      MOVER_PORTAL_COOKIE,
      "raw-token",
      expect.objectContaining({ secure: true }),
    );
  });
});

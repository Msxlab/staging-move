import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { subscription: { findUnique: (...a: unknown[]) => mocks.findUnique(...a) } },
}));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: vi.fn(async () => null) }));
vi.mock("@/lib/shared-encryption", () => ({ decrypt: (v: string) => v, encrypt: (v: string) => v }));

import { userHasApiConnectorEntitlement } from "./connector-oauth";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

describe("userHasApiConnectorEntitlement — sync requires active annual Pro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows an active annual Pro subscriber", async () => {
    mocks.findUnique.mockResolvedValue({
      plan: "PRO", status: "ACTIVE", accessType: "PAID", provider: "STRIPE",
      billingInterval: "YEAR", currentPeriodEndsAt: FUTURE,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(true);
  });

  it("blocks an active MONTHLY Pro subscriber (annual commitment required)", async () => {
    mocks.findUnique.mockResolvedValue({
      plan: "PRO", status: "ACTIVE", accessType: "PAID", provider: "STRIPE",
      billingInterval: "MONTH", currentPeriodEndsAt: FUTURE,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(false);
  });

  it("blocks Family (tier without API connectors) even on annual", async () => {
    mocks.findUnique.mockResolvedValue({
      plan: "FAMILY", status: "ACTIVE", accessType: "PAID", provider: "STRIPE",
      billingInterval: "YEAR", currentPeriodEndsAt: FUTURE,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(false);
  });

  it("blocks a canceled annual Pro (no active access)", async () => {
    mocks.findUnique.mockResolvedValue({
      plan: "PRO", status: "CANCELED", accessType: "PAID", provider: "STRIPE",
      billingInterval: "YEAR", canceledAt: PAST, currentPeriodEndsAt: PAST,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(false);
  });

  it("exempts an admin-granted Pro (manual comp) from the annual requirement", async () => {
    mocks.findUnique.mockResolvedValue({
      plan: "PRO", status: "ACTIVE", accessType: "PAID", provider: "ADMIN",
      premiumGrantedBy: "admin_1", premiumUntil: FUTURE,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(true);
  });
});

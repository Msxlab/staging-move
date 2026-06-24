import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  featureFlagFindUnique: vi.fn(),
  affiliateConversionGroupBy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    featureFlag: {
      findUnique: (...args: unknown[]) => mocks.featureFlagFindUnique(...args),
    },
    affiliateConversion: {
      groupBy: (...args: unknown[]) => mocks.affiliateConversionGroupBy(...args),
    },
  },
}));

import { getConsumerFreeStatus } from "./consumer-free-status";

const originalConsumerFreeDefault = process.env.CONSUMER_FREE_DEFAULT;

function restoreConsumerFreeDefault() {
  if (originalConsumerFreeDefault === undefined) {
    delete process.env.CONSUMER_FREE_DEFAULT;
    return;
  }

  process.env.CONSUMER_FREE_DEFAULT = originalConsumerFreeDefault;
}

describe("getConsumerFreeStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreConsumerFreeDefault();
    mocks.featureFlagFindUnique.mockResolvedValue(null);
    mocks.affiliateConversionGroupBy.mockResolvedValue([]);
  });

  afterEach(() => {
    restoreConsumerFreeDefault();
  });

  it("defaults missing CONSUMER_FREE rows to enabled", async () => {
    delete process.env.CONSUMER_FREE_DEFAULT;

    await expect(getConsumerFreeStatus()).resolves.toMatchObject({
      consumerFreeEnabled: true,
      affiliateEarnedCents: 0,
      affiliatePendingCents: 0,
    });
  });

  it("allows the fallback default to opt out through CONSUMER_FREE_DEFAULT", async () => {
    process.env.CONSUMER_FREE_DEFAULT = "false";

    await expect(getConsumerFreeStatus()).resolves.toMatchObject({
      consumerFreeEnabled: false,
    });
  });

  it("lets an explicit DB flag override the fallback default", async () => {
    process.env.CONSUMER_FREE_DEFAULT = "false";
    mocks.featureFlagFindUnique.mockResolvedValueOnce({ enabled: true });

    await expect(getConsumerFreeStatus()).resolves.toMatchObject({
      consumerFreeEnabled: true,
    });

    process.env.CONSUMER_FREE_DEFAULT = "true";
    mocks.featureFlagFindUnique.mockResolvedValueOnce({ enabled: false });

    await expect(getConsumerFreeStatus()).resolves.toMatchObject({
      consumerFreeEnabled: false,
    });
  });

  it("summarizes earned and pending affiliate revenue", async () => {
    mocks.affiliateConversionGroupBy.mockResolvedValue([
      { status: "APPROVED", _sum: { amountCents: 100 } },
      { status: "PAID", _sum: { amountCents: 250 } },
      { status: "PENDING", _sum: { amountCents: 75 } },
      { status: "REJECTED", _sum: { amountCents: 999 } },
    ]);

    await expect(getConsumerFreeStatus()).resolves.toMatchObject({
      affiliateEarnedCents: 350,
      affiliatePendingCents: 75,
    });
  });
});

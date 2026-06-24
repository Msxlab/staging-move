import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSUMER_FREE_FLAG } from "@locateflow/shared";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    featureFlag: { findMany: (...args: unknown[]) => mocks.findMany(...args) },
  },
}));

import { isFeatureEnabled, invalidateFlagCache } from "./feature-flags";

type Row = { name: string; enabled: boolean; targetType: string; targetValue?: string | null };

function setFlags(rows: Row[]) {
  mocks.findMany.mockResolvedValue(rows.map((r) => ({ targetValue: null, ...r })));
  invalidateFlagCache();
}

describe("isFeatureEnabled — CONSUMER_FREE master switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateFlagCache();
  });

  it("resolves an ENABLED CONSUMER_FREE row to ON for any targetType, read without context", async () => {
    // CONSUMER_FREE is the global truly-free master switch and is always read
    // WITHOUT per-user context. A non-ALL target must NOT collapse it to false —
    // that bug dropped every consumer back to the paid ladder (FREE_TRIAL) and
    // disabled PRO-gated features like addressValidation / provider serviceability.
    for (const targetType of ["ALL", "PERCENTAGE", "USER_LIST", "PLAN"]) {
      setFlags([
        {
          name: CONSUMER_FREE_FLAG,
          enabled: true,
          targetType,
          targetValue: '{"percentage":1,"userIds":[],"plans":[]}',
        },
      ]);
      expect(await isFeatureEnabled(CONSUMER_FREE_FLAG), `targetType=${targetType}`).toBe(true);
    }
  });

  it("still respects an explicitly DISABLED CONSUMER_FREE row", async () => {
    setFlags([{ name: CONSUMER_FREE_FLAG, enabled: false, targetType: "ALL" }]);
    expect(await isFeatureEnabled(CONSUMER_FREE_FLAG)).toBe(false);
  });

  it("does NOT make OTHER targeted flags global — they still need a matching context", async () => {
    setFlags([
      { name: "some_other_flag", enabled: true, targetType: "USER_LIST", targetValue: '{"userIds":["u1"]}' },
    ]);
    expect(await isFeatureEnabled("some_other_flag")).toBe(false);
    expect(await isFeatureEnabled("some_other_flag", { userId: "u1" })).toBe(true);
    expect(await isFeatureEnabled("some_other_flag", { userId: "nope" })).toBe(false);
  });
});

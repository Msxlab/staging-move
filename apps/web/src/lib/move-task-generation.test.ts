import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

import { buildMoveTaskIdempotencyKey } from "./move-task-generation";

const basePlan = {
  serviceId: "service-1",
  actionType: "SHOP_PROVIDER",
  destinationProviderCandidates: [],
} as any;

describe("move task idempotency keys", () => {
  it("includes normalized origin and destination states", () => {
    const njToTx = buildMoveTaskIdempotencyKey("plan-1", basePlan, {
      fromState: "nj",
      toState: "tx",
    });
    const njToNj = buildMoveTaskIdempotencyKey("plan-1", basePlan, {
      fromState: "NJ",
      toState: "NJ",
    });

    expect(njToTx).toContain(":NJ:TX");
    expect(njToNj).toContain(":NJ:NJ");
    expect(njToTx).not.toBe(njToNj);
  });

  it("keeps retry keys stable for the same route", () => {
    expect(
      buildMoveTaskIdempotencyKey("plan-1", basePlan, {
        fromState: " NJ ",
        toState: " TX ",
      }),
    ).toBe(
      buildMoveTaskIdempotencyKey("plan-1", basePlan, {
        fromState: "NJ",
        toState: "TX",
      }),
    );
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

import {
  buildMoveTaskDueDate,
  buildMoveTaskIdempotencyKey,
  buildChecklistTaskIdempotencyKey,
  buildChecklistProfile,
} from "./move-task-generation";

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

describe("move task due dates", () => {
  const moveDate = new Date("2026-06-30T12:00:00Z");
  const earlyNow = new Date("2026-05-01T12:00:00Z");

  it("assigns pre-move due dates by action urgency", () => {
    expect(buildMoveTaskDueDate(moveDate, "MAIL_FORWARDING", earlyNow)?.toISOString().slice(0, 10)).toBe("2026-06-16");
    expect(buildMoveTaskDueDate(moveDate, "VERIFY_AVAILABILITY", earlyNow)?.toISOString().slice(0, 10)).toBe("2026-06-09");
    expect(buildMoveTaskDueDate(moveDate, "UPDATE_ADDRESS", earlyNow)?.toISOString().slice(0, 10)).toBe("2026-06-23");
  });

  it("schedules government updates after the move date", () => {
    expect(buildMoveTaskDueDate(moveDate, "GOVERNMENT_UPDATE", earlyNow)?.toISOString().slice(0, 10)).toBe("2026-07-10");
  });

  it("keeps near-term pre-move tasks due today instead of in the past", () => {
    expect(buildMoveTaskDueDate(moveDate, "START_SERVICE", new Date("2026-06-28T12:00:00Z"))?.toISOString().slice(0, 10)).toBe("2026-06-28");
  });
});

describe("checklist task idempotency keys", () => {
  it("is stable per (plan, template, route) and distinct from classifier keys", () => {
    const a = buildChecklistTaskIdempotencyKey("plan-1", "P2_USCIS", { fromState: "nj", toState: "tx" });
    const b = buildChecklistTaskIdempotencyKey("plan-1", "P2_USCIS", { fromState: "NJ", toState: "TX" });
    const other = buildChecklistTaskIdempotencyKey("plan-1", "P3_DRIVERS_LICENSE", { fromState: "NJ", toState: "TX" });
    expect(a).toBe(b);
    expect(a).toContain("checklist-task:plan-1:P2_USCIS:NJ:TX");
    expect(a).not.toBe(other);
  });
});

describe("buildChecklistProfile", () => {
  it("promotes to MILITARY when isMilitary is set, regardless of moveType", () => {
    const profile = buildChecklistProfile({ isMilitary: true, moveType: "PERSONAL" });
    expect(profile.moveType).toBe("MILITARY");
  });

  it("defaults a null/unknown move type to PERSONAL", () => {
    expect(buildChecklistProfile(null).moveType).toBe("PERSONAL");
    expect(buildChecklistProfile({ moveType: "weird" }).moveType).toBe("PERSONAL");
  });

  it("preserves an explicit BUSINESS move type", () => {
    expect(buildChecklistProfile({ moveType: "BUSINESS" }).moveType).toBe("BUSINESS");
  });
});

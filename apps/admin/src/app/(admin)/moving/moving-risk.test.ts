import { describe, it, expect } from "vitest";
import { deriveMoveRisk, type RiskInputPlan } from "./moving-risk";

const NOW = new Date("2026-06-22T12:00:00.000Z");

function daysFromNow(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function plan(overrides: Partial<RiskInputPlan> = {}): RiskInputPlan {
  return {
    status: "PLANNING",
    moveDate: daysFromNow(60),
    moveTasks: [],
    // Default to having services so NO_SERVICES_TRACKED doesn't fire unless asked.
    fromAddress: { _count: { services: 1 } },
    toAddress: { _count: { services: 1 } },
    ...overrides,
  };
}

describe("deriveMoveRisk", () => {
  it("returns 'none' for a healthy far-out plan with tracked services and no open tasks", () => {
    const risk = deriveMoveRisk(plan(), NOW);
    expect(risk.level).toBe("none");
    expect(risk.reasons).toHaveLength(0);
  });

  it("excludes canceled and completed plans (never at risk)", () => {
    for (const status of ["CANCELED", "CANCELLED", "COMPLETED"]) {
      const risk = deriveMoveRisk(
        plan({ status, moveDate: daysFromNow(3), fromAddress: { _count: { services: 0 } }, toAddress: { _count: { services: 0 } } }),
        NOW,
      );
      expect(risk.level).toBe("none");
    }
  });

  it("ignores moves whose date has already passed", () => {
    const risk = deriveMoveRisk(
      plan({ moveDate: daysFromNow(-2), fromAddress: { _count: { services: 0 } }, toAddress: { _count: { services: 0 } } }),
      NOW,
    );
    expect(risk.level).toBe("none");
  });

  it("flags an overdue open task as high risk", () => {
    const risk = deriveMoveRisk(
      plan({
        moveDate: daysFromNow(20),
        moveTasks: [{ status: "IN_PROGRESS", dueDate: daysFromNow(-1) }],
      }),
      NOW,
    );
    expect(risk.level).toBe("high");
    expect(risk.reasons.map((r) => r.code)).toContain("OVERDUE_TASKS");
  });

  it("treats no tracked services as an elevated (medium) signal", () => {
    const risk = deriveMoveRisk(
      plan({
        moveDate: daysFromNow(60),
        fromAddress: { _count: { services: 0 } },
        toAddress: { _count: { services: 0 } },
      }),
      NOW,
    );
    expect(risk.level).toBe("elevated");
    expect(risk.reasons.map((r) => r.code)).toEqual(["NO_SERVICES_TRACKED"]);
  });

  it("an upcoming move with open tasks within the soon window is high", () => {
    const risk = deriveMoveRisk(
      plan({
        moveDate: daysFromNow(10),
        moveTasks: [
          { status: "COMPLETED", dueDate: null },
          { status: "SUGGESTED", dueDate: null },
        ],
      }),
      NOW,
    );
    expect(risk.level).toBe("high");
    const codes = risk.reasons.map((r) => r.code);
    expect(codes).toContain("INCOMPLETE_CHECKLIST");
    // 50% completion is NOT below the 0.5 threshold, so SOON_LOW_COMPLETENESS should not fire.
    expect(codes).not.toContain("SOON_LOW_COMPLETENESS");
  });

  it("a soon move with no checklist started counts as low completeness (high)", () => {
    const risk = deriveMoveRisk(
      plan({ moveDate: daysFromNow(5), moveTasks: [] }),
      NOW,
    );
    expect(risk.level).toBe("high");
    expect(risk.reasons.map((r) => r.code)).toContain("SOON_LOW_COMPLETENESS");
  });

  it("an upcoming-but-not-soon move with open tasks is only elevated", () => {
    const risk = deriveMoveRisk(
      plan({
        moveDate: daysFromNow(25),
        moveTasks: [
          { status: "COMPLETED", dueDate: null },
          { status: "COMPLETED", dueDate: null },
          { status: "SUGGESTED", dueDate: null },
        ],
      }),
      NOW,
    );
    // 25 days is within UPCOMING_WINDOW_DAYS (30) but outside SOON_WINDOW_DAYS (14).
    expect(risk.level).toBe("elevated");
    expect(risk.reasons.map((r) => r.code)).toContain("INCOMPLETE_CHECKLIST");
    expect(risk.reasons.find((r) => r.code === "INCOMPLETE_CHECKLIST")?.severity).toBe("medium");
  });
});

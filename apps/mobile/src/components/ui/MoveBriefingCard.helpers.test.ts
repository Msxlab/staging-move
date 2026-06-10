import { describe, expect, it } from "vitest";
import {
  BRIEFING_META_SENTINEL,
  normalizeBriefingTarget,
  parseBriefing,
  pickActivePlanId,
  resolveBriefingActionRoute,
  type BriefingActionTarget,
} from "./MoveBriefingCard.helpers";

const pack = (prose: string, meta: unknown) =>
  `${prose}\n${BRIEFING_META_SENTINEL}\n${JSON.stringify(meta)}`;

describe("normalizeBriefingTarget", () => {
  it("reads the current contract nested under `target`", () => {
    expect(
      normalizeBriefingTarget({ title: "x", why: "y", target: { kind: "category", category: "UTILITY_INTERNET" } }),
    ).toEqual({ kind: "category", category: "UTILITY_INTERNET" });
    expect(
      normalizeBriefingTarget({ target: { kind: "state_rule", state: "NJ", ruleKind: "dmv" } }),
    ).toEqual({ kind: "state_rule", state: "NJ", ruleKind: "dmv" });
    expect(normalizeBriefingTarget({ target: { kind: "plan" } })).toEqual({ kind: "plan" });
    expect(normalizeBriefingTarget({ target: { kind: "services" } })).toEqual({ kind: "services" });
  });

  it("reads the contract fields flattened onto the action", () => {
    expect(
      normalizeBriefingTarget({ title: "x", why: "y", kind: "category", category: "UTILITY_INTERNET" }),
    ).toEqual({ kind: "category", category: "UTILITY_INTERNET" });
    expect(normalizeBriefingTarget({ kind: "state_rule", state: "NJ" })).toEqual({
      kind: "state_rule",
      state: "NJ",
    });
  });

  it("maps the legacy deeplink shape (cached briefings)", () => {
    expect(
      normalizeBriefingTarget({ deeplink: { type: "category", category: "UTILITY_INTERNET" } }),
    ).toEqual({ kind: "category", category: "UTILITY_INTERNET" });
    expect(normalizeBriefingTarget({ deeplink: { type: "state-rules" } })).toEqual({
      kind: "state_rule",
    });
    expect(normalizeBriefingTarget({ deeplink: { type: "plan" } })).toEqual({ kind: "plan" });
    expect(normalizeBriefingTarget({ deeplink: { type: "services" } })).toEqual({ kind: "services" });
  });

  it("rejects category targets without a category key", () => {
    expect(normalizeBriefingTarget({ target: { kind: "category" } })).toBeNull();
    expect(normalizeBriefingTarget({ target: { kind: "category", category: "" } })).toBeNull();
    expect(normalizeBriefingTarget({ deeplink: { type: "category" } })).toBeNull();
  });

  it("drops non-string state/ruleKind extras instead of failing", () => {
    expect(normalizeBriefingTarget({ target: { kind: "state_rule", state: 7, ruleKind: null } })).toEqual({
      kind: "state_rule",
    });
  });

  it("returns null for junk", () => {
    expect(normalizeBriefingTarget(null)).toBeNull();
    expect(normalizeBriefingTarget("x")).toBeNull();
    expect(normalizeBriefingTarget({})).toBeNull();
    expect(normalizeBriefingTarget({ target: { kind: "teleport" } })).toBeNull();
  });
});

describe("parseBriefing", () => {
  it("renders prose-only payloads with no actions (legacy/plain text)", () => {
    const parsed = parseBriefing("You're planning your move.\nKeep everything in one place.");
    expect(parsed.proseLines).toEqual([
      "You're planning your move.",
      "Keep everything in one place.",
    ]);
    expect(parsed.actions).toEqual([]);
    expect(parsed.moveStage).toBeNull();
    expect(parsed.planId).toBeNull();
  });

  it("parses actions, stage, and planId from the meta tail", () => {
    const parsed = parseBriefing(
      pack("Prose line.", {
        actions: [
          { title: "Set up internet", why: "essential", target: { kind: "category", category: "UTILITY_INTERNET" } },
          { title: "Check NJ vehicle rules", why: "deadline", target: { kind: "state_rule", state: "NJ", ruleKind: "vehicle_registration" } },
          { title: "Open your plan", why: "dates", target: { kind: "plan" } },
        ],
        moveStage: "planning",
        planId: "plan_123",
      }),
    );
    expect(parsed.proseLines).toEqual(["Prose line."]);
    expect(parsed.actions).toHaveLength(3);
    expect(parsed.actions[0].target).toEqual({ kind: "category", category: "UTILITY_INTERNET" });
    expect(parsed.actions[1].target).toEqual({
      kind: "state_rule",
      state: "NJ",
      ruleKind: "vehicle_registration",
    });
    expect(parsed.moveStage).toBe("planning");
    expect(parsed.planId).toBe("plan_123");
  });

  it("still parses legacy deeplink actions", () => {
    const parsed = parseBriefing(
      pack("Prose.", {
        actions: [{ title: "t", why: "w", deeplink: { type: "state-rules" } }],
        moveStage: "in_progress",
      }),
    );
    expect(parsed.actions).toEqual([{ title: "t", why: "w", target: { kind: "state_rule" } }]);
    expect(parsed.moveStage).toBe("in_progress");
  });

  it("drops malformed actions individually and caps at 3", () => {
    const ok = { title: "t", why: "w", target: { kind: "services" } };
    const parsed = parseBriefing(
      pack("Prose.", {
        actions: [
          { title: "no why", target: { kind: "plan" } },
          { title: "t", why: "w" }, // target-less → dropped (current behavior)
          ok,
          ok,
          ok,
          ok,
        ],
      }),
    );
    expect(parsed.actions).toHaveLength(3);
    expect(parsed.actions.every((a) => a.target.kind === "services")).toBe(true);
  });

  it("survives a malformed JSON tail (prose still renders — card never blanks)", () => {
    const parsed = parseBriefing(`Prose.\n${BRIEFING_META_SENTINEL}\n{not json`);
    expect(parsed.proseLines).toEqual(["Prose."]);
    expect(parsed.actions).toEqual([]);
  });

  it("filters numbered fallback action lines out of the prose", () => {
    const parsed = parseBriefing("Summary.\n1. Do a thing — because.\n2. Another — reason.");
    expect(parsed.proseLines).toEqual(["Summary."]);
  });

  it("ignores invalid moveStage / planId values", () => {
    const parsed = parseBriefing(pack("P.", { moveStage: "warp", planId: 42 }));
    expect(parsed.moveStage).toBeNull();
    expect(parsed.planId).toBeNull();
  });
});

describe("resolveBriefingActionRoute", () => {
  it("routes category actions to the add-services BROWSE landing with the category preselected (no manual mode)", () => {
    const route = resolveBriefingActionRoute(
      { kind: "category", category: "UTILITY_INTERNET" },
      null,
    );
    expect(route).toEqual({
      pathname: "/services/new",
      params: { category: "UTILITY_INTERNET" },
    });
    // Regression guard for the owner complaint: the CTA must NOT land on the
    // manual-entry form.
    expect((route as { params: Record<string, string> }).params.mode).toBeUndefined();
  });

  it("routes state_rule actions to the active plan detail (state rules live there)", () => {
    expect(
      resolveBriefingActionRoute({ kind: "state_rule", state: "NJ", ruleKind: "vehicle_registration" }, "plan_1"),
    ).toEqual({ pathname: "/moving/[id]", params: { id: "plan_1" } });
  });

  it("falls back to the Move tab when no active plan is resolvable", () => {
    expect(resolveBriefingActionRoute({ kind: "state_rule" }, null)).toEqual({
      pathname: "/(tabs)/moving",
    });
    expect(resolveBriefingActionRoute({ kind: "plan" }, null)).toEqual({
      pathname: "/(tabs)/moving",
    });
  });

  it("routes plan actions to the plan detail when the id is known", () => {
    expect(resolveBriefingActionRoute({ kind: "plan" }, "plan_9")).toEqual({
      pathname: "/moving/[id]",
      params: { id: "plan_9" },
    });
  });

  it("routes services actions to the services tab", () => {
    expect(resolveBriefingActionRoute({ kind: "services" }, "plan_9")).toEqual({
      pathname: "/(tabs)/services",
    });
  });

  it("covers every target kind (exhaustiveness)", () => {
    const targets: BriefingActionTarget[] = [
      { kind: "category", category: "X" },
      { kind: "state_rule" },
      { kind: "plan" },
      { kind: "services" },
    ];
    for (const target of targets) {
      expect(resolveBriefingActionRoute(target, "p1").pathname).toBeTruthy();
    }
  });
});

describe("pickActivePlanId", () => {
  it("prefers an IN_PROGRESS plan over a PLANNING one", () => {
    expect(
      pickActivePlanId([
        { id: "a", status: "PLANNING" },
        { id: "b", status: "IN_PROGRESS" },
      ]),
    ).toBe("b");
  });

  it("falls back to the first PLANNING plan", () => {
    expect(
      pickActivePlanId([
        { id: "done", status: "COMPLETED" },
        { id: "a", status: "PLANNING" },
        { id: "z", status: "PLANNING" },
      ]),
    ).toBe("a");
  });

  it("never matches completed or canceled plans", () => {
    expect(
      pickActivePlanId([
        { id: "x", status: "COMPLETED" },
        { id: "y", status: "CANCELED" },
        { id: "z", status: "CANCELLED" },
      ]),
    ).toBeNull();
  });

  it("is case-insensitive on status", () => {
    expect(pickActivePlanId([{ id: "a", status: "in_progress" }])).toBe("a");
  });

  it("tolerates junk input", () => {
    expect(pickActivePlanId(null)).toBeNull();
    expect(pickActivePlanId("plans")).toBeNull();
    expect(pickActivePlanId([null, 4, { id: 1, status: "PLANNING" }, { id: "ok" }])).toBeNull();
  });
});

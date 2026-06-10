import { describe, expect, it } from "vitest";
import {
  BRIEFING_META_SENTINEL,
  buildBriefingActions,
  buildBriefingSignals,
  buildFallbackBriefing,
  encodeBriefingString,
  type BriefingAction,
  type BriefingSignals,
} from "./onboarding-briefing";

/** A fully-populated signal set tests can override per-case. */
function makeSignals(overrides: Partial<BriefingSignals> = {}): BriefingSignals {
  return {
    hasKids: false,
    hasPets: false,
    carCount: 0,
    hasSenior: false,
    isBusiness: false,
    isMilitary: false,
    needsStorage: false,
    housing: "other",
    state: null,
    moveType: "PERSONAL",
    moveStage: "planning",
    hasMoveDate: false,
    daysToMoveBucket: "unknown",
    missingCriticalCount: 0,
    missingCriticalLabels: [],
    missingCriticalCategories: [],
    ...overrides,
  };
}

const TARGET_KINDS = ["category", "state_rule", "plan", "services"] as const;

function expectValidTarget(action: BriefingAction) {
  expect(action.target).toBeDefined();
  expect(TARGET_KINDS).toContain(action.target.kind);
  if (action.target.kind === "category") {
    expect(typeof action.target.category).toBe("string");
    expect(action.target.category.length).toBeGreaterThan(0);
  }
  if (action.target.kind === "state_rule") {
    expect(action.target.state).toMatch(/^[A-Z]{2}$/);
    expect(["dmv", "voter", "tax"]).toContain(action.target.ruleKind);
  }
}

describe("buildBriefingActions — structured targets", () => {
  it("every action carries BOTH a legacy deeplink and a machine-readable target", () => {
    const actions = buildBriefingActions(
      makeSignals({
        hasKids: true,
        carCount: 2,
        state: "NJ",
        housing: "rent",
        missingCriticalLabels: ["Internet"],
        missingCriticalCategories: ["UTILITY_INTERNET"],
        missingCriticalCount: 1,
      }),
    );
    expect(actions.length).toBe(3);
    for (const action of actions) {
      // Backwards compatibility: old clients keep reading title + deeplink.
      expect(typeof action.title).toBe("string");
      expect(action.deeplink).toBeDefined();
      expectValidTarget(action);
    }
  });

  it("pending essentials map to a category target carrying the catalog key", () => {
    const actions = buildBriefingActions(
      makeSignals({
        missingCriticalLabels: ["Internet", "Electric"],
        missingCriticalCategories: ["UTILITY_INTERNET", "UTILITY_ELECTRIC"],
        missingCriticalCount: 2,
      }),
    );
    expect(actions[0].target).toEqual({ kind: "category", category: "UTILITY_INTERNET" });
    expect(actions[0].deeplink).toEqual({ type: "category", category: "UTILITY_INTERNET" });
    expect(actions[1].target).toEqual({ kind: "category", category: "UTILITY_ELECTRIC" });
  });

  it("vehicles + known state map to a state_rule target with state and ruleKind=dmv", () => {
    const actions = buildBriefingActions(makeSignals({ carCount: 1, state: "NJ" }));
    const stateRule = actions.find((a) => a.target.kind === "state_rule");
    expect(stateRule).toBeDefined();
    expect(stateRule!.target).toEqual({ kind: "state_rule", state: "NJ", ruleKind: "dmv" });
    // Legacy deeplink stays intact for old clients.
    expect(stateRule!.deeplink).toEqual({ type: "state-rules" });
  });

  it("never emits a state_rule target without a known state", () => {
    const actions = buildBriefingActions(makeSignals({ carCount: 3, state: null }));
    expect(actions.some((a) => a.target.kind === "state_rule")).toBe(false);
  });

  it("plan-bound actions carry a plan target (renter date confirmation)", () => {
    const actions = buildBriefingActions(makeSignals({ housing: "rent" }));
    const plan = actions.find((a) => a.deeplink.type === "plan");
    expect(plan).toBeDefined();
    expect(plan!.target).toEqual({ kind: "plan" });
  });

  it("default filler actions also carry targets (services/plan)", () => {
    const actions = buildBriefingActions(makeSignals());
    expect(actions.length).toBe(3);
    for (const action of actions) expectValidTarget(action);
    expect(actions.some((a) => a.target.kind === "services")).toBe(true);
    expect(actions.some((a) => a.target.kind === "plan")).toBe(true);
  });
});

describe("encodeBriefingString — targets survive the meta tail", () => {
  it("round-trips actions (with targets) through the sentinel-encoded string", () => {
    const signals = makeSignals({
      carCount: 1,
      state: "CA",
      missingCriticalLabels: ["Internet"],
      missingCriticalCategories: ["UTILITY_INTERNET"],
      missingCriticalCount: 1,
    });
    const actions = buildBriefingActions(signals);
    const encoded = encodeBriefingString({
      briefing: "You're planning your move.",
      actions,
      moveStage: signals.moveStage,
      daysToMoveBucket: signals.daysToMoveBucket,
    });

    const idx = encoded.indexOf(BRIEFING_META_SENTINEL);
    expect(idx).toBeGreaterThan(0);
    // Prose stays the leading, readable content for legacy consumers.
    expect(encoded.slice(0, idx)).toContain("You're planning your move.");

    const meta = JSON.parse(encoded.slice(idx + BRIEFING_META_SENTINEL.length).trim());
    expect(Array.isArray(meta.actions)).toBe(true);
    expect(meta.actions[0].target).toEqual({ kind: "category", category: "UTILITY_INTERNET" });
    const stateRule = meta.actions.find(
      (a: BriefingAction) => a.target?.kind === "state_rule",
    );
    expect(stateRule.target).toEqual({ kind: "state_rule", state: "CA", ruleKind: "dmv" });
  });
});

describe("buildFallbackBriefing — rule-based path keeps actions honest", () => {
  it("renders the summary plus the same deterministic actions inline", () => {
    const signals = makeSignals({
      state: "TX",
      missingCriticalLabels: ["Internet"],
      missingCriticalCategories: ["UTILITY_INTERNET"],
      missingCriticalCount: 1,
    });
    const text = buildFallbackBriefing(signals);
    expect(text).toContain("TX");
    expect(text).toContain("1. Set up internet");
  });
});

describe("buildBriefingSignals — categories ride alongside labels", () => {
  it("keeps category keys index-aligned with labels", () => {
    const signals = buildBriefingSignals({
      profile: { carCount: 1 },
      primaryAddress: { state: "NJ", ownership: "RENTER" },
      activePlan: null,
      missingCritical: [
        { category: "UTILITY_INTERNET", label: "Internet" },
        { category: "UTILITY_ELECTRIC", label: "Electric" },
      ],
    });
    expect(signals.missingCriticalLabels).toEqual(["Internet", "Electric"]);
    expect(signals.missingCriticalCategories).toEqual([
      "UTILITY_INTERNET",
      "UTILITY_ELECTRIC",
    ]);
  });
});

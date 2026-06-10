import { describe, expect, it, vi } from "vitest";

// The card module imports lucide-react and next/link at module scope; stub
// them so importing the pure helpers never depends on renderer internals
// (same pattern as home-dossier.test.tsx).
vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Stub = (props: { className?: string }) => <svg data-lucide={name} className={props.className} />;
    Stub.displayName = name;
    return Stub;
  };
  return { Sparkles: icon("sparkles"), X: icon("x"), ChevronRight: icon("chevron-right") };
});
vi.mock("next/link", () => ({
  default: ({ children }: { children?: unknown }) => children as never,
}));

import {
  actionHref,
  parseBriefing,
  type BriefingAction,
} from "./move-briefing-card";

const SENTINEL = "<<<LF_BRIEFING_META>>>";

function encode(prose: string, meta: unknown): string {
  return `${prose}\n${SENTINEL}\n${JSON.stringify(meta)}`;
}

describe("actionHref — structured target mapping per kind", () => {
  const base = { title: "t", why: "w" };

  it("category target routes to the add-service flow with the category preselected", () => {
    const action: BriefingAction = {
      ...base,
      target: { kind: "category", category: "UTILITY_INTERNET" },
    };
    expect(actionHref(action)).toBe("/services/new?category=UTILITY_INTERNET");
  });

  it("URL-encodes the category value", () => {
    const action: BriefingAction = {
      ...base,
      target: { kind: "category", category: "A B&C" },
    };
    expect(actionHref(action)).toBe("/services/new?category=A%20B%26C");
  });

  it("state_rule target routes to the move plan area (with or without a state)", () => {
    expect(actionHref({ ...base, target: { kind: "state_rule", state: "NJ" } })).toBe("/moving");
    expect(actionHref({ ...base, target: { kind: "state_rule" } })).toBe("/moving");
  });

  it("plan target routes to the move plan area", () => {
    expect(actionHref({ ...base, target: { kind: "plan" } })).toBe("/moving");
  });

  it("prefers the structured target over a legacy deeplink when both are present", () => {
    const action: BriefingAction = {
      ...base,
      target: { kind: "category", category: "UTILITY_ELECTRIC" },
      deeplink: { type: "services" },
    };
    expect(actionHref(action)).toBe("/services/new?category=UTILITY_ELECTRIC");
  });

  it("falls back to the legacy deeplink when the target is invalid", () => {
    const action = {
      ...base,
      target: { kind: "category", category: "  " }, // blank category → invalid
      deeplink: { type: "plan" },
    } as unknown as BriefingAction;
    expect(actionHref(action)).toBe("/moving");
  });

  it("keeps today's behavior for legacy deeplink-only actions", () => {
    expect(
      actionHref({ ...base, deeplink: { type: "category", category: "UTILITY_INTERNET" } }),
    ).toBe("/services/new?category=UTILITY_INTERNET");
    expect(actionHref({ ...base, deeplink: { type: "services" } })).toBe("/services");
    expect(actionHref({ ...base, deeplink: { type: "state-rules" } })).toBe("/moving");
    expect(actionHref({ ...base, deeplink: { type: "plan" } })).toBe("/moving");
  });

  it("returns a safe neutral destination when neither target nor deeplink resolves", () => {
    expect(actionHref(base as BriefingAction)).toBe("/services");
  });
});

describe("parseBriefing — structured-target actions", () => {
  it("accepts target-only actions (the new API contract)", () => {
    const raw = encode("Hello there.", {
      moveStage: "planning",
      actions: [
        {
          title: "Set up internet",
          why: "essential",
          target: { kind: "category", category: "UTILITY_INTERNET" },
        },
        {
          title: "Check vehicle registration rules for NJ",
          why: "state rules vary",
          target: { kind: "state_rule", state: "NJ" },
        },
      ],
    });
    const parsed = parseBriefing(raw);
    expect(parsed.moveStage).toBe("planning");
    expect(parsed.actions).toHaveLength(2);
    expect(actionHref(parsed.actions[0])).toBe("/services/new?category=UTILITY_INTERNET");
    expect(actionHref(parsed.actions[1])).toBe("/moving");
  });

  it("keeps legacy deeplink-only actions (older cached briefings)", () => {
    const raw = encode("Prose.", {
      moveStage: "in_progress",
      actions: [{ title: "List services", why: "w", deeplink: { type: "services" } }],
    });
    const parsed = parseBriefing(raw);
    expect(parsed.actions).toHaveLength(1);
    expect(actionHref(parsed.actions[0])).toBe("/services");
  });

  it("drops actions with neither a valid target nor a valid deeplink", () => {
    const raw = encode("Prose.", {
      actions: [
        { title: "no destination", why: "w" },
        { title: "bad target kind", why: "w", target: { kind: "teleport" } },
        { title: "bad deeplink", why: "w", deeplink: { type: "nope" } },
        { title: "ok", why: "w", target: { kind: "plan" } },
        42,
        null,
      ],
    });
    const parsed = parseBriefing(raw);
    expect(parsed.actions).toHaveLength(1);
    expect(parsed.actions[0].title).toBe("ok");
  });

  it("caps actions at 3", () => {
    const raw = encode("Prose.", {
      actions: Array.from({ length: 5 }, (_v, i) => ({
        title: `a${i}`,
        why: "w",
        target: { kind: "plan" },
      })),
    });
    expect(parseBriefing(raw).actions).toHaveLength(3);
  });

  it("degrades to prose-only on a malformed JSON tail (card never blanks out)", () => {
    const parsed = parseBriefing(`Just prose.\n${SENTINEL}\n{not json`);
    expect(parsed.proseLines).toEqual(["Just prose."]);
    expect(parsed.actions).toEqual([]);
    expect(parsed.moveStage).toBeNull();
  });

  it("strips numbered fallback lines from prose and tolerates a missing sentinel", () => {
    const parsed = parseBriefing("Summary line.\n1. embedded action — why");
    expect(parsed.proseLines).toEqual(["Summary line."]);
    expect(parsed.actions).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
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
// next/link → plain anchor so the teaser CTA href is assertable without a router.
vi.mock("next/link", () => ({
  default: ({ href, children, className, onClick }: { href?: string; children?: unknown; className?: string; onClick?: () => void }) => (
    <a href={href} className={className} onClick={onClick}>
      {children as never}
    </a>
  ),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

// Resolve translations from the REAL en.json catalog so the teaser tests pin
// the shipped copy — a catalog regression fails here, not just in review.
vi.mock("next-intl", async () => {
  const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<
    string,
    Record<string, string>
  >;
  const resolve = (key: string): string => {
    const raw = en.dashboard?.[key];
    if (typeof raw !== "string") throw new Error(`Missing dashboard.${key} in en.json`);
    return raw;
  };
  const useTranslations = () => {
    const t = (key: string, vars?: Record<string, unknown>) =>
      resolve(key).replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
    return t;
  };
  return { useTranslations, useLocale: () => "en-US" };
});

import {
  actionHref,
  briefingActionTelemetryType,
  briefingProvenanceLabel,
  briefingTelemetryForState,
  deriveBriefingState,
  fallbackBriefingStateForExperience,
  MoveBriefingProvenance,
  MoveBriefingTeaser,
  MoveBriefingTrustFooter,
  parseBriefing,
  shouldShowBriefingForStage,
  type BriefingAction,
} from "./move-briefing-card";
import { MOVE_BRIEFING_NOT_ADVICE_COPY } from "@locateflow/shared";

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

describe("deriveBriefingState — GATE-API plan gate (entitled:false, HTTP 200)", () => {
  it("hides when configured:false (key absent) — even if a gate code is attached", () => {
    expect(deriveBriefingState({ configured: false })).toEqual({ kind: "hidden" });
    expect(deriveBriefingState({ configured: false, entitled: false, upgradeRequired: true })).toEqual({
      kind: "hidden",
    });
  });

  it("teases when configured and entitled:false (gated payload has no briefing text)", () => {
    expect(
      deriveBriefingState({
        configured: true,
        entitled: false,
        upgradeRequired: true,
        code: "BRIEFING_UPGRADE_REQUIRED",
      }),
    ).toEqual({ kind: "teaser" });
  });

  it("teases on a truthy upgradeRequired signal too", () => {
    expect(deriveBriefingState({ configured: true, upgradeRequired: true })).toEqual({ kind: "teaser" });
  });

  it("teaser wins over briefing text if a gated payload ever carried both", () => {
    expect(deriveBriefingState({ configured: true, entitled: false, briefing: "leak" })).toEqual({
      kind: "teaser",
    });
  });

  it("keeps the entitled path unchanged — legacy payload without an entitled field", () => {
    expect(deriveBriefingState({ configured: true, briefing: "Hi.", aiGenerated: true })).toEqual({
      kind: "briefing",
      briefing: "Hi.",
      aiGenerated: true,
    });
  });

  it("keeps the entitled path unchanged — explicit entitled:true", () => {
    expect(deriveBriefingState({ configured: true, entitled: true, briefing: "Hi.", aiGenerated: false })).toEqual({
      kind: "briefing",
      briefing: "Hi.",
      aiGenerated: false,
    });
  });

  it("hides on malformed payloads (null / non-object / configured without briefing)", () => {
    expect(deriveBriefingState(null)).toEqual({ kind: "hidden" });
    expect(deriveBriefingState("nope")).toEqual({ kind: "hidden" });
    expect(deriveBriefingState({ configured: true })).toEqual({ kind: "hidden" });
    expect(deriveBriefingState({ configured: true, briefing: 42 })).toEqual({ kind: "hidden" });
  });
});

describe("deriveBriefingState - ux_ai_briefing_experience_v1 variant", () => {
  it("keeps flag-off control behavior unchanged", () => {
    expect(fallbackBriefingStateForExperience("control")).toEqual({ kind: "hidden" });
    expect(deriveBriefingState({ configured: false }, "control")).toEqual({ kind: "hidden" });
    expect(deriveBriefingState({ configured: true }, "control")).toEqual({ kind: "hidden" });
  });

  it("renders a rule-based fallback instead of hidden when the AI path is unavailable", () => {
    for (const payload of [null, { configured: false }, { configured: true }, { configured: true, briefing: 42 }]) {
      const state = deriveBriefingState(payload, "variant");
      expect(state.kind).toBe("briefing");
      if (state.kind === "briefing") {
        expect(state.aiGenerated).toBe(false);
        expect(parseBriefing(state.briefing).proseLines[0]).toContain("move command center");
      }
    }
  });

  it("still renders the existing gated teaser under the variant", () => {
    expect(deriveBriefingState({ configured: true, entitled: false }, "variant")).toEqual({ kind: "teaser" });
    expect(deriveBriefingState({ configured: true, upgradeRequired: true }, "variant")).toEqual({ kind: "teaser" });
  });

  it("re-shows after a move-stage change but not for the same dismissed stage", () => {
    expect(
      shouldShowBriefingForStage({
        variant: "variant",
        moveStage: "planning",
        seenStage: null,
        dismissedStage: "planning",
      }),
    ).toBe(false);
    expect(
      shouldShowBriefingForStage({
        variant: "variant",
        moveStage: "in_progress",
        seenStage: null,
        dismissedStage: "planning",
      }),
    ).toBe(true);
    expect(
      shouldShowBriefingForStage({
        variant: "control",
        moveStage: "in_progress",
        seenStage: null,
        sessionDismissed: true,
      }),
    ).toBe(false);
  });
});

describe("briefing telemetry helpers", () => {
  it("classifies visible, fallback, gated, empty, and hidden briefing states", () => {
    expect(briefingTelemetryForState({ kind: "hidden" })).toEqual({
      briefingState: "hidden",
      briefingMode: "unknown",
    });
    expect(briefingTelemetryForState({ kind: "teaser" })).toEqual({
      briefingState: "teaser",
      briefingMode: "gated_teaser",
    });
    expect(briefingTelemetryForState({ kind: "briefing", briefing: "AI prose", aiGenerated: true })).toEqual({
      briefingState: "content",
      briefingMode: "ai_generated",
    });
    expect(briefingTelemetryForState({ kind: "briefing", briefing: "Rule prose", aiGenerated: false })).toEqual({
      briefingState: "fallback",
      briefingMode: "rule_based",
    });
    expect(briefingTelemetryForState({ kind: "briefing", briefing: "", aiGenerated: false })).toEqual({
      briefingState: "empty",
      briefingMode: "rule_based",
    });
  });

  it("classifies briefing actions into closed analytics buckets", () => {
    expect(briefingActionTelemetryType({ title: "t", why: "w", target: { kind: "category", category: "UTILITY_INTERNET" } })).toBe("service_category");
    expect(briefingActionTelemetryType({ title: "t", why: "w", target: { kind: "state_rule", state: "NJ" } })).toBe("state_rule");
    expect(briefingActionTelemetryType({ title: "t", why: "w", target: { kind: "plan" } })).toBe("plan");
    expect(briefingActionTelemetryType({ title: "t", why: "w", deeplink: { type: "services" } })).toBe("services");
    expect(briefingActionTelemetryType({ title: "t", why: "w" } as BriefingAction)).toBe("unknown");
  });
});

describe("MoveBriefingTeaser rendering", () => {
  it("renders the honest pitch, a CSS-only blurred strip (no readable fake text), and the /pricing CTA", () => {
    const markup = renderToStaticMarkup(<MoveBriefingTeaser />);

    // Card chrome + 2-line pitch from the real catalog
    expect(markup).toContain("Your move briefing");
    expect(markup).toContain("Your personalized AI move plan — written for your exact situation.");
    expect(markup).toContain("A plain-English read on where your move stands, plus your top three next actions.");

    // Blurred preview strip is pure CSS (aria-hidden, blur class) with no text
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("blur-[2px]");

    // CTA → /pricing
    expect(markup).toContain('href="/pricing"');
    expect(markup).toContain("Unlock with Family");
  });

  it("shows the dismiss affordance only when a handler is provided", () => {
    expect(renderToStaticMarkup(<MoveBriefingTeaser />)).not.toContain("Dismiss briefing");
    expect(renderToStaticMarkup(<MoveBriefingTeaser onDismiss={() => {}} />)).toContain("Dismiss briefing");
  });
});

describe("ux_trust_copy_v1 briefing provenance and footer", () => {
  it("keeps flag-off provenance behavior unchanged", () => {
    expect(briefingProvenanceLabel(true, "control")).toBe("AI-generated");
    expect(briefingProvenanceLabel(false, "control")).toBeNull();
    expect(renderToStaticMarkup(<MoveBriefingProvenance aiGenerated={false} uxTrustCopyVariant="control" />)).toBe("");
    expect(renderToStaticMarkup(<MoveBriefingTrustFooter uxTrustCopyVariant="control" />)).toBe("");
  });

  it("renders provenance and the not-advice footer for AI and rule-based states under the variant", () => {
    const aiMarkup = renderToStaticMarkup(
      <>
        <MoveBriefingProvenance aiGenerated uxTrustCopyVariant="variant" />
        <MoveBriefingTrustFooter uxTrustCopyVariant="variant" />
      </>,
    );
    const ruleMarkup = renderToStaticMarkup(
      <>
        <MoveBriefingProvenance aiGenerated={false} uxTrustCopyVariant="variant" />
        <MoveBriefingTrustFooter uxTrustCopyVariant="variant" />
      </>,
    );

    expect(aiMarkup).toContain("AI-generated");
    expect(ruleMarkup).toContain("Rule-based");
    expect(aiMarkup).toContain(MOVE_BRIEFING_NOT_ADVICE_COPY);
    expect(ruleMarkup).toContain(MOVE_BRIEFING_NOT_ADVICE_COPY);
  });

  it("does not add blocked trust phrases to briefing trust copy", () => {
    const markup = renderToStaticMarkup(
      <>
        <MoveBriefingProvenance aiGenerated={false} uxTrustCopyVariant="variant" />
        <MoveBriefingTrustFooter uxTrustCopyVariant="variant" />
      </>,
    ).toLowerCase();

    for (const phrase of ["auto-sync", "verified sync", "official partner", "official USPS", "provider offer"]) {
      expect(markup).not.toContain(phrase.toLowerCase());
    }
  });
});

describe("teaser catalog parity (en/es)", () => {
  it("keeps the en/es briefing+dossier teaser keys in parity", () => {
    const cwd = process.cwd();
    const webRoot = cwd.endsWith(`${path.sep}apps${path.sep}web`) ? cwd : path.join(cwd, "apps", "web");
    const read = (file: string) =>
      JSON.parse(readFileSync(path.join(webRoot, "src", "i18n", "messages", file), "utf8")) as Record<
        string,
        Record<string, string>
      >;
    const en = read("en.json");
    const es = read("es.json");
    const teaserKeys = (cat: Record<string, Record<string, string>>) =>
      Object.keys(cat.dashboard).filter((k) => k.startsWith("briefing_teaser_") || k.startsWith("dossier_teaser_"));
    expect(teaserKeys(en).sort()).toEqual(teaserKeys(es).sort());
    // 5 briefing + 11 dossier teaser keys (pitch + 9 row subs + cta) must exist.
    expect(teaserKeys(en)).toHaveLength(16);
  });
});

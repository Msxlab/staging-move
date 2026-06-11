import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// lucide-react ships its own nested React copy which breaks under the node
// test environment's single-React aliasing — stub the icons.
vi.mock("lucide-react", () => {
  const stub = (name: string) => {
    function Icon(props: Record<string, unknown>) {
      return <svg data-lucide={name} {...props} />;
    }
    Icon.displayName = name;
    return Icon;
  };
  return {
    Sparkles: stub("sparkles"),
    X: stub("x"),
  };
});

import {
  COACH_COLLAPSED_STORAGE_KEY,
  COACH_STEP_COPY_KEYS,
  ObCoach,
  readCoachCollapsed,
  writeCoachCollapsed,
  type CoachStorage,
} from "./ob-coach";

function fakeStorage(initial: Record<string, string> = {}): CoachStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const baseProps = {
  eyebrow: "Why this matters",
  text: "A precise address unlocks address-level provider checks.",
  onDismiss: () => {},
  onReopen: () => {},
  dismissLabel: "Hide this tip",
  reopenLabel: "Why this matters",
};

describe("ObCoach", () => {
  it("renders the open explainer with eyebrow, copy, and a labelled dismiss control", () => {
    const markup = renderToStaticMarkup(<ObCoach {...baseProps} collapsed={false} />);
    expect(markup).toContain("ob-coach");
    expect(markup).toContain("Why this matters");
    expect(markup).toContain("A precise address unlocks address-level provider checks.");
    expect(markup).toContain('aria-label="Hide this tip"');
    expect(markup).toContain("ob-coach-line");
  });

  it("collapses to the small \"!\" badge that reopens it", () => {
    const markup = renderToStaticMarkup(<ObCoach {...baseProps} collapsed={true} />);
    expect(markup).toContain("ob-coach-mini");
    expect(markup).toContain(">!<");
    expect(markup).toContain("Why this matters");
    // The full explainer body is gone while collapsed.
    expect(markup).not.toContain(
      "A precise address unlocks address-level provider checks.",
    );
  });
});

describe("coach collapse persistence", () => {
  it("defaults to open (not collapsed) on a first onboarding", () => {
    expect(readCoachCollapsed(fakeStorage())).toBe(false);
  });

  it("round-trips the collapsed preference through storage", () => {
    const storage = fakeStorage();
    writeCoachCollapsed(true, storage);
    expect(storage.data[COACH_COLLAPSED_STORAGE_KEY]).toBe("1");
    expect(readCoachCollapsed(storage)).toBe(true);

    writeCoachCollapsed(false, storage);
    expect(readCoachCollapsed(storage)).toBe(false);
  });

  it("ignores unknown stored values", () => {
    expect(
      readCoachCollapsed(fakeStorage({ [COACH_COLLAPSED_STORAGE_KEY]: "banana" })),
    ).toBe(false);
  });

  it("tolerates missing storage (SSR / blocked localStorage)", () => {
    expect(readCoachCollapsed(null)).toBe(false);
    expect(() => writeCoachCollapsed(true, null)).not.toThrow();
  });

  it("tolerates throwing storage (privacy mode quota errors)", () => {
    const throwing: CoachStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readCoachCollapsed(throwing)).toBe(false);
    expect(() => writeCoachCollapsed(true, throwing)).not.toThrow();
  });
});

describe("COACH_STEP_COPY_KEYS", () => {
  it("covers every wizard step exactly once", () => {
    expect(Object.keys(COACH_STEP_COPY_KEYS)).toEqual([
      "profile",
      "address",
      "providers",
      "moving",
    ]);
  });

  it("maps each step to a coach_* message key", () => {
    for (const key of Object.values(COACH_STEP_COPY_KEYS)) {
      expect(key).toMatch(/^coach_/);
    }
  });
});

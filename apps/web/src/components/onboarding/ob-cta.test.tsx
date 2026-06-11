import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// lucide-react ships its own nested React copy which breaks under the node
// test environment's single-React aliasing — stub the icons (the tests assert
// the marker classes the component places on them, not lucide internals).
vi.mock("lucide-react", () => {
  const stub = (name: string) => {
    function Icon(props: Record<string, unknown>) {
      return <svg data-lucide={name} {...props} />;
    }
    Icon.displayName = name;
    return Icon;
  };
  return {
    ArrowLeft: stub("arrow-left"),
    ArrowRight: stub("arrow-right"),
    Loader2: stub("loader-2"),
    Lock: stub("lock"),
  };
});

import { ObCta, getObCtaClassName } from "./ob-cta";

describe("getObCtaClassName", () => {
  it("builds the variant class plus state modifiers", () => {
    expect(getObCtaClassName("primary")).toBe("ob-cta ob-cta--primary");
    expect(getObCtaClassName("back")).toBe("ob-cta ob-cta--back");
    expect(getObCtaClassName("skip")).toBe("ob-cta ob-cta--skip");
    expect(getObCtaClassName("primary", { locked: true })).toContain("ob-cta-locked");
    expect(getObCtaClassName("primary", { loading: true })).toContain("ob-cta-loading");
    expect(getObCtaClassName("primary", { className: "w-full" })).toContain("w-full");
  });
});

describe("ObCta", () => {
  it("renders the primary variant with label and trailing arrow", () => {
    const markup = renderToStaticMarkup(<ObCta>Continue</ObCta>);
    expect(markup).toContain("ob-cta--primary");
    expect(markup).toContain("Continue");
    expect(markup).toContain("ob-cta-arrow");
    expect(markup).not.toContain("disabled");
  });

  it("omits the arrow when arrow={false}", () => {
    const markup = renderToStaticMarkup(<ObCta arrow={false}>Continue</ObCta>);
    expect(markup).not.toContain("ob-cta-arrow");
  });

  it("renders the back variant as a quiet ghost with a leading arrow", () => {
    const markup = renderToStaticMarkup(<ObCta variant="back">Back</ObCta>);
    expect(markup).toContain("ob-cta--back");
    expect(markup).toContain("ob-cta-arrow-back");
    expect(markup).toContain("Back");
  });

  it("can drop the back arrow for non-directional quiet actions", () => {
    const markup = renderToStaticMarkup(
      <ObCta variant="back" backArrow={false}>Cancel</ObCta>,
    );
    expect(markup).toContain("ob-cta--back");
    expect(markup).not.toContain("ob-cta-arrow-back");
  });

  it("renders the skip variant", () => {
    const markup = renderToStaticMarkup(<ObCta variant="skip">Skip</ObCta>);
    expect(markup).toContain("ob-cta--skip");
    expect(markup).toContain("Skip");
  });

  it("renders the REAL disabled state: hint as label, lock, no arrow, no opacity hack", () => {
    const markup = renderToStaticMarkup(
      <ObCta disabled disabledHint="Accept the legal terms to continue">
        Continue
      </ObCta>,
    );
    expect(markup).toContain("disabled");
    expect(markup).toContain("ob-cta-locked");
    expect(markup).toContain("Accept the legal terms to continue");
    // The hint REPLACES the label — the original label is not duplicated.
    expect(markup).not.toContain(">Continue<");
    expect(markup).not.toContain("ob-cta-arrow");
    // No opacity hack anywhere in the disabled presentation.
    expect(markup).not.toContain("opacity-50");
  });

  it("keeps the original label when disabled without a hint", () => {
    const markup = renderToStaticMarkup(<ObCta disabled>Continue</ObCta>);
    expect(markup).toContain("disabled");
    expect(markup).toContain("ob-cta-locked");
    expect(markup).toContain("Continue");
  });

  it("renders the loading state: spinner + loading label, disabled", () => {
    const markup = renderToStaticMarkup(
      <ObCta loading loadingLabel="Saving...">Continue</ObCta>,
    );
    expect(markup).toContain("animate-spin");
    expect(markup).toContain("Saving...");
    expect(markup).toContain("disabled");
    expect(markup).toContain("ob-cta-loading");
    // Loading is a working state, not the locked state.
    expect(markup).not.toContain("ob-cta-locked");
  });

  it("prefers the loading state over the disabled hint while saving", () => {
    const markup = renderToStaticMarkup(
      <ObCta loading disabled disabledHint="Accept the legal terms to continue" loadingLabel="Saving...">
        Continue
      </ObCta>,
    );
    expect(markup).toContain("Saving...");
    expect(markup).not.toContain("Accept the legal terms to continue");
  });

  it("defaults to type=button so it never submits surrounding forms", () => {
    const markup = renderToStaticMarkup(<ObCta>Continue</ObCta>);
    expect(markup).toContain('type="button"');
  });
});

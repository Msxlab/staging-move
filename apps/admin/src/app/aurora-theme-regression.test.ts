import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * Collapse runs of spaces/tabs to a single space so assertions are robust to
 * column alignment. The base token blocks now live in generated partials
 * (`_tokens.generated.css` / `_aurora-tokens.generated.css`) emitted from
 * `packages/shared/src/design-tokens-css.ts`; the emitter aligns declarations
 * to the longest name in each block, so exact whitespace differs from the old
 * hand-written copies even though every value is unchanged.
 */
function collapse(css: string): string {
  return css.replace(/[ \t]+/g, " ");
}

describe("admin Aurora theme token integration", () => {
  it("keeps legacy primary aliases sapphire in dark and sapphire in light while semantic rose stays risk red", () => {
    // Concatenate each file with its generated partial so these assertions
    // cover the same declarations as before the single-source refactor (pure
    // formatting/location change — values are unchanged).
    const globals = collapse(
      read("src/app/globals.css") + "\n" + read("src/app/_tokens.generated.css"),
    );
    const aurora = collapse(
      read("src/app/aurora.css") +
        "\n" +
        read("src/app/_aurora-tokens.generated.css"),
    );

    expect(globals).toContain("--rose: #5B8DEF;");
    expect(globals).toContain("--brand-orange: #5B8DEF;");
    expect(globals).toContain("--foil: #5B8DEF;");
    expect(globals).toContain("--rose: #2E5FB0;");
    expect(globals).toContain("--brand-amber: #E0A85A;");
    expect(globals).toContain("--tone-rose-fg: #E25C5C;");
    expect(globals).toContain("--tone-orange-fg: #5B8DEF;");
    expect(globals).toContain("--tone-sky-fg: #37C2C9;");
    expect(globals).toContain("--border-focus: rgba(91, 141, 239, 0.55);");

    expect(aurora).toContain("--rose: var(--au-cool);");
    expect(aurora).toContain("--brand-orange: var(--au-cool);");
    expect(aurora).toContain("--foil: var(--au-violet);");
    expect(aurora).toContain("--brand-amber: var(--au-amber);");
    expect(aurora).toContain("--tone-rose-fg: var(--au-coral);");
    expect(aurora).toContain("--tone-orange-fg: var(--au-cool);");
    expect(aurora).toContain("--tone-sky-fg: #37C2C9;");
    expect(aurora).toContain("--au-cool: #5B8DEF;");
    expect(aurora).toContain("--au-cool: #2E5FB0;");
    expect(aurora).not.toContain("--rose: var(--au-violet);");
    expect(aurora).not.toContain("--brand-orange: var(--au-violet);");
  });
});

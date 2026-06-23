import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emitTargets, renderShadcnLayer, renderTarget } from "../design-tokens-css";

/**
 * Drift guard for the single-source design-token emitter.
 *
 * Re-runs the emitter in memory and asserts:
 *   1. every committed `_tokens.generated.css` / `_aurora-tokens.generated.css`
 *      / `_tokens-shadcn.generated.css` partial is byte-identical to the
 *      freshly rendered output, and
 *   2. the shadcn `@layer base` block inlined in each globals.css matches the
 *      model (it can't be imported under Turbopack, so it lives inline and is
 *      guarded here instead).
 *
 * If someone hand-edits a generated copy or the inline shadcn block (the kind
 * of drift this refactor removed), or changes the model without re-running
 * `pnpm tokens:emit`, this fails.
 */

// Resolve the repo root from this test file's location so the test passes
// regardless of the cwd the runner uses (shared runs from packages/shared;
// the web app includes this file via its own test glob). `fileURLToPath`
// handles Windows drive-letter URLs correctly.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function repoPath(relative: string): string {
  return join(REPO_ROOT, relative);
}

// The repo checks CSS out as CRLF on Windows but the emitter renders LF
// (git stores LF). Normalize so the guard catches content drift, not the
// platform line-ending applied to the working tree.
function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

describe("design-token emitter", () => {
  it("emits at least the four known token partials", () => {
    const paths = emitTargets.map((t) => t.outPath);
    expect(paths).toContain("apps/web/src/styles/_tokens.generated.css");
    expect(paths).toContain("apps/admin/src/app/_tokens.generated.css");
    expect(paths).toContain("apps/web/src/styles/_aurora-tokens.generated.css");
    expect(paths).toContain("apps/admin/src/app/_aurora-tokens.generated.css");
  });

  for (const target of emitTargets) {
    it(`generated CSS is up to date: ${target.outPath}`, () => {
      const committed = normalizeEol(readFileSync(repoPath(target.outPath), "utf8"));
      const rendered = normalizeEol(renderTarget(target));
      expect(
        committed,
        `${target.outPath} is stale — run \`pnpm tokens:emit\` (do not hand-edit generated CSS).`,
      ).toBe(rendered);
    });
  }

  // The shadcn `@layer base` block is inlined in globals.css (it can't be a
  // standalone @import under Turbopack). Guard the inline copy against the model.
  const inlineShadcn = [
    { app: "web" as const, file: "apps/web/src/styles/globals.css" },
    { app: "admin" as const, file: "apps/admin/src/app/globals.css" },
  ];
  for (const { app, file } of inlineShadcn) {
    it(`inline shadcn @layer base matches the model: ${file}`, () => {
      const css = normalizeEol(readFileSync(repoPath(file), "utf8"));
      const expected = normalizeEol(renderShadcnLayer(app));
      expect(
        css,
        `The inline shadcn block in ${file} drifted from the model — run \`pnpm tokens:emit\` and re-inline.`,
      ).toContain(expected);
    });
  }
});

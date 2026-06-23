/**
 * Emit design-token CSS partials from the single source of truth.
 *
 * Step 1 of the design-system foundation: this script reads the
 * structured CSS-var model in `packages/shared/src/design-tokens-css.ts`
 * and writes the `_tokens.generated.css` / `_aurora-tokens.generated.css`
 * partials that web + admin `@import`. It replaces five hand-synced token
 * copies with one generator.
 *
 * Usage:
 *   pnpm tokens:emit            # write the generated files
 *   pnpm tokens:emit --check    # exit 1 if any file is stale (CI/drift)
 *
 * PURE REFACTOR: the emitted bytes are identical to the previous
 * hand-written token blocks (verified by the drift-guard test).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { emitTargets, renderTarget } from "../packages/shared/src/design-tokens-css";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function main(): void {
  const checkOnly = process.argv.includes("--check");
  let stale = 0;

  for (const target of emitTargets) {
    const absPath = join(REPO_ROOT, target.outPath);
    const next = renderTarget(target);

    if (checkOnly) {
      let current = "";
      try {
        current = readFileSync(absPath, "utf8");
      } catch {
        current = "<missing>";
      }
      // Compare EOL-normalized: the repo checks CSS out as CRLF on Windows
      // but the emitter writes LF; git stores LF either way. Content drift is
      // what we guard, not the working-tree line-ending the platform applies.
      if (normalizeEol(current) !== normalizeEol(next)) {
        stale += 1;
        console.error(`✗ stale: ${target.outPath}`);
      } else {
        console.log(`✓ up to date: ${target.outPath}`);
      }
      continue;
    }

    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, next, "utf8");
    console.log(`wrote ${target.outPath} (${next.length} bytes)`);
  }

  if (checkOnly && stale > 0) {
    console.error(
      `\n${stale} generated token file(s) are stale. Run \`pnpm tokens:emit\`.`,
    );
    process.exit(1);
  }
}

main();

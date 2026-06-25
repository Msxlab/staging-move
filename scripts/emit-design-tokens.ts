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
const WEB_GLOBALS_PATH = "apps/web/src/styles/globals.css";
const WEB_SHADCN_OUT_PATH = "apps/web/src/styles/_tokens-shadcn.generated.css";

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function stripGeneratedHeader(text: string): string {
  return text.replace(/^\/\* AUTO-GENERATED[\s\S]*?\*\/\n\n/, "");
}

function findCssBlockEnd(text: string, start: number): number {
  let depth = 0;
  let seenOpen = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") {
      seenOpen = true;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (seenOpen && depth === 0) return i + 1;
    }
  }
  throw new Error("Could not find end of CSS block.");
}

function replaceFirstLayerBase(globalsCss: string, nextLayerBase: string): string {
  const marker = "@layer base {";
  const start = globalsCss.indexOf(marker);
  if (start === -1) {
    throw new Error(`Could not find first ${marker} block in ${WEB_GLOBALS_PATH}.`);
  }
  const end = findCssBlockEnd(globalsCss, start);
  const rest = globalsCss.slice(end);
  const nextContentStart = rest.search(/\S/);
  const suffix = nextContentStart === -1 ? "" : rest.slice(nextContentStart);
  return `${globalsCss.slice(0, start)}${nextLayerBase.trimEnd()}\n\n${suffix}`;
}

function main(): void {
  const checkOnly = process.argv.includes("--check");
  let stale = 0;
  let webShadcnLayer = "";

  for (const target of emitTargets) {
    const absPath = join(REPO_ROOT, target.outPath);
    const next = renderTarget(target);
    if (target.outPath === WEB_SHADCN_OUT_PATH) {
      webShadcnLayer = stripGeneratedHeader(next);
    }

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

  if (webShadcnLayer) {
    const globalsPath = join(REPO_ROOT, WEB_GLOBALS_PATH);
    const currentGlobals = readFileSync(globalsPath, "utf8");
    const nextGlobals = replaceFirstLayerBase(currentGlobals, webShadcnLayer);
    if (checkOnly) {
      if (normalizeEol(currentGlobals) !== normalizeEol(nextGlobals)) {
        stale += 1;
        console.error(`stale inline shadcn block: ${WEB_GLOBALS_PATH}`);
      } else {
        console.log(`up to date inline shadcn block: ${WEB_GLOBALS_PATH}`);
      }
    } else if (normalizeEol(currentGlobals) !== normalizeEol(nextGlobals)) {
      writeFileSync(globalsPath, nextGlobals, "utf8");
      console.log(`updated inline shadcn block in ${WEB_GLOBALS_PATH}`);
    }
  }

  if (checkOnly && stale > 0) {
    console.error(
      `\n${stale} generated token file(s) are stale. Run \`pnpm tokens:emit\`.`,
    );
    process.exit(1);
  }
}

main();

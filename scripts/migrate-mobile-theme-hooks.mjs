// One-shot migration helper that converts mobile files from the static
// `import { theme } from "@/lib/theme"` pattern (whose StyleSheet.create
// captures dark-palette values at module-import time) to the
// `useAppTheme()` + `makeStyles(theme)` pattern that re-runs
// StyleSheet.create whenever the user's Appearance preference changes.
//
// Usage: node scripts/migrate-mobile-theme-hooks.mjs <path>...
//
// Transformation rules per file:
//   1. Replace `import { theme[, ...others] } from "@/lib/theme"` with
//      `import { useAppTheme, type Theme[, ...others] } from "@/lib/theme"`.
//   2. Make sure `useMemo` is in the `react` import. Handles three
//      shapes: named-only (`{ ... }`), default-only (`React`),
//      mixed (`React, { ... }`), or no React import at all.
//   3. Convert top-level `const styles = StyleSheet.create({` into
//      `const makeStyles = (theme: Theme) => StyleSheet.create({`.
//      The original closing `})` already terminates the arrow function.
//   4. For every component function (`function PascalCase(` declared at
//      line start, optionally preceded by `export ` / `export default `):
//        - if the body references `theme.`, inject
//            const theme = useAppTheme();
//        - if the body references `styles.`, inject
//            const styles = useMemo(() => makeStyles(theme), [theme]);
//      Already-injected blocks are detected via a sentinel comment so
//      the script is idempotent.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SENTINEL = "// theme: hook-injected styles";

function ensureReactUseMemo(src) {
  // Case A: `import { ... } from "react";` — add `useMemo` to the named list.
  const namedRe =
    /import\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{\s*([^}]*)\s*\}\s+from\s+(['"])react\3\s*;?/m;
  let m = src.match(namedRe);
  if (m) {
    const named = m[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!named.includes("useMemo")) {
      named.push("useMemo");
      const def = m[1] ? `${m[1]}, ` : "";
      return src.replace(
        namedRe,
        `import ${def}{ ${named.join(", ")} } from "react";`,
      );
    }
    return src;
  }

  // Case B: `import React from "react";` (default only, no named imports).
  const defaultOnlyRe =
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+(['"])react\2\s*;?/m;
  m = src.match(defaultOnlyRe);
  if (m) {
    return src.replace(
      defaultOnlyRe,
      `import ${m[1]}, { useMemo } from "react";`,
    );
  }

  // Case C: no React import at all — uncommon in this repo, but be safe.
  if (!/from\s+(['"])react\1/.test(src)) {
    return `import { useMemo } from "react";\n${src}`;
  }

  // Some other shape (`import * as React`) — leave alone.
  return src;
}

function migrate(filePath) {
  if (!existsSync(filePath)) {
    console.log(`SKIP (missing) ${filePath}`);
    return { changed: false, reason: "missing" };
  }
  const original = readFileSync(filePath, "utf8");
  let src = original;

  // 1. Rewrite the @/lib/theme import.
  const themeImportRe = /import\s*\{\s*([^}]+?)\s*\}\s*from\s*(['"])@\/lib\/theme\2;?/m;
  const m = src.match(themeImportRe);
  if (!m) {
    return { changed: false, reason: "no-theme-import" };
  }
  const namedListRaw = m[1];
  const items = namedListRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const filtered = items.filter((tok) => tok.split(/\s+/).pop() !== "theme");
  const hasUseAppTheme = filtered.some((tok) => tok === "useAppTheme");
  const hasTypeTheme = filtered.some(
    (tok) => tok === "type Theme" || tok === "Theme",
  );
  if (!hasUseAppTheme) filtered.push("useAppTheme");
  if (!hasTypeTheme) filtered.push("type Theme");
  const newImport = `import { ${filtered.join(", ")} } from "@/lib/theme";`;
  src = src.replace(themeImportRe, newImport);

  // 2. Make sure `useMemo` is in the React import.
  src = ensureReactUseMemo(src);

  // 3. Wrap `const styles = StyleSheet.create({` into a factory.
  const styleSheetRe =
    /^(\s*)(export\s+)?const\s+styles\s*=\s*StyleSheet\.create\(\s*\{/m;
  const usesStyleSheet = styleSheetRe.test(src);
  if (usesStyleSheet) {
    src = src.replace(
      styleSheetRe,
      (_match, indent, exp) =>
        `${indent}${
          exp || ""
        }const makeStyles = (theme: Theme) => StyleSheet.create({`,
    );
  }

  // 4. Inject the hooks into every top-level component function.
  const fnRe =
    /^(\s*)((?:export\s+default\s+|export\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?::\s*[^=>{]+?)?\s*)\{\s*\n/gm;
  src = src.replace(fnRe, (full, indent, _head, _name, offset) => {
    // Find the matching closing brace for this function so we can
    // sniff the body for `theme.` and `styles.` references.
    const bodyStart = offset + full.length;
    let depth = 1;
    let i = bodyStart;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    const body = src.slice(bodyStart, i);
    if (body.includes(SENTINEL)) return full;

    const usesThemeRef = /\btheme\b\s*\./.test(body);
    const usesStylesRef = /\bstyles\b\s*\./.test(body);
    if (!usesThemeRef && !usesStylesRef) return full;

    const lines = [`${indent}  ${SENTINEL}`];
    if (usesThemeRef || usesStylesRef) {
      lines.push(`${indent}  const theme = useAppTheme();`);
    }
    if (usesStylesRef) {
      lines.push(
        `${indent}  const styles = useMemo(() => makeStyles(theme), [theme]);`,
      );
    }
    return `${full}${lines.join("\n")}\n`;
  });

  if (src === original) {
    return { changed: false, reason: "no-op" };
  }

  writeFileSync(filePath, src);
  return { changed: true };
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/migrate-mobile-theme-hooks.mjs <file>...");
  process.exit(2);
}
let touched = 0;
for (const file of args) {
  const res = migrate(file);
  if (res.changed) {
    console.log(`MIGRATED  ${file}`);
    touched++;
  } else {
    console.log(`SKIP (${res.reason})  ${file}`);
  }
}
console.log(`\n${touched}/${args.length} files migrated.`);

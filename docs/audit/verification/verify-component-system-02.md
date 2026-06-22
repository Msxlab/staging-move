# Adversarial Verification — component-system-02

**Finding under review:** "Design tokens manually mirrored into four copies"
**Original severity:** High · **Category:** Architecture
**Verdict:** CONFIRMED (severity adjusted High → Medium)

## Claim

Design tokens defined in `packages/shared/src/design-tokens.ts` are hand-mirrored
into multiple downstream copies (web globals.css, admin globals.css, web/admin/mobile
tailwind configs). Only mobile consumes the token file at runtime; web/admin keep
manual copies, so a token change requires editing up to ~4 files and a missed edit
causes silent cross-app palette drift.

## What the code actually shows

### 1. The token file itself documents the manual-mirror arrangement (not citable as proof on its own, but the code below corroborates it)
`packages/shared/src/design-tokens.ts:13-23` — header states "the mobile app — the
only runtime consumer of this file" and "Web and admin don't import at runtime; their
globals.css mirrors these values manually" and "keep their own copies of the same
numeric values; sync manually when these change."

### 2. Web globals.css hardcodes the same hex numerically (independent copy)
`apps/web/src/styles/globals.css:11-20` header: "Source of truth: …design-tokens.ts.
Mirrors the numeric values." Lines 24-57 hardcode literals (`--rose: #CBA45E`,
`--orange-400: #CBA45E`, etc.) that duplicate `design-tokens.ts` (`brandColors.rose
= "#CBA45E"`, `roseScale`, etc.). These are plain CSS literals — no build-time import
from the token module.

### 3. Admin globals.css is a third independent copy
`apps/admin/src/app/globals.css:5-9` header: "Mirrors apps/web/src/styles/globals.css …
Source of truth for numeric values: packages/shared/src/design-tokens.ts." Lines 12-37
re-hardcode the identical hex (`--rose: #CBA45E`, `--orange-50: #FFF8E8` … `--orange-900:
#5F4614`). Note the admin tone alphas (lines 49-59) intentionally DIVERGE from web
(e.g. `--tone-foil-bg` is `0.16` in admin vs `0.10` in web) — demonstrating the copies
have already drifted in places, exactly the failure mode the finding warns about.

### 4. Mobile tailwind.config.ts re-hardcodes hex rather than importing
`apps/mobile/tailwind.config.ts:27-71` — NativeWind palette hardcodes literals
(`primary.500: "#CBA45E"`, `foil.DEFAULT: "#CBA45E"`, `sage.DEFAULT: "#54CB7E"`, etc.).
Despite the header saying the palette "is sourced from …design-tokens.ts", the config
does NOT import the token module — it restates the values by hand. So even on mobile,
the *Tailwind* layer is a manual copy (only the `theme.ts` runtime layer truly imports).

### 5. Web/admin tailwind configs re-declare the color maps
`apps/web/tailwind.config.ts:17-194` and `apps/admin/tailwind.config.ts:17-183` each
re-declare the full color/tone/shadow/font maps. They reference `var(--…)` CSS vars
rather than hardcoding hex, so they are NOT a second source of the hex *values* — but
they are a hand-maintained duplicate of the token *structure* across both apps
(admin's header at line 69 literally says "Mirrors apps/web/tailwind.config.ts").

### 6. Only mobile theme.ts imports the token objects at runtime — CONFIRMED
`apps/mobile/src/lib/theme.ts:5-24` imports `brandColors, borderDark, roseScale,
gradients, semanticColors, surfaceDark, tonesDark, …` from `@locateflow/shared` and
consumes them directly. The shared barrel re-exports them: `packages/shared/src/index.ts:5`
(`export * from "./design-tokens"`).

A targeted search for web/admin runtime code importing the token symbols
(`tokens|brandColors|roseScale|foilScale|surfaceDark|gradients|tonesDark|semanticColors`)
from `@locateflow/shared` returned **zero matches** in both `apps/web/src` and
`apps/admin/src`. The 139 web / 38 admin files that import `@locateflow/shared` import
OTHER exports (validators, billing, permissions, recommendation-engine, etc.) — not
the design tokens. (The only web file touching design tokens is
`apps/web/src/lib/design-tokens-contrast.test.ts`, a TEST, not runtime.)

## Assessment

The architectural claim is accurate and proven by source:
- The hex palette exists as **three independent hardcoded copies**: the canonical TS
  module, web globals.css, admin globals.css — plus a fourth hardcoded restatement in
  mobile's tailwind.config.ts. The two app tailwind configs add further hand-maintained
  duplication of the token *structure* (via CSS-var indirection).
- Web and admin do **not** import the token module at runtime; only mobile's `theme.ts`
  does. The "single source of truth" header is therefore misleading for web/admin.
- Drift is not hypothetical: the admin tone alphas already differ from web's, confirming
  the copies can and do diverge silently.

## Severity adjustment

Adjusted **High → Medium**. This is a real maintainability / consistency hazard
(Architecture), but it is build-time/visual only: no runtime crash, no security or data
risk, and CSS-var indirection in the tailwind configs limits the blast radius for the
*scale* values. The concrete impact is palette drift and multi-file edits — a Medium
maintainability concern rather than a High one. There is a partial guardrail
(`design-tokens-contrast.test.ts`) but it does not assert that globals.css equals the
token file, so drift is not caught automatically. [The contrast test's exact coverage is
noted from its filename/location; its assertions were not exhaustively read — needs
verification only on the precise scope of that test, not on the core finding.]

## Files reviewed
- packages/shared/src/design-tokens.ts (full)
- packages/shared/src/index.ts
- apps/web/src/styles/globals.css:1-314
- apps/admin/src/app/globals.css:1-60
- apps/web/tailwind.config.ts (full)
- apps/admin/tailwind.config.ts (full)
- apps/mobile/tailwind.config.ts (full)
- apps/mobile/src/lib/theme.ts:1-40

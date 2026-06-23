# Phase 1 — Token & Brand Foundation · Implementation Plan

> Rollout step 1 of 5 (D34). Decisions: see `DECISIONS_LOG.md`. Gap evidence: `00_GAP_REPORT.md`, `01_DESIGN_SYSTEM_DELTA.md`.
>
> **✅ STEP 1 DONE (2026-06-22)** — single-source token emitter merged to `feat/design-foundation` (merge of `worktree-agent-…`). **Pure refactor, zero visual change**: 664 token declarations machine-verified identical; emitter `--check` (regenerate==committed) green; shared typecheck 0 errors; drift-guard + contrast + aurora-regression tests green; web/admin build green. Steps 2–7 (value/typography/radius/brand/aurora swaps) NOT started.
>
> **⚠️ Architecture note to confirm:** the shadcn HSL `@layer base` block could NOT be a standalone `@import` (Turbopack rejects a bare `@layer base` without a matching `@tailwind base`). It is therefore **generated from the single model but INLINED** into each `globals.css` (where `@tailwind base` lives), preserving the cascade — still single-sourced + drift-guarded. The unlayered `:root/.dark/.light` + `--au-*` blocks ARE true `@import`s. Accept this, or revisit if we move off Turbopack.

## Objective
Establish the **single token source-of-truth** and adopt the new visual **foundation** (palette / typography / radius / brand mark) **without changing any page layout, IA, or behavior.** Page re-skins and new features are Phases 2–5. Keep the **LocateFlow** name. Reversible; all existing tests stay green.

## Guardrails (what Phase 1 does NOT touch)
- ❌ No page layout / IA / component-structure changes (those are Phases 2–5).
- ❌ No free-pivot / PRO removal (that is its own later phase — billing is `AGENTS.md` high-risk).
- ❌ No new features (dossier raccoon scenes, completable reminders, share screen, risk gauge…).
- ❌ No product rename (name stays LocateFlow; storage keys unchanged — D1/D13).
- ✅ Only: the token system, palette values, fonts, radius scale, brand mark/icons, aurora re-skin.

---

## Step 1 — Single build-time token emitter (D11, D6) — **do this first**
**Problem:** today the same values live in **5 hand-synced copies** (`packages/shared/src/design-tokens.ts` + web `globals.css` + web `aurora.css` + admin `globals.css` + admin `aurora.css`) and drift; mobile is the only runtime consumer of the TS file.
**Plan:**
1. Make `packages/shared/src/design-tokens.ts` the **canonical structured model**: semantic tokens (`bg/surface/surface2/surface3/text/dim/faint/border/accent/accentLight/accentDeep/onAccent/green/red/amber/teal/...`) defined **once per mode** (dark/light) and per surface family (web, admin).
2. Add a **build-time emitter** `scripts/emit-design-tokens.ts` that generates, from that single model:
   - `apps/web/src/styles/_tokens.generated.css` (`:root` + `.dark` CSS vars),
   - `apps/admin/src/app/_tokens.generated.css`,
   - mobile keeps consuming the TS object directly (no change to its import path).
   `globals.css`/`aurora.css` then `@import` the generated file instead of hand-listing values.
3. **Derive the shadcn HSL channel vars** (`--primary`, `--background`, `--foreground`, …) from the new hex in the emitter (the web/admin component layer depends on HSL). **Keep the HSL layer** — do not drop it.
4. Add a **drift guard test**: regenerate in CI and assert the committed `_tokens.generated.css` matches (fails if someone hand-edits a copy). Augments/!replaces the spirit of `aurora-theme-regression.test.ts`.
- **Risk:** Low–Med (generated CSS must byte-match current rendering). **Mitigation:** emit → diff against current values → only then switch imports; keep values identical in the first commit (pure refactor), swap values in Step 2.

## Step 2 — Palette values (D5, D7, D9)
Apply the new values **in the single source** (then the emitter propagates). Most dark values are already correct (Gold stays).
- **Accent (D5):** keep **Gold `#CBA45E` dark / Sapphire `#2E5FB0` light** (already current) — no Emerald, no 3-way picker (D8).
- **Dark surfaces:** update `surface3 #16203A→#1F2C47`, `faint`, `border` alpha; add admin `--panel #0E1626` / `--panel2 #16203A`.
- **Admin canvas (D7):** unify `#171E2B → #070B14` (drop graphite); re-skin `.adm-aurora` dark + admin `themeColor`.
- **Light (D9):** cool `#F2F4F8 → warm greige #EFEADF`, `surface2 #F5F0E7`, lighter semantic greens/teal (`success #0F6B50→#1C8A63`, `info #16666B→#168E9C`). **Re-run WCAG AA contrast** (warm canvas shifts light-mode contrast most).
- Keep light mode (D5/D27). No `lightBg` selector v1 (greige default only).

## Step 3 — Typography
- Adopt **Playfair Display** (display/wordmark, 700–900) · **DM Sans** (UI) · **DM Mono** as the token fonts.
- **Remove** the dead legacy **Geist + Fraunces** font loading (cleanup).
- Wordmark = **"LocateFlow"** in Playfair 900 (D4 — not "Move").

## Step 4 — Radius scale (D10)
- Bump the radius tokens to the rounder scale (cards 18–26px, pills 99px, buttons 11–14px, chips 7–8px) as **tokens**.
- Audit hardcoded `rounded-[..]` / `--radius` consumers; route them through the token.

## Step 5 — Brand mark + icons (D4)
- Promote the **parametric raccoon** to a shared official mark: a web SVG component (`apps/web/src/components/brand/RaccoonMark.tsx`) + mobile equivalent, with `eye` accent = Gold(dark)/Sapphire(light) (brand-raccoon-1/3).
- **Regenerate raster assets** with raccoon + "LocateFlow" Playfair wordmark: favicon, PWA icons (192/512 maskable), `opengraph-image.tsx` (fixes the leftover "M" glyph — brand-raccoon-4). *Raster regen is partly manual; I'll flag exact files.*

## Step 6 — Honest token aliases (D13)
- Introduce canonical names `--gold / --sapphire / --teal / --green` (+ TS `accent/...`).
- Keep legacy aliases (`brand.orange`, `rose`, `foil`, `sage`, `nude`…) as **thin re-exports** of the canonical so **no codemod is needed yet** (mobile keeps flipping). **Storage keys unchanged.**

## Step 7 — Aurora re-skin (D12)
- **Keep** `aurora.css` / `.lf-aurora` / `.adm-aurora`; **re-skin** to navy/gold (do not retire — that's a later follow-up).
- Update `aurora-theme-regression.test.ts` expectations to the new values.

---

## Step 1 — surveyed token inventory (post-branch, 2026-06-22)
Branch `feat/design-foundation` created. The real scope of the token copies (bigger/more intricate than the initial estimate — confirmed by reading the files):
- **web `globals.css`**: `:root,.dark` block ≈ **190 vars** (brand+Gold scale, surfaces, fg ramp, borders, glass, semantic, **6 tones + 5 legacy tone-aliases** = ~60 tone vars, radii, spacing, shadows, typography, sizes, weights, line-heights, tracking, font-variation) + `.light` block ≈ **100 override vars** + a separate **shadcn HSL `@layer base`** block (`:root/.dark` + `.light`, ~40 HSL channel vars).
- **admin `globals.css`** (456 ln) + **web `aurora.css`** (`.lf-aurora`, mirrors HSL) + **admin `aurora.css`** (`.adm-aurora`) — more copies of the same values.
- Total ≈ **400+ token declarations** across 5 files with subtle rgba alphas + hex→HSL conversions.

### Step-1 sub-steps (each verified before the next)
1a. Model ALL current tokens in `design-tokens.ts` as a structured `{ dark, light }` per-surface object (semantic names + the legacy aliases as derived).
1b. Write `scripts/emit-design-tokens.ts` → generates web `_tokens.generated.css` (`:root,.dark` + `.light` + the HSL `@layer base`), admin `_tokens.generated.css`, and the HSL derivation.
1c. **Generate, then byte/value-diff** the generated CSS against the CURRENT hand-written blocks until they match **exactly** (pure refactor — zero visual change). This diff-to-green loop is the core of Step 1.
1d. Swap `globals.css`/`aurora.css` to `@import` the generated file; delete the now-duplicated hand blocks; add the **drift-guard test** (regenerate in CI, assert committed == generated).
1e. typecheck + build + token/contrast/aurora tests green → commit. Only AFTER this does Step 2 change any value.

### Recommended SAFE execution (given the 400-token scale)
Step 1c (the byte-exact diff-to-green loop) is best run in an **isolated git worktree** so it can iterate generate→diff→fix without risk to the main tree, then I review the byte-diff result before merging it onto `feat/design-foundation`. This avoids a fatigue-driven wrong-alpha regression in the live foundation. (Alternative: do it inline in careful verified increments — slower, same result.)

## Verification (per step + at the end)
- `pnpm verify:typecheck` (web + admin + mobile + shared + db + connectors).
- Token **drift guard** test (Step 1) + `design-tokens-contrast.test.ts` (AA) + `aurora-theme-regression.test.ts` + `design-tokens-contrast` re-run after Step 2.
- `pnpm --filter @locateflow/web test` / admin / mobile (full suites stay green; note the pre-existing `pricing-free-tier-contract` failure is unrelated).
- `pnpm build` (web + admin) once.
- ⚠️ **Runtime visual contrast** (light greige + dark) needs the app running — I'll either run it (with approval) or give you exact screens to eyeball.

## Risks & rollback
- New branch `feat/design-foundation`; **per-step commits**; nothing pushed/merged without approval.
- Step 1 is a pure refactor (values identical) → easy to verify no visual change before any value swap in Step 2.
- Each step is independently revertible; the emitter makes value rollback a one-line change in the source.

## Deliverables
- Single-source token model + emitter + generated CSS, new palette/typography/radius, raccoon mark + regenerated icons, re-skinned aurora, drift-guard test — all on `feat/design-foundation`, per-step tested commits.
- `DECISIONS_LOG.md` + this plan updated as we go.

## Estimated change surface
~12–18 files: `design-tokens.ts`, new emitter script + 2 generated CSS, web/admin `globals.css`+`aurora.css` (import swap + re-skin), `tailwind.config.ts` ×3 (font/radius tokens), mobile `theme.ts`, web `app/layout.tsx` (font loading), `RaccoonMark` component(s), `opengraph-image.tsx` + favicon/PWA icons, 2–3 test files.

_Plan authored 2026-06-22 — awaiting approval to implement Step 1._

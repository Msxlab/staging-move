# Phase 2 — Mobile Re-skin · Plan

> Rollout step 2 of 5 (D34). Builds on the completed Phase 1 foundation (tokens + RaccoonMark/Wordmark).
> **Key fact:** `apps/mobile` is already the *in-flight "Move" renewal* — it implements the design's language (ThemeProvider, navy tokens, Playfair/DM, `move/primitives`, Raccoon mascot, 5-tab nav, all Home/Moving/Services/Addresses/More sections by name). So Phase 2 is **parity + cleanup + a few feature builds**, NOT a from-scratch port. The Step-2 token model (greige/radius/surface3) already propagated to mobile.

## Decisions that resolve / moot most move-app gaps
- `move-app-01/02` (rebrand to "Move", bundle id, storage keys) → **MOOT** — name stays **LocateFlow** (D1). No identity codemod.
- `move-app-04/05/06` (rose-vs-Gold, 3-way accent picker, lightBg selector) → **resolved** — Gold default (mobile already), **no picker, no lightBg selector** (D5/D8/D9). greige default = Step 2.
- `move-app-07/08` (warm greige, radius bump) → **DONE in Step 2** (token model).
- `move-app-03` (100% free vs PRO surfaces) → **separate truly-free phase** (`FREE_PIVOT_READINESS.md`), not the re-skin.
- `move-app-21` (web 13-widget dashboard) → keep & re-skin (D23/D24) — a web-shell concern (Phase 4), not mobile.

## Phase 2 scope (the actual remaining mobile work)

### Increment A — Token/cleanup parity (low-risk, first) 
- `move-app-17`: replace the 3 copies of hardcoded `CATEGORY_COLORS` hex (`services.tsx`, `services/[id].tsx`, `services/[id]/edit.tsx`) with shared tokens.
- `move-app-18`: replace `#fff`/`#000` on filled accents/checkmarks with the `onAccent`/`onGold` token (services, moving/[id], onboarding).
- `move-app-19`: pre-splash hardcoded `#0A0F18` → design `#0A0F1C` (`app/_layout.tsx`).
- `move-app-20`: remove legacy **Geist/Fraunces** font loading on mobile (keep Playfair/DM) — mirror web Step 2.
- `move-app-24`: confirm the Raccoon **eye tracks the active accent** (Gold dark / Sapphire light) via token, not hardcoded.
- Verify Step-2 token values render right on mobile (greige light, radius, surface3).

### Increment B — Fidelity verification (read-mostly; fix gaps found)
- `move-app-12/13/14`: Home Dossier 7-metric matrix + 5-segment band + swipe/grid toggle + dots; `DossierScene` prop-art parity; AI Briefing chips/typing-dots/Raccoon `thinking`.
- `move-app-09/10/16/22/23`: address OSM map parity + attribution; Moving "Live move intelligence" animated route; Services health tiles + old→new monthly cost; More footer/badge copy (note free-vs-PRO tension → truly-free phase); splash tagline + wordmark = **"LocateFlow"** (NOT "Move").
- Wire the new `RaccoonMark`/`Wordmark` where the mobile app renders the logo (verify it already uses `MoveRaccoon`).

### Increment C — New feature builds (larger; overlaps the features track)
- `move-app-15`: Moving **Risk gauge** panel (D16 — data-backed). Likely missing.
- `move-app-10/11`: animated route map + **Raccoon-as-truck** travel marker (D16 — delight). 
- (Completable reminders D21, full raccoon dossier D14 — tracked in the features backlog.)

## Method & guardrails
- Branch `feat/design-foundation` (continue) or a `feat/mobile-reskin` child; per-increment tested commits via the proven isolated-worktree pattern; nothing pushed/merged without review.
- Mobile typecheck + tests green; do NOT touch billing/auth/PRO gating (that's the truly-free phase); keep the name LocateFlow.
- ⚠️ Mobile visuals need a human/emulator preview (renders not verifiable from code).

## Progress
- **✅ Increment A DONE (merged `feat/design-foundation`):** CATEGORY_COLORS de-duped to a single `theme.ts categoryColors` (identical values); `#fff`→`onAccent` on the 3 unambiguous on-accent sites (correctly LEFT the green-fill checkmarks + gradient-button icons where white is right); pre-splash `#0A0F18`→`#0A0F1C`; removed legacy Geist/Fraunces fonts + deps + lockfile; raccoon eye already accent-bound. Mobile-only, 9 files, mobile typecheck 0 + **326 tests green**.
  - **Follow-up flag:** `apps/mobile/src/components/ui/Button.tsx` hardcodes `#fff` for `text_primary`/`text_gradient`/spinner (on accent fills) — tokenize in a dedicated Button pass (app-wide regression surface).
  - **⚠️ Emulator/visual check still required:** dark+light — category chips, on-accent contrast, pre-splash flash, raccoon eye Gold(dark)/Sapphire(light).
- **✅ Increment B DONE (verification):** audited mobile vs the handoff — mobile is already faithful, **no token/parity code changes needed** (no literal "Move" wordmark to fix; More footer already "LocateFlow"; OSM attribution baked into the Geoapify image). Flagged partials handled below.
- **✅ Phase 2B partials DONE (best-guess, design-matched + data-honest):**
  - **Splash** (`move-app-23`): added "LocateFlow" Playfair-900 wordmark + "Relocation Intelligence" gold eyebrow + bg `#0A0F18`→`#0A0F1C`. No PRO pill (D3). (`a249f835`)
  - **AI Briefing** (`move-app-14`): content-state header → MoveRaccoon `thinking` + 3 staggered blinking typing dots + "Updated now". (`3a3e16cc`)
  - **Risk gauge** (`move-app-15`): "MOVES" → "RISK LEVEL · {High|Elevated|Low}", band derived from the existing `riskRatio`, severity-colored; portfolio chips kept. (`3a3e16cc`)
  - **Monthly cost old→new** (`move-app-16`): **kept current-spend (NO change)** — the app has no projected new-home cost; current spend is the data-honest signal (decision).
  - New i18n strings use `t()` fallbacks → **add es translations** (briefingUpdatedNow, riskLevelLabel, riskHigh/Elevated/Low) as a minor follow-up.
- **🎉 PHASE 2 (mobile) effectively COMPLETE** for the re-skin/parity scope. ⚠️ All mobile visuals still need an **emulator/human preview** (foundation raccoon + splash + briefing + gauge in dark+light).
- **Deferred → Increment C / features track:** raccoon-truck travel marker (`move-app-11`), animated route map (`move-app-10`), full dossier 7-metric swipe matrix (`move-app-12`, D14), completable reminders (D21). Larger feature builds — schedule with D14/D16/D17/D20/D21/D22.
- **Next in D34 order:** Phase 3 (marketing re-skin) → Phase 4 (web shell) → Phase 5 (admin theme).

_Plan authored 2026-06-22 — Increment A+B + Phase 2B partials done; Increment C (features) + Phases 3–5 remaining._

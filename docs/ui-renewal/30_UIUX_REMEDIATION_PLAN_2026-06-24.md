# UI/UX Remediation Plan — 2026-06-24

> Branch: `fix/ui-ux-remediation`. Scope: **UI/UX only** (no backend/business logic).
> Method: every fix is **visually verified** in a running dev server (`127.0.0.1:3000`,
> Chrome DevTools MCP), in BOTH light + dark themes — because the prior fix rounds
> regressed precisely by shipping token math without visual QA
> (`docs/ai/handoffs/2026-06-24-source-dossier-theme-bridge.md`: "Authenticated
> staging/browser visual QA was not verified").
>
> Source of truth for design = handoff bundle
> `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`.
> Full machine audit (60 verified findings) lives in the workflow output; this doc is
> the actionable, sequenced tracker.

## Root cause of "we changed a lot, still not solid"

1. **Multi-layer token pipeline** `packages/shared/src/design-tokens-css.ts` (source)
   → `_tokens.generated.css` / `_aurora-tokens.generated.css` / `_tokens-shadcn.generated.css`
   → `aurora.css` + `globals.css`. Fixes were sometimes applied at the wrong layer, so
   the rendered surface drifted from the emitted token (e.g. panel `#0E1521` vs design `#121B2D`).
2. **No visual QA** — token tests passed, the screen was never looked at.
3. **Two parallel dossier systems** — the new `ds-*` (`source-dossier-scene.css` +
   `*SourceScene` fns) is ACTIVE; the old `da-*` (`AmbientScene`, `DossierStoryCharacter`,
   ~16 `*Scene` fns, ~280 lines of CSS) is DEAD code that still confuses every reader.

## Operating principle — bug vs. intentional decision

The handoff prototype is "Move" with teal/green. The product is **LocateFlow** with
**Gold (dark) / Sapphire (light)** — these and several layout choices are **deliberate,
documented product decisions** (`docs/design-sync/DECISIONS_LOG.md`). We **fix genuine
bugs and visual/UX breakage**; we **do NOT revert deliberate product decisions** to chase
prototype parity. Intentional divergences are listed in the appendix and only get a
docs note, not a code change.

---

## Phase 1 — Theme foundation (token pipeline + light theme)

| ID | Sev | Item | Files |
|----|-----|------|-------|
| P1-A | Med | Verify light theme renders correctly across key public pages in browser (beige canvas `#EFEADF`, white cards) — baseline confirmed on landing; sweep features/why-free/pricing/sign-in. | (visual) |
| P1-B | Med | TEMA-03: stale `colors_and_type.css` (orange `#f97316` + Inter) contradicts live tokens — regenerate from `design-tokens-css.ts` or delete. | `docs/design-system/colors_and_type.css` |
| P1-C | Med | TEMA-01: aurora panel surface drift `--au-base-2 #0E1521` vs design `#121B2D`; confirm intent, then reconcile or document. | `apps/web/src/styles/_aurora-tokens.generated.css:13`, `design-tokens-css.ts` |
| P1-D | Low | TEMA-02: display tracking double-source (Tailwind `-0.02..-0.03em` vs `.h1/.h2` token `0`). Pick one source. | `tailwind.config.ts:181-184`, `globals.css:139` |
| P1-E | Low | TEMA-05: `reveal-modal` hardcoded hex bypasses tokens. | `globals.css:622-631` |

### Phase 1 status — 2026-06-24 (visual QA)

**Finding: the theme foundation is actually HEALTHY.** The repeated "fix light theme"
churn was chasing an issue that is now resolved.
- ✅ P1-A: Light theme renders correctly (beige `#EFEADF` canvas, white cards, Sapphire
  accent, dark text) and **persists across navigation** via `next-themes` storageKey
  `locateflow-theme` (`theme-provider.tsx:9-14`). Verified on `/` and `/features`,
  light + dark. No persistence bug.
- ✅ Token pipeline emits correct values from the single source `design-tokens-css.ts`.
- ↪ P1-B: `colors_and_type.css` + the whole `docs/design-system/preview/*` suite is a
  STALE pre-renewal doc subsystem (orange/Inter). **Reclassified to documentation debt**
  (does not affect runtime UI). Added a deprecation banner to the file to stop future
  agents re-introducing orange. Full preview-suite regeneration deferred.
- ↪ P1-C: aurora panel `#0E1521` vs design `#121B2D` is cosmetic; panels read correctly
  in-browser. Needs an intent decision (deliberate offset?) — deferred, not a bug.
- ↪ P1-D / P1-E: minor token-consistency cleanups — folded into a later token pass.

**Conclusion:** no urgent runtime theme bug. The visible breakage is in Phase 2
(dossier data→scene logic + cookie overlap), which is where remediation now focuses.

## Phase 2 — Global components, buttons, dossier

| ID | Sev | Item | Files |
|----|-----|------|-------|
| P2-A | **High** | DOSSIER data→scene mismatches (visually confirmed): flood→ police/patrol, school/radon→ night streetlight, **neighborhood(below-avg walk)→ crime/chase scene**. Remap `sourceDossierSceneFor`: flood→water, radon→ gas/bubbles, school→ kids/area-positive, neighborhood→ never "bad/crime" from a walk band. Update test `dossier-ambient.test.tsx`. | `dossier-ambient.tsx:117-139` |
| P2-B | Med | DOSSIER-05: housing intensity dropped (always `mid`) → wire highCost→`cost/bad` (also activates dead `CostSourceScene`). | `dossier-ambient.tsx:126,407` |
| P2-C | Med | DOSSIER-02/12: `dossierRaccoonFor()` mood helper unused on web (scene moods hardcoded). Either feed scene raccoon mood from data, or remove the dead helper to end the web/mobile mood divergence. | `dossier-ambient.tsx`, `dossier-raccoon.tsx` |
| P2-D | Med | Dead-code removal: entire `da-*` system (`AmbientScene`, `DossierStoryCharacter`, `storyPose`, ~16 `*Scene` fns + dead keyframes `da-ev-charge/da-window-glow/da-step-pulse/da-heat-shimmer` + ~280 lines). | `dossier-ambient.tsx:884-1446`, `globals.css:1357-2210` |
| P2-E | Med | Cookie Preferences panel overlaps content (dossier card / lower-right form actions). | cookie consent component |
| P2-F | Low | Button label/variant consistency ("Get the app" vs "Get started"); social-auth button layout. | `marketing-header.tsx`, `sign-in/page.tsx` |
| P2-G | Low | ANIM-A11Y-01: `landing-theme-toggle` framer spring ignores `prefers-reduced-motion`. | `landing-theme-toggle.tsx:67-72` |

### Phase 2 status — 2026-06-24

- ✅ **P2-A DONE & verified** (`dossier-ambient.tsx:117-139`, test `dossier-ambient.test.tsx`):
  `sourceDossierSceneFor` remapped — **flood→water** (was area/police), **radon→air**
  (was area/streetlight), **school→area/good** (was dim mid), and **neighborhood walk
  band clamped to good/mid — the area "bad" crime/chase scene can NEVER render for a low
  walkability score**. 30/30 vitest pass; verified live (`anyCrimeChaseScene:false`,
  flood row = water, radon row = air, neighborhood = area/mid).
  - Known imperfection: `school` uses the `area/good` (safe-neighbourhood, patrol-car)
    scene as a stand-in — no education scene exists in the active source type set. Revisit
    when adding a dedicated scene (see P3-F parity).
- ✅ **P2-B**: housing already correct — `housing→housing` renders the single-variant
  `HousingSourceScene` (`dossier-ambient.tsx:577`); intensity is intentionally unused
  (one housing scene). No change needed. (The report's housing→cost finding referred to
  superseded code.)
- ▸ Next: P2-C (mood helper), P2-D (dead `da-*` removal), P2-E (cookie overlap), P2-G (toggle a11y).

## Phase 3 — Page by page (real bugs; document intentional)

| ID | Sev | Item | Files |
|----|-----|------|-------|
| P3-A | **High** | Mobile public header overflows at 390px. | `marketing-header.tsx:49-69` |
| P3-B | Med | Bottom-nav tab set/order + active-state weight vs design. | `mobile-nav.tsx:19-25,42-54` |
| P3-C | Med | Dashboard home slot order / countdown split / personalized greeting. | `dashboard-client.tsx` |
| P3-D | Med | Features page layout vs design (or document as intentional). | `features/page.tsx:53-104` |
| P3-E | Low | Why-Free, footer, nav, auth deltas — align or document. | various |
| P3-F | Lower | Web↔mobile dossier parity (larger effort; sequence last). | web + mobile dossier |

### Phase 3 status — 2026-06-24

- ✅ **P3-A VERIFIED ALREADY FIXED**: at a true 390 px mobile viewport the marketing
  header has **no horizontal overflow** (`horizontalOverflow:false`, no overflowing
  children). The auth CTAs are `lg:flex`-gated (`marketing-header.tsx:62-73`) — the
  2026-06-23 overflow was fixed before this pass. No change needed.

---

## Session progress log — 2026-06-24 (branch `fix/ui-ux-remediation`)

| Item | Result |
|------|--------|
| Phase 1 (theme) | Theme foundation **healthy** — light renders + persists (`locateflow-theme`). Stale `colors_and_type.css` got a deprecation banner. No runtime theme bug. |
| P2-A dossier remap | **FIXED + verified** — flood→water, radon→air, school→area/good, neighborhood never crime/chase. 30/30 vitest, live-confirmed. |
| P2-G toggle a11y | **FIXED** — `useReducedMotion()` gate on the framer spring. `tsc` clean. |
| P3-A mobile header | **Already fixed** — verified no overflow at 390 px. |
| P2-D dead `da-*` | **Reframed** — the dead `*Scene` fns (flood waves, radon bubbles, school kids, EV, skyline) are reusable feature scenes; integrate into `ds-*` rather than delete (folds into P3-F). Pure-dead `AmbientScene`/`storyPose`/`DossierStoryCharacter` cleanup deferred. |
| P2-E cookie / P2-F buttons | Cookie = works-as-designed (dismissable; mobile is more intrusive but standard). Button-label consistency folded into Phase 3 page work. |
| Dossier deepening — flood (1/5) | **NEW** — `flood` is now a first-class scene type with a dedicated `FloodSourceScene` (drifting parallax water bands that rise toward the raccoon with risk) + `ds-flood*` CSS. 31/31 vitest, `tsc` clean, verified live. Pattern template for radon/school/EV/neighborhood. |
| Scene-tone color bug | **FIXED (real bug)** — `--info`/`--warning`/`--success` are shadcn HSL triplets (`184 66% 25%`), not full colors; `--ds-tone: var(--info)` rendered **transparent**. Wrapped as `hsl(var(--info))` in `sourceSceneVars` — also un-hid the latent water-good / transit-good scene tones that were silently invisible. |

| Dossier deepening (5/5) | **DONE** — `flood`/`radon`/`school`/`ev`/`hood` are now first-class scene types with dedicated `*SourceScene` components + `ds-*` CSS (water bands, gas bubbles, kid silhouettes, charge bolt/nodes, lit skyline). Replaces the generic area/water/air stand-ins. |
| Dossier positioning | **DONE** — row text lifted above the scene (`.lf-dossier-row > .da-layer ~ *` z-index) so captions stay readable; raccoon shifted right (`.ds-char margin-left:15%`) into the empty zone; scene tag fixed to a top-right chip; raccoon `z-index:5` above decorations. Assessed via dark-theme screenshots. |
| Dossier demo cycle | **DONE (showcase only)** — each row rotates through its scene states every 3s, staggered by row index (top→bottom ripple, mixed cascade); motion-safe (0 under reduced-motion / SSR → honest sample). `dossier-showcase.tsx` useDemoCycle/cycleAmbient. |
| Dead `da-*` removal | **DONE (TSX)** — removed ~580 lines of the never-rendered da-* scene system (the source of the `RADON_BUBBLES`/`HOOD_BUILDINGS` collisions). Dead da-* CSS in globals.css is orphaned/harmless, left for a follow-up. |

**Net:** the recurring "theme still broken" was largely a non-issue (theme is healthy); the
real defects were the dossier **data→scene logic errors** (now fixed) and an a11y gap.
Several audit items were already-fixed or intentional product decisions. The dossier
feature scenes, positioning, demo cycle, and dead-code cleanup are complete and committed.

**Working tree:** changes uncommitted on `fix/ui-ux-remediation`
(`dossier-ambient.tsx`, `dossier-ambient.test.tsx`, `landing-theme-toggle.tsx`,
`colors_and_type.css`, this doc).

## Appendix — Intentional divergences (DO NOT revert; doc-note only)

- Brand name **LocateFlow** (not "Move") — D1.
- Accent **Gold (dark) / Sapphire (light)** (not teal/green) — D5/D13.
- Extra landing sections (stats, risk grid, bilingual, early-access, pricing) — free-model/SEO product decisions.
- Sidebar+header web app shell (not phone frame) — expected web adaptation.
- Richer footer / nav link set, compliance-rich dossier fact rows.
- Mobile bottom-nav = Dashboard/Addresses/Moving/Services/Settings + a header hamburger for
  overflow (Providers/Budget/Notifications/…), vs the design's Home/Moving/Services/Addresses/
  **More** tab — intentional IA (hamburger-for-overflow is a standard mobile pattern). The
  filled-accent active state (vs the design's color-only) is a deliberate, clearer touch
  affordance. `mobile-nav.tsx`. (SHELL-02/03 — verified live, documented, not changed.)
- Onboarding move-plan validation (the 2026-06-23 audit's "rejects a visibly filled
  destination/date form") was already FIXED post-audit: `validateMovingForm` back-fills
  city/state/zip from the autocomplete/typed address via `deriveMovingDestinationFields`
  (`onboarding-client.tsx`); `onboarding-move-validation.test.ts` passes 6/6. Not a current bug.
- **Web↔mobile dossier parity (DOSSIER-01):** mobile is NOT missing anything — its
  `apps/mobile/src/components/ui/DossierAmbient.tsx` is a full 1496-line RN implementation
  (react-native-reanimated + react-native-svg) with its OWN feature scenes (flood waves, kid
  walkers, etc.). Web (`ds-*` raccoon vignettes) and mobile (kind-axis abstract ambient) are
  two complete-but-different systems. True visual parity = a large rewrite of one platform —
  an optional design-consistency project, NOT a bug. Deferred; both platforms work today.

## Verification protocol per fix

1. Edit at the correct layer (token model → `pnpm tokens:emit` if a token).
2. Reload `127.0.0.1:3000`, screenshot the affected surface in **light AND dark**.
3. Run relevant `vitest` + `tsc --noEmit`.
4. Commit with a focused message; update this tracker's status.

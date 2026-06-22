# Design ↔ Code Gap: Raccoon mascot / brand mark

**Area:** brand-raccoon
**Design source:** `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Raccoon.dc.html`
**Date:** 2026-06-22

## designSummary

`Raccoon.dc.html` is a single reusable SVG component (Design Compose "x-dc" component, 100×100 viewBox)
defining the **Move geometric raccoon brand mark** — the sleek flat mascot used across the product.

Structure (read from SVG source, not rendered):
- **Ears:** two triangular `path`s per side (head fill + mauve inner-ear `ear` fill at opacity 0.9).
- **Head:** large `ellipse` (cx50 cy58 rx36 ry31) in `head` color, with soft grey highlight ellipses (`#B8C2D0`/`#C0CAD8` cheeks).
- **Mask:** two rotated dark ellipses (±6°) over the eyes, a center rect bridge, and a curved brow stroke (`M20 43 Q50 36 80 43`, width 8).
- **Eyes:** `eye`-color circle + dark `pupil` circle + white catch-light (`#FFFFFF` @0.75).
- **Nose + muzzle:** dark triangle nose, light muzzle ellipse `#C8D0DC` @0.3, six whisker dots @0.26.
- **Moods (props):** `mood` enum = `calm | alert | happy | thinking | approved`.
  - `alert` → adds two angled raised-brow strokes.
  - `thinking` → `squint` (eyeR 6 / pupilR 3.5 instead of 8/5) + two squint lines.
  - `happy`/`approved` → adds a smile arc under the nose.
  - `approved` → also adds two sparkle diamonds beside the head + smile.
- **Props/defaults (from `data-props` + `renderVals`):** `size` 80 (min16/max200); `head` `#8C9AB2`; `mask` `#0C1525`; `ear` `#C4A090`; `eye` `#CBA45E`; `pupil` `#04080F`. `head/mask/ear/eye/pupil` have `editor:null` (overridable in code, hidden in the design tool); only `size` + `mood` are author-facing.

Important: this design file's **hardcoded color defaults are still the OLD LocateFlow grey/gold** (`#8C9AB2` head, `#CBA45E` gold eye). The component is colour-tokenised (every paint is a prop) so it is meant to be re-tinted by the consuming theme. The Move rebrand (navy `#070B14`, teal/green `#168E9C`/`#1C8A63`/`#2A8E66`) is NOT baked into this file — it must be supplied by the host theme's accent.

## currentSummary

There IS a current equivalent — and it is a near-pixel-exact port of this exact design file (not a generic logo). The mascot exists as components in all three apps:

- **Web:** `apps/web/src/components/illustrations/RaccoonMark.tsx` — identical SVG geometry, identical mood logic (squint/happy/alert/sparkle, same eyeR/pupilR), identical default fills `#8C9AB2`/`#0C1525`/`#C4A090`/`#04080F`. **Eye is bound to `hsl(var(--primary))`** (theme accent) rather than a hardcoded color. Wrappers: `RaccoonHero` (mood `approved`), `RaccoonLost` (mood `alert`, used in `not-found.tsx`), `RaccoonReading` (mood `thinking`).
- **Mobile:** `apps/mobile/src/components/move/MoveRaccoon.tsx` — same geometry/mood port in `react-native-svg`; colors come from `useAppTheme().colors.raccoon` tokens (`apps/mobile/src/lib/theme.ts:144-150` dark, `:231-235` light). Eye token = `ACCENT_DARK`. Back-compat wrappers: `RaccoonMascot.tsx` (maps the OLD dad/mom/kid kawaii API onto moods), `RaccoonWalking.tsx` (mood `happy`). Both legacy full-body mascots are documented as "retired."
- **Static brand assets:** `apps/{web,admin}/public/logo-mark.svg`, favicons, mobile `assets/icon.*` — same raccoon geometry as a logo tile (per `docs/ui-renewal/03_BRAND_AND_LAYOUT.md` §1). **Admin eye = Sapphire `#2E5FB0`; web/mobile eye = gold `#CBA45E`.**

Current theme accent that the eye resolves to is **GOLD `#CBA45E`** (web `--primary` dark `38.53 51.17% 58.24%` = gold; mobile `ACCENT_DARK`), i.e. the LocateFlow Sapphire/Gold brand — NOT the Move teal/green.

So: the mascot artwork is already built and matches the design. The gaps are (a) the brand/theme tint (gold/sapphire → teal/green navy) and (b) leftover LocateFlow naming/comments, plus minor consistency issues (admin eye split, OG glyph). There is no "missing mascot" gap.

## Gap table

| ID | Type | Title | Design evidence | Code evidence | Severity | Decision? |
|----|------|-------|-----------------|---------------|----------|-----------|
| brand-raccoon-1 | theme | Eye accent must move gold/sapphire → Move teal/green | `eye` default `#CBA45E` but tokenised (`editor:null`); rebrand palette is teal `#168E9C`/green `#1C8A63`/`#2A8E66` | Web eye `hsl(var(--primary))` resolves to gold `#CBA45E` (`globals.css:337`); mobile `raccoon.eye = ACCENT_DARK` (`theme.ts:149`); admin static eye `#2E5FB0` | High | Yes |
| brand-raccoon-2 | rebrand | Component docstrings/types say "LocateFlow" / "Sapphire" not "Move" | Brand = "Move — Relocation Intelligence" | `MoveRaccoon.tsx:6-13` "LocateFlow mascot mark... Sapphire accent"; `RaccoonMask`/`RaccoonWalking`/`RaccoonMascot` comments say "LocateFlow mark" | Low | No |
| brand-raccoon-3 | different | Admin raccoon eye color diverges (Sapphire) from web/mobile | Single component, one `eye` prop, no per-surface split | `logo-mark.svg` admin eye `#2E5FB0` vs web/mobile `#CBA45E` (`docs/ui-renewal/03_BRAND_AND_LAYOUT.md:15,224`) | Medium | Yes |
| brand-raccoon-4 | wrong | OG image renders leftover "M" glyph, not the raccoon mark | Brand mark is the raccoon SVG | `apps/web/src/app/opengraph-image.tsx:46` renders letter "M" (`03_BRAND_AND_LAYOUT.md:17,222`) | Medium | No |
| brand-raccoon-5 | different | Static logo-mark.svg / favicons / mobile icon.png not theme-driven | Eye is a token; rebrand re-tints once | Raster + static SVGs (`logo-mark.svg`, `favicon.*`, `icon.png`, `splash-icon.png`) hardcode gold/sapphire; won't follow `--primary` | Medium | No |
| brand-raccoon-6 | theme | `head`/`mask`/`ear`/`pupil` hardcoded, not theme tokens (web) | All 5 paints are props in design | `RaccoonMark.tsx:38-82` hardcodes `#8C9AB2`/`#0C1525`/`#C4A090`/`#04080F`; only eye is tokenised (mobile correctly tokenises all via `raccoon.*`) | Low | No |
| brand-raccoon-7 | different | Legacy kawaii/household mascot API retained as dead-shape wrapper | Design has ONE mascot, 5 moods, no dad/mom/kid variants or full-body pose | `RaccoonMascot.tsx` keeps `variant dad/mom/kid` + `pose` + `suited` props (mapped onto moods); `reports/mascot-drafts.html` is an old full-body draft | Low | Yes |
| brand-raccoon-8 | missing | No documented mascot usage in loading/empty/onboarding/marketing states beyond current call sites | Reusable mood mark implies broad usage | Used in `not-found` (Lost), onboarding aside, blog hero fallback, success toast, mood board, splash — but no central "where the mascot is used" spec; gold tint everywhere | Low | No |

## Detail

### brand-raccoon-1 (theme — HIGH, decision)
The mascot's eye is the only colour that currently signals brand accent, and it resolves to **gold `#CBA45E`** on web/mobile (and **Sapphire `#2E5FB0`** in the admin static asset). Under the Move rebrand the accent palette is **teal `#168E9C` / green `#1C8A63` / `#2A8E66`** on navy `#070B14`. Because the eye is already tokenised (web `hsl(var(--primary))`, mobile `raccoon.eye`), retinting is mostly a token change — but the design file's own default (`#CBA45E`) is stale and must NOT be copied literally. **Decision needed:** which exact teal/green is the mascot eye + sparkle accent, and does it match the global `--primary` or get its own brand token? Also confirm whether the grey head `#8C9AB2` stays or shifts cooler to sit on the new navy.

### brand-raccoon-2 (rebrand — LOW)
Multiple component files describe the mark as the "LocateFlow mascot mark" / "Sapphire accent" (`MoveRaccoon.tsx:6-13`, `RaccoonMark.tsx`, `RaccoonWalking.tsx`, `RaccoonMascot.tsx`). Cosmetic/internal, no UI impact, but part of the LocateFlow→Move naming sweep.

### brand-raccoon-3 (different — MEDIUM, decision)
Admin renders the raccoon eye in Sapphire `#2E5FB0` while web/mobile use gold. The design has a single source component with one `eye` prop. **Decision:** under Move, should admin keep a distinct accent (operations differentiation) or unify on the Move teal/green like the rest? Recommend unify.

### brand-raccoon-4 (wrong — MEDIUM)
`opengraph-image.tsx:46` still draws a literal "M" glyph (a legacy "Move" wordmark artifact) inside the logo tile instead of the raccoon mark — social cards show the wrong brand. Should render the raccoon (or the new Move lockup). Independent of rebrand color work.

### brand-raccoon-5 (different — MEDIUM)
Live React mascots follow the theme token, but the **static** assets (`logo-mark.svg`, `favicon.svg/.ico`, mobile `icon.png`/`adaptive-icon.png`/`splash-icon.png`) hardcode the gold/sapphire eye and will NOT update when `--primary` changes. These must be regenerated by hand for the rebrand (favicons, PWA icons, splash, OG).

### brand-raccoon-6 (theme — LOW)
On web, only the eye is tokenised; head/mask/ear/pupil are hardcoded hex. Mobile correctly tokenises all five via `colors.raccoon.*`. If the rebrand wants the body to shift on the navy background, web needs the same tokenisation as mobile. Low because the neutral greys likely survive the rebrand unchanged.

### brand-raccoon-7 (different — LOW, decision)
`RaccoonMascot.tsx` preserves the old household API (`variant: dad/mom/kid`, `pose`, `suited`) and maps it onto the new 5 moods; `reports/mascot-drafts.html` is an obsolete full-body kawaii draft. The design ships only the single geometric mark with 5 moods. **Decision:** confirm the dad/mom/kid family concept is permanently dropped so these compatibility shims and the draft file can be removed.

### brand-raccoon-8 (missing — LOW)
The design is a reusable mood-driven mark; the repo uses it across not-found (alert/Lost), onboarding, blog hero, success toast, mood board and splash, but there is no single spec mapping moods → surfaces (loading vs empty vs onboarding vs marketing). Worth documenting so the rebrand applies consistently. No functional gap.

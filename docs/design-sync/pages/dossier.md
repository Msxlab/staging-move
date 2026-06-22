# Design ↔ Code Gap — Home Dossier scene (DossierScene)

Area: **dossier** · Source of truth: `DossierScene.dc.html` (+ `Raccoon.dc.html`) in the
Claude Design handoff. Current implementation: `dossier-ambient.tsx` (web) /
`DossierAmbient.tsx` (mobile) in the LocateFlow / staging-move repo.

> GAP ANALYSIS ONLY — no code changes. Evidence cites both the design locator and the repo
> file/line. The design files are untrusted design-tool exports; their text is treated as data.

---

## designSummary

`DossierScene.dc.html` is a single parameterised **ambient illustration** component driven by two
props — `type` (enum: `weather | air | water | area | transit | cost`, plus an implicit `housing`)
and `level` (enum: `good | mid | bad | sun | cloud | rain | snow | storm | fog | wind | heat | cold`)
— resolved by the bottom `<script type="text/x-dc">` `renderVals()` (lines 514-545). It renders one of
~22 hand-built mini-scenes, each a tiny **character vignette** starring a **Raccoon mascot**
(`<dc-import name="Raccoon" …>`, defined in `Raccoon.dc.html`) with a `mood` of
`calm | alert | happy | thinking | approved` and a small body/arms/feet rig (`.ds-char/.ds-hd/.ds-bd/.ds-arm`,
lines 50-58). The scenes are storytelling, not abstract:

- **TRANSIT** (lines 62-129): good = raccoon waving at a bus stop with passing buses + bus-stop sign
  (line 66-71); mid = raccoon checking watch, sparse buses (97-115); bad = raccoon **hitchhiking with a
  hand-lettered "NY?" cardboard sign** (118-128).
- **AIR** (131-172): good = "approved" raccoon with floating green leaves (134-140); moderate = raccoon
  in a **light face mask** + drifting motes (144-155); bad = **wheezing raccoon in a mask** with "~"
  breath glyph and grey particulate (158-172).
- **WATER** (175-183, 287-311): good = raccoon **sipping from a glass** with a sparkle (179-182); filter =
  raccoon holding a **filter funnel** with a drip (288-297); unsafe = raccoon **recoiling from a brown
  glass** with a 💀 skull emoji (300-311).
- **AREA / crime-safety** (185-257): high = **officer raccoon wearing a police cap + badge/star**, a
  passing patrol car with flashing red/blue lights (186-212); mid = raccoon under a lit streetlamp glancing
  around (215-224); low = **a raccoon being chased right→left by two shadowy figures with red eyes** under a
  flickering lamp + "!" alert (227-257).
- **COST** (259-285): good = relaxed raccoon, rising "$" coin (260-268); bad = **stressed raccoon, rising
  price tag + "↑" + sweat drop** (271-285).
- **HOUSING** (313-332): raccoon by a **house with lit windows**, a "RENT" sign, magnifier glass (gold).
- **WEATHER** (334-510): sun, cloud (puffy parallax), rain (**raccoon opens an umbrella**), snow (**scarf
  raccoon + a built snowman**), storm (lightning flash + bolt SVG), fog (**raccoon with white cane + dark
  shades + warning triangle**), wind (leaning raccoon + flying leaf), heat (**raccoon kicks a broken AC
  unit** + impact star + sweat), cold (**shivering raccoon, scarf, breath puff**).

Heavy use of expressive CSS `@keyframes` (lines 13-49): bob, breathe, heave, wave, sip, kick, chase,
hitchhike tumble, umbrella-open, shiver, etc. Color is themed through CSS vars: raccoon uses
`--rc-head/--rc-mask/--rc-ear/--rc-eye/--rc-pupil`; scenes use `tone`/`glow` props plus
`--green/--teal/--amber/--red`. The component-level default `tone` is **`var(--gold)`** and default
`glow` is `rgba(203,164,94,0.18)` (lines 514, 523-524) — a LocateFlow Sapphire/Gold leftover.

## currentSummary

The repo's dossier ambient is `DossierAmbient` — web `apps/web/src/components/dashboard/dossier-ambient.tsx`
and a ported-for-parity mobile `apps/mobile/src/components/ui/DossierAmbient.tsx`. It is an
**abstract, data-derived decorative layer**, not a character system. Parameters are a `kind`
(`flood | school | hazard | radon | water | air | housing | evCharging | neighborhood | weather`), an
`intensity` (`0 | 1 | 2`), and an optional `variant` (`lightning | wind | winter | sun | cloud | rain |
storm | snow | fog | heat | cold`) — `dossier-ambient.tsx` lines 28-59. Crucially, `ambientForSection()`
(193-261) derives the scene **from the real dossier section data** (FEMA flood, NRI hazards, EPA radon
zone, AQI, HUD rents, walk band, weather forecast) so "decoration is honest ambience, never fabricated
information" (file header, 5-24).

Each scene is geometric/atmospheric: `FloodScene` = 3 stacked sine waves; `SchoolScene` =
hairline sidewalk + tiny walking silhouettes; `WindScene` = thin streaks; `WinterScene`/`RadonScene` =
falling/rising particle dots; `WaterScene` = ripples + drops; `AirScene` = breeze streaks + a leaf;
`HousingScene`/`NeighborhoodScene` = skyline rects + bars + lit window dots; `EvScene` = a dashed path +
pulsing nodes + bolt; weather `SunScene/CloudScene/RainScene/FogScene/HeatScene` + lightning. **There is
no Raccoon (or any character) in any scene** — confirmed by repo-wide grep: the only raccoon assets are
the unrelated marketing/empty-state mascots (`apps/web/src/components/illustrations/Raccoon*`,
`apps/mobile/.../RaccoonMascot|Walking`, per `docs/ui-renewal/02_COMPONENT_CATALOG.md` lines 25, 122-123),
which are never imported by `dossier-ambient.tsx`. The layer is wired into `home-dossier.tsx` (10 calls,
lines 735-1064) and rendered on the right ~55% of each section row, masked, aria-hidden, IntersectionObserver-
paused, reduced-motion safe. Palette comes from theme tokens (web `--fg/--rose/--foil-b/--sage/--danger`;
mobile `theme.colors.text/primary/accent/success/error`).

The current code is, if anything, *more* engineered than the design (data-driven intensity, SSR-stable
deterministic layouts, count-up hook), but it is a **different visual concept**.

---

## Gap table

| ID | Type | Title | Design evidence | Code evidence | Severity | Decision? |
|----|------|-------|-----------------|----------------|----------|-----------|
| dossier-1 | new | Raccoon mascot is the centre of every scene | `Raccoon.dc.html` + `<dc-import name="Raccoon" mood=…>` in all ~22 scenes (e.g. DossierScene.dc.html:69,110,138,201,237,491) | No character in `dossier-ambient.tsx`; scenes are abstract (waves/streaks/particles). Raccoon mascots exist elsewhere only (`02_COMPONENT_CATALOG.md:122-123`) | High | Yes |
| dossier-2 | different | Scene taxonomy: `type` vs `kind` mismatch | Props `type`= `weather/air/water/area/transit/cost` + `housing` (DossierScene.dc.html:514-539) | `kind`= `flood/school/hazard/radon/water/air/housing/evCharging/neighborhood/weather` (dossier-ambient.tsx:28-38) | High | Yes |
| dossier-3 | missing | TRANSIT scene (bus stop / waiting / hitchhike) | DossierScene.dc.html:62-129 (good bus-wave, mid watch-check, bad "NY?" hitchhike sign) | No `transit` kind anywhere in `dossier-ambient.tsx` | Medium | Yes |
| dossier-4 | missing | COST scene (rising $/price-tag, sweat) | DossierScene.dc.html:259-285 | No `cost` kind; `housing` derives cost-intensity but renders skyline bars only (dossier-ambient.tsx:608-631) | Medium | Yes |
| dossier-5 | missing | AREA / crime-safety scene (officer raccoon, patrol car, night chase) | DossierScene.dc.html:185-257 (areaHigh/areaMid/areaLow) | No crime/safety/area kind. Closest is `neighborhood` skyline (dossier-ambient.tsx:684-713) — different concept | Medium | Yes |
| dossier-6 | different | AIR scene is mask-storytelling vs abstract streaks | DossierScene.dc.html:131-172: leaves (good), raccoon in mask (mod), wheezing masked raccoon + "~" (bad) | `AirScene` = breeze streaks + one leaf + haze block (dossier-ambient.tsx:570-599) | Medium | No |
| dossier-7 | different | WATER scene is sip/filter/skull vs ripples | DossierScene.dc.html:175-183,287-311 (glass sip, filter funnel, 💀 brown glass) | `WaterScene` = ellipse ripples + falling drops (dossier-ambient.tsx:531-561) | Medium | No |
| dossier-8 | different | WEATHER props/details (umbrella, snowman, cane+shades, AC kick) | DossierScene.dc.html:366-510 rich props | Web weather scenes are atmospheric only — sun disc, cloud puffs, rain dots, fog lines, heat lines, lightning; no umbrella/snowman/cane/AC (dossier-ambient.tsx:727-808) | Medium | No |
| dossier-9 | different | HOUSING: house+RENT-sign+magnifier raccoon vs skyline bars | DossierScene.dc.html:313-332 | `HousingScene` = 2 roof glyphs + 4 growing bars (dossier-ambient.tsx:608-631) | Low | No |
| dossier-10 | missing | Current `flood/school/radon/evCharging/neighborhood` scenes absent from design | — (no design equivalent) | `dossier-ambient.tsx`: FloodScene, SchoolScene, RadonScene, EvScene, NeighborhoodScene | Medium | Yes |
| dossier-11 | theme | `tone`/`glow` default to `var(--gold)` (LocateFlow), not Move teal/green | DossierScene.dc.html:514,523-524 default `tone:var(--gold)`, `glow:rgba(203,164,94,0.18)`; gold reused 330,514,523 | Repo uses tokenised accents (web `--foil-b/--sage`; mobile `theme.colors.accent/success`); no `--gold` in scene | Low | Yes |
| dossier-12 | theme | Raccoon palette tokens (`--rc-*`) have no repo equivalent | `Raccoon.dc.html:54-72` defaults `head #8C9AB2, mask #0C1525, ear #C4A090, eye #CBA45E, pupil #04080F` | No `--rc-head/--rc-mask/--rc-ear/--rc-eye/--rc-pupil` tokens exist in the dossier layer | Low | Yes |
| dossier-13 | different | Mood-driven expression model absent | `Raccoon.dc.html` `mood` enum + `alert/squint/sparkle/happy` flags (23-44, 57-72); scenes pick moods to convey risk | No facial/mood concept; risk is shown via intensity (particle count / speed / color) only | Low | No |
| dossier-14 | different | Data-honest derivation vs design's manual `level` | `level` is an explicit author-set enum (DossierScene.dc.html:518) | `ambientForSection()` derives intensity/variant from REAL section data (dossier-ambient.tsx:193-261) — a deliberate product principle to preserve | Medium | Yes |
| dossier-15 | new | Emoji/glyph storytelling props (💀, NY?, RENT, "$", "↑", "!", "~") | DossierScene.dc.html:127,170,233,278,304,324 | No emoji/text glyphs in current scenes (all vector/geometry) | Low | No |

stats: High 3 · Medium 8 · Low 4 · decisions 9

---

## Detail & recommendations

### dossier-1 / dossier-2 — Concept & taxonomy divergence (the headline gap)
The design re-imagines the dossier ambient as a **Move-brand raccoon character system**: every section
is a small narrative vignette where the mascot reacts (waves, masks up, sips, hitchhikes, kicks the AC).
The current `DossierAmbient` is an **abstract, data-derived atmosphere layer** with a *different prop
contract* (`kind`+`intensity`+`variant` vs design `type`+`level`). These are not "skin" differences —
adopting the design means re-authoring the entire scene library AND the call sites in `home-dossier.tsx`
(10 `ambientForSection({kind…})` calls, lines 735-1064) and the mobile `HomeDossierCard`. **Decision
needed:** is the dossier ambient being rebranded to the character system, or do we keep the abstract
system and only retheme colors? This is the single biggest scope call in this area.

### dossier-3 / dossier-4 / dossier-5 / dossier-10 — Scene set mismatch
The design adds **transit, cost, and area/crime-safety** scenes that have no current equivalent, while
the current code has **flood, school, radon, evCharging, neighborhood** scenes that the design does not
depict. If the design's scene list is authoritative, several existing data-backed scenes would be dropped
and three new ones added — a product/data decision (the new ones must be wired to real data sources, e.g.
a transit/crime feed, to honor the "honest ambience" principle in dossier-ambient.tsx:5-24).

### dossier-6 … dossier-9, dossier-13, dossier-15 — Per-scene visual rewrites
Even for the scenes both sides share (air, water, weather, housing), the design's treatment is character-
and prop-driven (masks, funnels, umbrellas, snowman, cane, AC unit, emoji glyphs) versus the current
particle/streak/ripple geometry. Each is a full re-illustration, not a tweak.

### dossier-11 / dossier-12 — Theme tokens
The design DossierScene still defaults `tone` to `var(--gold)` and ships LocateFlow-era gold glow values,
and introduces a raccoon palette (`--rc-*`) that the repo lacks. Under the Move rebrand (navy #070B14 +
teal/green #168E9C/#1C8A63/#2A8E66) these defaults are stale and would need re-tokenising regardless of
whether the character system is adopted. Note the design file's own gold defaults appear to be leftovers
rather than intended Move values — verify against the Move theme tokens before copying.

### dossier-14 — Preserve the data-honesty principle (caution)
The current system's strongest property is that scene/intensity is **derived from real section data**, not
hand-set. The design exposes `level` as a manual enum. Any migration to the raccoon system should keep the
`ambientForSection()` mapping layer so moods/intensities remain truthful — flagged so it is not lost in a
visual port.

## Open questions
1. Is the dossier ambient in scope for the raccoon-character rebrand, or is only color/theme being updated?
2. Are transit / cost / crime-safety (area) scenes new product features with real data sources, or
   illustrative only? What feeds them?
3. Should the existing flood / school / radon / evCharging / neighborhood scenes be kept, dropped, or
   re-illustrated in the raccoon style?
4. Should the data-derived `ambientForSection()` mapping be preserved on top of any new character scenes?
5. Are the design's `var(--gold)` / `rgba(203,164,94,…)` defaults intentional, or stale LocateFlow values
   to be replaced with Move teal/green?

# 01 — Design-System Delta (NEW "Move" handoff ↔ CURRENT "LocateFlow")

**Area:** design-system-delta · **Type:** GAP ANALYSIS ONLY (no code changes).

**Sources**
- NEW design (source of truth): `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/`
  - `support.js` (dc-runtime — see note below), `Move.dc.html`, `Move Web.dc.html`, `Index.dc.html`, `Web.dc.html`, `Admin.dc.html`, `manifest.json`.
- CURRENT system: `docs/ui-renewal/01_THEME_SYSTEM.md`, `docs/ui-renewal/02_COMPONENT_CATALOG.md` (repo root `C:/Users/Windows/Desktop/Staging/staging-move/`).

> **Important correction up front.** `support.js` (1513 lines) is the **generic Design-Component runtime** ("dc-runtime") — a React-template compiler/boot loader. It contains **zero design tokens, colors, or component primitives**. The design system in this handoff is **not centralized**: each page hardcodes its palette inline (a `:root`-style `--var` string set on the page wrapper, or a JS `theme()` method that emits a `--var` string). So the "shared design source" is really **per-page inline token strings**, which I reconciled across `Move.dc.html` (mobile), `Move Web.dc.html` / `Web.dc.html` / `Index.dc.html` (web), and `Admin.dc.html` (admin).

> **Second correction (affects every gap below).** The brief frames the rebrand as "a DARK navy palette with teal/green accents (#168E9C/#1C8A63/#2A8E66)". The design source does **not** support that as the *primary brand*. Across all five pages the **default accent is still Gold `#CBA45E`** (identical to current LocateFlow), on a navy bg. `#168E9C` / `#1C8A63` / `#2A8E66` are the **light-mode semantic teal/green** and the **light-mode "Emerald" accent ramp** — Emerald being one of three selectable accents (Gold default, Sapphire, Emerald). Evidence below. This is the single biggest decision the rebrand hinges on, so it is called out as a `decisionNeeded` gap.

---

## 1. NEW token table (with hex) — reconciled from the handoff pages

### 1.1 Surfaces / neutrals (DARK — the shipped default)

| Concept | NEW value | Source |
|---|---|---|
| theme_color / PWA bg | `#070B14` | `manifest.json` (`background_color`,`theme_color`); `Web.dc.html:12` `<meta theme-color #070B14>` |
| page bg (`--bg`) web/admin/index | `#070B14` | `Move Web.dc.html:29`, `Web.dc.html:22/34`, `Index.dc.html:14`, `Admin.dc.html:343` |
| page bg (`--bg`) **mobile** | `#0A0F1C` | `Move.dc.html:1003` (mobile dark `theme()`) |
| bg2 | `#0C1322` (web) / `#0C1322` mobile | `Move Web.dc.html:29`, `Move.dc.html:1003` |
| surface | `#121B2D` | `Move Web.dc.html:29`, `Move.dc.html:1003` |
| surface2 | `#18233A` | `Move Web.dc.html:29`, `Move.dc.html:1003` |
| surface3 | `#1F2C47` (mobile) | `Move.dc.html:1003` |
| admin panel / panel2 | `--panel:#0E1626` · `--panel2:#16203a` | `Admin.dc.html:343` |
| text (`--text`) | `#EFF3FA` | all pages |
| dim (`--dim`) | `#8A99B6` | all pages |
| faint (`--faint`) | `#41526F`–`#46566F` (varies per page) | `Move Web.dc.html:29` `#41526F`; `Admin.dc.html:343` `#46566F`; `Move.dc.html:1004` `#42526F` |
| border (`--border`/`--line`) | `rgba(110,150,225,0.10–0.12)` | web `0.12`, mobile `0.10`, admin `--line rgba(120,150,210,0.12)` |
| track | `rgba(255,255,255,0.07)` | all dark |
| glass | `rgba(6,11,24,0.62)` | `Move Web.dc.html:29`, `Move.dc.html:1015` |

### 1.2 Accent system (THREE selectable accents; **Gold is default**)

`Move.dc.html:986-993` `accentFamily()` and `Admin.dc.html:342` define the same accent map. Each accent is `[base, light, deep]` with separate dark/light ramps:

| Accent | Dark `[base, light, deep]` | Light `[base, light, deep]` |
|---|---|---|
| **Gold (default)** | `#CBA45E · #DCBC7C · #B0852F` | `#9A7325 · #AD8534 · #86631A` |
| Sapphire | `#5B8DEF · #83AAF5 · #3D6FD6` | `#2E5FB0 · #3D74C8 · #244C90` |
| Emerald | `#3FB585 · #62C79E · #2C9269` | `#1C7A55 · **#2A8E66** · #125E40` |

> The brief's `#2A8E66` is **Emerald light-mode "light"**; `#168E9C` and `#1C8A63` are **light-mode semantic teal/green** (next table), not accent primaries.

### 1.3 Semantic colors (DARK / LIGHT)

| Token | Dark | Light |
|---|---|---|
| green (success) | `#54CB7E` | `#1C8A63` |
| red (danger) | `#E25C5C` | `#C73838` |
| amber (warning) | `#E0A85A` | `#A9761E` |
| teal (info) | `#37C2C9` | `#168E9C` |

Source: `Move.dc.html:1006` (dark) / `1023` (light). Web pages use the dark set inline (`Move Web.dc.html:29`).

### 1.4 LIGHT-mode surfaces — and a brand-new "lightBg" sub-palette system

Mobile `theme()` light branch (`Move.dc.html:1019-1034`): bg `#EFEADF` (greige/warm, **not** the current cool `#F2F4F8`), surface `#FFFFFF`, surface2 `#F5F0E7`, text `#101D2D`, onGold `#FFFFFF`.
`Move.dc.html` props (`:964`) expose **`lightBg` enum: Greige | Pearl | Taupe | Sapphire** (default Greige) — a *new* light-canvas selector with no current equivalent.

### 1.5 Typography

| Role | NEW | Source |
|---|---|---|
| Display / serif | **Playfair Display** (700/800/900) | every page `<link>` |
| UI / sans | **DM Sans** (400/500/600/700) | every page |
| Mono | **DM Mono** (400/500) | `Move Web.dc.html:13`, `Admin.dc.html:11` |
| Display sizes | clamp(36→60px) hero h1; 38–44px h2; mobile 60–64px countdown numerals | `Move Web.dc.html:62`, `Move.dc.html:108/321` |
| Eyebrow tracking | `.14em–.2em` uppercase, weight 700–800 | pervasive |

### 1.6 Radius / spacing / elevation

| Concept | NEW | Source |
|---|---|---|
| Radius scale | very rounded: cards **18–26px**, phone frame **42px**, pills **99px**, buttons **11–14px**, chips **7–8px**, icon-btn **13px** | `Move.dc.html:37/76/102/156`, `Move Web.dc.html:65/66` |
| Card padding | 16–22px | pervasive |
| Elevation | `0 40px 120px rgba(0,0,0,.55)` phone; gold glows `0 10px 34px rgba(203,164,94,0.3)` | `Move.dc.html:37`, `Move Web.dc.html:65` |
| Glass | `backdrop-filter:blur(6–7px)` + `--glass rgba(6,11,24,0.62)` | `Move.dc.html:270/278` |
| Gradients | foil/accent `linear-gradient(135deg,var(--gold-lt),var(--gold))`; hero `linear-gradient(135deg,#141C30,#0C1220)`; shimmer wordmark `120deg gold→#fff→gold` | `Move.dc.html:98/1011`, `Move Web.dc.html:62` |

### 1.7 Dark/light handling

Runtime accent + dark/light swap is done **in-component** via `theme()`/`rootStyle()` emitting a `--var` string (`Move.dc.html:996-1048`); `toggleTheme()` flips `state.dark` (`:1067`). Default **dark** (`theme||'Dark' !== 'Light'`, `:969`). Web/Index/Admin pages are **dark-only inline** (no light branch in those mockups).

### 1.8 Component primitives present in the mockups

These are **ad-hoc inline-styled** (no CVA / no shared component file — it's a mockup), but the recurring patterns are: pill/eyebrow badge, soft-bg chip (`goldSoft`/`amberSoft`/`redSoft`), gradient CTA button, ghost/secondary button, glass map-overlay card, hero gradient card with radial glow, progress bar (`mv-bar`), bottom tab-bar, segmented toggle, timeline rail, KPI stat card, data table rows (admin), AI-briefing card, dossier scroll-snap cards, Raccoon mascot (`dc-import name="Raccoon"`), status dot+label.

---

## 2. CURRENT token table (Sapphire/Gold — "Edition VIII LocateFlow")

From `docs/ui-renewal/01_THEME_SYSTEM.md`. Condensed:

| Concept | Dark | Light |
|---|---|---|
| Brand primary | **Gold `#CBA45E`** | **Sapphire `#2E5FB0`** |
| Gold ramp | `#DCBC7C / #B0852F / #86631A` | Sapphire `#3D74C8 / #244C90` |
| bg (web) | `#070B14` | `#F2F4F8` |
| bg (admin) | **`#171E2B`** (graphite, diverges) | `#F2F4F8` |
| surface/2/3 | `#121B2D / #18233A / #16203A` | `#FFFFFF / #EAEEF4 / #E2E7EE` |
| text (`--fg`) | `#EFF3FA` | `#14202F` |
| success/warning/danger/info | `#54CB7E / #E0A85A / #E25C5C / #37C2C9` | `#0F6B50 / #7A5418 / #A83333 / #16666B` |
| radius (md) | web `0.625rem` (10px) · admin `0.5rem` (8px) | same |
| fonts | Playfair Display / DM Sans / DM Mono (+ legacy Geist+Fraunces still loaded) | same |
| Token surfaces | **5 hand-synced copies**: `packages/shared/src/design-tokens.ts`, web `globals.css`, web `aurora.css` (`--au-*`), admin `globals.css`, admin `aurora.css` (`.adm-aurora`) | — |
| Theme infra | `next-themes` (web/admin), custom Context (mobile); default **dark** | — |

---

## 3. Side-by-side DELTA (what changes)

| Foundation | CURRENT (LocateFlow) | NEW (Move) | Change |
|---|---|---|---|
| **Product name / wordmark** | "LocateFlow" + raccoon | "**Move — Relocation Intelligence**", "100% free"; wordmark just "Move" in Playfair 900 | **rebrand** (naming) |
| **PWA identity** | name/theme-color per current manifest | name "Move", theme_color/bg **`#070B14`**, icons 192/512 maskable | **rebrand** |
| **Primary brand color** | dark = Gold `#CBA45E`, light = Sapphire `#2E5FB0` | dark = **Gold `#CBA45E` (unchanged)**, default accent Gold; light Gold = `#9A7325` | **mostly SAME** — brief's "teal/green primary" is NOT in the source |
| **Accent model** | single primary that flips Gold↔Sapphire by mode | **3-way runtime accent: Gold / Sapphire / Emerald**, each with dark+light ramp | **new** (accent selector) + **theme** |
| **Dark canvas** | web `#070B14`, admin **`#171E2B`** (diverged) | **unified `#070B14`** (web+admin+index); mobile `#0A0F1C` | **different** (admin graphite dropped; new design re-unifies) |
| **Light canvas** | cool `#F2F4F8` everywhere | **warm greige `#EFEADF`** + `lightBg` selector (Greige/Pearl/Taupe/Sapphire) | **different** + **new** |
| **Semantic light greens/teal** | success `#0F6B50`, info `#16666B` | success `#1C8A63`, info **`#168E9C`** | **different** (lighter, more saturated) |
| **Surfaces (dark)** | `#121B2D/#18233A/#16203A` | `#121B2D/#18233A/#1F2C47` (+ admin `--panel #0E1626`) | **mostly same**, surface3 + admin panels differ |
| **Radius** | 8–10px cards | **18–26px cards, 42px device, 99px pills** — far rounder | **theme** (big radius bump) |
| **Typography** | Playfair/DM Sans/DM Mono (+dead Geist/Fraunces) | Playfair/DM Sans/DM Mono (legacy fonts gone) | **same family, cleaner** |
| **Token architecture** | 5 hand-synced copies (TS + 4 CSS), aurora `--au-*` layer, shadcn HSL | mockup uses **flat per-page inline `--var` strings**, no aurora layer, no HSL | **different** (no guidance on final token home) |
| **Aurora system** | `.lf-aurora` / `.adm-aurora` wrappers, blobs, `--au-*` | not present; replaced by simple radial-glow ambient meshes | **different** / partly **missing** |

---

## 4. Component-primitive delta

| Primitive | CURRENT | NEW design intent | Type |
|---|---|---|---|
| Button | web CVA (`ui/button.tsx`: default/destructive/outline/secondary/ghost/link/**foil**); mobile rich (loading/locked/gradient/shimmer); **admin has none** | gradient-accent CTA, ghost/secondary, soft-bg pill; shimmer sweep retained | **different** (rebrand of foil→accent; admin Button still missing) |
| Badge / chip | web CVA badge + tones + plan badges; `StatusBadge` (WCAG) | soft-bg `{accent,amber,red,green}Soft` chips + status dot+label | **different** (simpler tone set; plan badges absent in mockups) |
| Card | web `default`/`glass`; admin `AdminPanel`; mobile 5 variants | hero gradient card w/ radial glow, glass map card, scroll-snap dossier cards, KPI stat card | **different** + **new** (dossier/scroll-snap, AI-briefing card) |
| Accent selector | none (mode-flip only) | **runtime Gold/Sapphire/Emerald picker** | **new** |
| lightBg selector | none | **Greige/Pearl/Taupe/Sapphire light canvas** | **new** |
| Dossier scene / condition viz | `dashboard/dossier-ambient`, `.da-*` scenes (web) | `DossierScene.dc.html` (58KB) weather/area/water/transit/cost/air condition gauges driven by props | **different**/**new** (richer, prop-driven matrix) |
| Map / route card | `route-map-card`, `TransitRouteMap` | OSM-tile map (`osmMap()`), animated dashed route, glass corner labels | **different** (live OSM tiles) |
| Raccoon mascot | web SVG illustrations + mobile components | `Raccoon.dc.html` single parametric component (`head/mask/ear/eye/pupil` props) | **different** (unified parametric mascot) |
| Aurora viz (sparkline/ring/donut) | admin `aurora/*`, web dashboard viz, mobile | admin mockup uses inline bar charts / KPI tiles | **different** |
| Tabs / bottom nav | no shared Tabs primitive; web `MobileNav` | bottom tab-bar in mobile mockup; admin left rail | **same gap** (still ad-hoc) |
| Token source-of-truth | 5 synced copies | mockup = inline per page (no canonical file shown) | **different** (no single source provided) |

**Removed / not present in the new mockups:** aurora `--au-*` wrapper layer, `.lf-aurora`/`.adm-aurora`, admin "Linear graphite" `#171E2B` canvas, plan-tier badge family (individual/family/pro/proSolid) visuals, legacy Geist/Fraunces fonts, shadcn HSL token layer.

---

## 5. Migration implication (how big is the theme swap?)

1. **A single token source is needed.** Current state already carries R1's pain (5 hand-synced copies; `aurora-theme-regression.test.ts` guards drift). The handoff does **not** provide a canonical token file — it scatters tokens inline per page. Any adoption must FIRST decide the single source (`packages/shared/src/design-tokens.ts` as build-time emitter for web CSS vars + admin vars + mobile JS) before touching values, or the rebrand multiplies the existing 5-copy problem.
2. **The actual color swap is SMALL if the brief's "teal/green primary" is dropped.** Dark Gold `#CBA45E`, surfaces `#121B2D/#18233A`, text `#EFF3FA`, semantic green/red/amber/teal dark values are **already identical** between current and new. The real dark-mode deltas are: surface3 (`#16203A→#1F2C47`), faint, border alpha, admin canvas (`#171E2B→#070B14`), and the new admin `--panel` tokens.
3. **The color swap is LARGE if the brief's teal/green primary IS intended.** Then someone must reconcile the brief against the source (which keeps Gold default) and the team must pick Emerald as the new default accent — a real codemod given the pervasive legacy `gold/foil/orange/rose` alias sprawl (R4). **This needs a user decision.**
4. **Light mode changes materially.** Cool `#F2F4F8` → warm greige `#EFEADF`, lighter semantic greens (`#0F6B50→#1C8A63`), plus a NEW `lightBg` selector. Light is a bigger swap than dark.
5. **Radius is a global bump** (8–10px → 18–26px) — touches every `rounded-*`/`--radius` consumer and all three platforms.
6. **Admin loses its graphite identity** — the new design re-unifies admin onto the `#070B14` navy + same accent system as web, removing the deliberate "Linear graphite" track (R2). Decision needed: keep admin distinct or unify.
7. **Aurora layer fate.** The new mockups drop the `--au-*` aurora wrapper system entirely in favor of inline radial-glow meshes. Decision needed: retire aurora.css (large deletion, affects admin chrome + premium rituals) or keep and re-skin.
8. **Accent + lightBg become runtime-selectable** — net-new infra (a 3-accent × 2-mode × 4-lightBg matrix) the current single-flip theme system does not model.

---

## 6. Open questions

(carried into StructuredOutput)

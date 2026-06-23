# 00 — INDEX · LocateFlow UI/Theme Renewal Memory

This folder is a **durable UI/theme memory** of the LocateFlow monorepo, built so a future team can run a full **theme + UI/UX renewal** without re-reading the source. It captures *what EXISTS today* — token systems, components, brand assets, and every page/screen — with file-path citations. It does **not** propose new visuals (except `20_RENEWAL_PLAYBOOK.md`, which lays out *how* to migrate, not *what* the new look is).

Repo root: `C:/Users/Windows/Desktop/Staging/staging-move`
Surfaces in scope: **web** (Next.js 16 — consumer app + marketing/legal), **admin** (Next.js 16), **mobile** (Expo / React Native + NativeWind 4).
Styling: Tailwind 3.4 + CSS variables (web/admin), NativeWind 4 + RN `StyleSheet` (mobile). Light/dark/system theming on all three.

---

## File map

| File | What it holds | When to open it |
|---|---|---|
| `00_INDEX.md` | This file — folder purpose, file map, surface counts, how to use it. | Start here. |
| `01_THEME_SYSTEM.md` | The token system: the **5+ copies** of the palette and their drift, full `--var` contracts (web globals, web aurora, admin globals, admin aurora, mobile tokens.ts/theme.ts), dark/light values, radius/tracking/tone-alpha drift tables. | Editing colors, building a single token source, resolving value disagreements. |
| `02_COMPONENT_CATALOG.md` | Exhaustive cross-app component inventory (Button, Input, Card, Dialog, Badge, Skeleton, EmptyState, ThemeToggle, charts…). Marks **triplicated** primitives, **missing** primitives, hardcoded values per component. | Consolidating primitives; deciding what to build once and share. |
| `03_BRAND_AND_LAYOUT.md` | Brand assets (raccoon mascot SVG, wordmarks, OG, favicons), font systems, and the 3 app shells / nav idioms. | Reskinning logo, wordmark, fonts, navigation chrome. |
| `10_WEB_PUBLIC_PAGES.md` | Every web **public/marketing/legal** surface (one row each). Shells, sections, theme handling, hardcoded hex, states. | Reskinning marketing + legal + auth. |
| `11_WEB_APP_PAGES.md` | Every web **authenticated** `(app)/**` page. Shared `AppShell`, card idioms, i18n fragmentation, inline-style token leaks. | Reskinning the consumer product. |
| `12_ADMIN_PAGES.md` | Every **admin** page. `.adm-aurora` shell, RSC-wrapper pattern, reusable admin shells, near-zero page-level hardcoded color. | Reskinning the operations console. |
| `13_MOBILE_SCREENS.md` | Every **mobile** screen. `useAppTheme()` runtime theming, `move/primitives`, hardcoded-color hotspots (CATEGORY_COLORS ×3, OAuth marks). | Reskinning the native app. |
| `20_RENEWAL_PLAYBOOK.md` | **Current-state synthesis + migration plan**: token drift, duplicated/missing primitives, target unified design-system shape, codegen approach, per-surface rollout order, per-app checklists, regression safety. | Planning and sequencing the actual renewal. |

---

## Surface counts (from `docs/audit/_inventory/`)

| Surface | Count | Source list |
|---|---|---|
| Web — public / marketing / legal / auth | **46** | `web-pages.txt` (non-`(app)` entries) |
| Web — authenticated app (`(app)/**`) | **28** | `web-pages.txt` (`(app)` entries) |
| Admin | **62** | `admin-pages.txt` |
| Mobile (Expo screens) | **54** | `mobile-screens.txt` |
| **Total surfaces** | **190** | — |

Web total = 74 (46 public + 28 app). Every entry in all three lists is enumerated in files 10–13 (no sampling).

---

## The one-paragraph current state (so you don't have to read everything first)

LocateFlow is mid-rebrand to **"Edition VIII · Gold/Sapphire"**: dark-mode primary is **Gold `#CBA45E`**, light-mode primary is **Sapphire `#2E5FB0`**, and the palette was flipped by *re-pointing legacy alias names* (`orange`, `rose`, `foil`, `violet`, plan accents) rather than a codemod — so **class names now lie** about their color. The canonical token module `packages/shared/src/design-tokens.ts` is **runtime-consumed only by mobile**; web and admin keep **hand-synced CSS copies** (web `globals.css`, web `aurora.css`, admin `globals.css`, admin `aurora.css`) that have **drifted** from it and from each other (different dark backgrounds, radii, tone alphas, destructive hues, family-tier hue). Core primitives (Button, Input, Card, Badge, Skeleton, EmptyState, ThemeToggle, Logo, raccoon mascot) are **triplicated** per platform; admin has **no Button component** at all; several primitives (Table, Tabs, DropdownMenu, Spinner, Tooltip, Toast, web/admin ErrorState) are **missing system-wide**. Two font systems (legacy Geist/Fraunces + canonical Playfair/DM Sans/DM Mono) ship on every boot. See `20_RENEWAL_PLAYBOOK.md` §1 for the full list.

---

## How to use this folder for a theme / UI-UX renewal

1. **Read `20_RENEWAL_PLAYBOOK.md` first** — it synthesizes everything below into current-state, target shape, migration order, per-app checklists, and regression safety.
2. **Establish the single token source** before touching any surface — `01_THEME_SYSTEM.md` is the map of all 5+ palette copies and their concrete drifts. A renewal that edits only CSS vars will **not** flip the mobile NativeWind palette, hardcoded modal/SVG hex, or the OG glyph — those are listed explicitly.
3. **Consolidate primitives next** — `02_COMPONENT_CATALOG.md` tells you which components are triplicated (re-theme once vs N times) and which are missing (build once).
4. **Then go surface-by-surface** using files 10–13 as the checklist. Each page/screen row records its shell, hardcoded values, theme-awareness, and states — so you can verify nothing regressed.
5. **Mind the "do-not-retheme" set:** Google/Apple OAuth brand marks (web sign-in/up, mobile auth), the Google "G" 4-color SVG — these are brand-mandated. Flagged in 10, 13.
6. **Reconcile i18n while reskinning copy** — three patterns coexist (next-intl, inline `{en,es}` objects, hardcoded English). Listed per-page in `11_WEB_APP_PAGES.md` §0.
7. **Known audit findings** (`component-theme-system-01..10`, `ui-ux-*`, marketing OG "M" glyph) are cross-referenced in the playbook where they map to concrete work.

> Convention across all files: facts cite file paths; anything inferred but not directly confirmed is marked `[needs verification]`.

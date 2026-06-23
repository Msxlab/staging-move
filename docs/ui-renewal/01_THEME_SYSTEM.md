# 01 — Theme & Design-Token System (LocateFlow)

Durable UI/theme memory for a full theme renewal. Surfaces covered: **web** (consumer + marketing, Next.js 16), **admin** (Next.js 16), **mobile** (Expo / React Native + NativeWind 4). Inventory of **what EXISTS** — no proposals. All facts cite file paths. Anything inferred is marked `[needs verification]`.

Brand era in code: **"Edition VIII · LocateFlow Gold/Sapphire"** — dark mode primary = **Gold `#CBA45E`**, light mode primary = **Sapphire `#2E5FB0`**. Many legacy names (`orange`, `rose`, `foil`, `violet`, plan accents) are preserved aliases that now resolve to Gold/Sapphire so the palette flipped **without a codemod**.

---

## 0. Source-of-truth map & the 5 copies of the palette

| # | File | Role | Consumed at | Notes |
|---|------|------|-------------|-------|
| 1 | `packages/shared/src/design-tokens.ts` | **Declared** single source of truth | **runtime only by mobile** | Web/admin do NOT import it; they hand-copy values. |
| 2 | `apps/web/src/styles/globals.css` | Web `--vars` + shadcn HSL + huge `.light` utility override layer | web CSS | Manual mirror of #1. 2178 lines. |
| 3 | `apps/web/src/styles/aurora.css` | `.lf-aurora` wrapper tokens (`--au-*`) + shadcn override inside wrapper | web (whole `<body>` is `.lf-aurora`) | "Ported from admin aurora.css" but DIVERGED. |
| 4 | `apps/admin/src/app/globals.css` | Admin `--vars` + shadcn HSL | admin CSS | Manual mirror of #1, but dark surfaces & some tones DIFFER from web. |
| 5 | `apps/admin/src/app/aurora.css` | `.adm-aurora` wrapper ("Phase 3 corporate retune") | admin (`(admin)`, login, set-password) | DIFFERENT class + DIFFERENT richer token set than web aurora.css. |
| 6 | `apps/web/tailwind.config.ts` / `apps/admin/tailwind.config.ts` | Map Tailwind utilities → `var(--*)` | build | Identical between web & admin except web adds `keyframes/animation` + DM-font fallbacks. |
| 7 | `apps/mobile/tailwind.config.ts` | NativeWind palette (hardcoded hex, **dark-only**) | build | Hardcodes hex copied from #1; does NOT theme-switch. |
| 8 | `apps/mobile/src/lib/theme.ts` | Runtime light/dark palettes built FROM #1 | mobile runtime | The only true runtime consumer of #1. |

**The design-tokens.ts docstring itself states the contract (lines 16–23):**
> mobile consumes tokens at runtime; web globals.css and admin aurora.css "keep their own copies of the same numeric values; sync manually when these change."

So **4 hand-synced copies** (web globals, web aurora, admin globals, admin aurora) drift from the canonical TS module and from each other. The admin app maintains a `apps/admin/src/app/aurora-theme-regression.test.ts` that snapshots aurora.css — a signal that drift is a known, guarded risk.

---

## 1. DRIFT — concrete value disagreements

### 1.1 Dark-mode background / surfaces (the biggest drift)

| Token (concept) | tokens.ts (#1) | web globals.css (#2) | web aurora `.lf-aurora` (#3) | admin globals.css (#4) | admin aurora `.adm-aurora` (#5) |
|---|---|---|---|---|---|
| bg / base | `surfaceDark.background #070B14` | `--bg #070B14` | `--au-base #0A0F18` | `--bg #171E2B` | `--au-base #171E2B` |
| surface | `#121B2D` | `--surface #121B2D` | `--au-base-2 #0E1521` | `--surface #1C2535` | `--au-base-2 #1C2535` |
| card | `#18233A` | `--surface-2 #18233A` | `--au-base-3 #131C2C` | `--surface-2 #232D40` | `--au-base-3 #232D40` |
| elevated | `#1D2943` | `--elevated #1D2943` | — | `--surface-3 #2A364C` | `--au-surface #1C2535` |
| shadcn `--background` (dark, HSL) | n/a | `218 43% 6%` (≈#070B14) | `218 43% 6%` | **`218 26% 14%`** (#171E2B, "Linear graphite") | **`218 26% 14%`** |
| shadcn `--card` (dark) | n/a | `217 41% 9%` | `217 41% 9%` | **`218 22% 19%`** | **`218 22% 19%`** |

> **Drift:** Web dark canvas is deep navy `#070B14`. Admin dark canvas is a lighter graphite `#171E2B` (admin globals.css lines 166–189 explicitly call it "Linear-style graphite canvas"). Web's own globals (`#070B14`) and its aurora wrapper (`--au-base #0A0F18`) disagree by a few points — but the whole web body IS `.lf-aurora` (layout.tsx line 211), so the **effective** web shadcn bg is `218 43% 6%` from both, while the non-aurora `--bg` (#070B14) drives `:focus-visible` ring offset and a few raw `var(--bg)` sites.

### 1.2 Light-mode surfaces — mostly aligned

| Token | tokens.ts | web globals | web aurora | admin globals | admin aurora |
|---|---|---|---|---|---|
| bg | `#F2F4F8` | `#F2F4F8` | `#F2F4F8` | `#F2F4F8` | `--au-base #F4F6F9` |
| surface/card | `#FFFFFF` / `#EAEEF4` | same | `--au-base-2 #EAEEF4` | same | `--au-base-2 #FFFFFF` |
| shadcn `--background` (light) | n/a | `220 23% 96%` | `220 23% 96%` | `220 23% 96%` | `216 28% 97%` (#F4F6F9) |

> Admin aurora light base is `#F4F6F9` ("SLATE corporate sheet") vs everyone else's `#F2F4F8`. Minor but real.

### 1.3 Tone alpha / fg drift (admin globals vs web globals)

Admin `globals.css` uses **0.16 bg / 0.32 border** alphas for tones; web `globals.css` uses **0.10 bg / 0.22–0.28 border**. Admin also uses different tone foreground hex (e.g. dark `--tone-sage-fg #A0EAD2` and `--tone-foil-fg #DCBC7C` in admin vs `#54CB7E` / `#CBA45E` in web). Family tier hue also differs: admin `tier-family` / `tier-bar-seg-family` = **teal `#34D8A6`/`#1FB98A`** (admin globals.css 326–330, 452), whereas web treats family as Gold.

### 1.4 Admin destructive (light) drift
- Admin globals.css light `--destructive: 359 51% 49%` vs web `358 47% 43%`. Dark admin `--destructive 359 68% 70%` vs web `359 75% 75%`.

### 1.5 Letter-spacing flattened
- tokens.ts declares real tracking (`tightest -0.035em`, `tight -0.02em`). Web globals.css **overrides them to `0`** (lines 201–203: `--tracking-tightest: 0; --tracking-tight: 0; --tracking-normal: 0;`). Only `--tracking-wide 0.04em` and `--tracking-mono 0.14em` survive. So the TS letterSpacing scale is effectively dead on web.

### 1.6 Radius drift
- tokens.ts `--radius` md = **10px** (`0.625rem`); web globals `--radius: 0.625rem`; **admin globals `--radius: 0.5rem`** (8px, line 163) in `:root` but `--radius: 0.625rem` is NOT re-set in admin `.dark` (inherits 0.5rem). Web/admin Tailwind both derive `borderRadius.lg = var(--radius)` so admin cards are 2px tighter.

### 1.7 Mobile rose drift
- `tokens.ts brandColors.rose = #CBA45E` (Gold). But `apps/mobile/tailwind.config.ts` `rose.DEFAULT = #E25C5C` (coral/red) — the NativeWind `bg-rose` class is **coral**, while the TS `rose` token is **Gold**. Different meaning of "rose" in the two mobile layers.

---

## 2. CSS-variable contract (full `--var` tables)

### 2.1 Web `globals.css` core brand/surface vars

| Var | Dark (`:root,.dark`) | Light (`.light`) |
|---|---|---|
| `--rose` | `#CBA45E` | `#2E5FB0` |
| `--rose-light` | `#DCBC7C` | `#3D74C8` |
| `--rose-deep` | `#B0852F` | `#2E5FB0` |
| `--rose-dark` | `#86631A` | — |
| `--foil-a / -b / -c` | `#DCBC7C / #CBA45E / #B0852F` | (b/c via .light: `--foil #2E5FB0`, `--foil-ink #244C90`) |
| `--foil` | `#CBA45E` | `#2E5FB0` |
| `--sage` | `#54CB7E` | `#0F6B50` |
| `--brand-orange` | `#CBA45E` | `#2E5FB0` |
| `--brand-amber` | `#E0A85A` | (no light override → stays) |
| `--orange-500` | `#CBA45E` | `#2E5FB0` |
| `--bg` | `#070B14` | `#F2F4F8` |
| `--surface / -2 / -3` | `#121B2D / #18233A / #16203A` | `#FFFFFF / #EAEEF4 / #E2E7EE` |
| `--elevated` | `#1D2943` | `#FFFFFF` |
| `--fg` | `#EFF3FA` | `#14202F` |
| `--fg-2 / -3 / -4` | `rgba(239,243,250,.66/.43/.30)` | `rgba(20,32,47,.72/.50/.30)` |
| `--line / -2` | `rgba(110,150,225,.12/.18)` | `rgba(20,32,47,.06/.14)` |
| `--line-foil` | `rgba(203,164,94,.24)` | `rgba(46,95,176,.30)` |
| `--border-focus` | `rgba(203,164,94,.55)` | `rgba(46,95,176,.55)` |
| `--glass-bg/-border/-hover` | `rgba(255,255,255,.03/.05/.08)` | `rgba(255,255,255,.55)/rgba(20,32,47,.06)/rgba(255,255,255,.92)` |
| `--success` | `#54CB7E` | `#0F6B50` |
| `--warning` | `#E0A85A` | `#7A5418` |
| `--danger` | `#E25C5C` | `#A83333` |
| `--info` | `#37C2C9` | `#16666B` |
| `--shadow-glow/-rose/-foil` | gold-alpha glows | sapphire-alpha glows |

### 2.2 Web shadcn HSL tokens (drive every `bg-primary` etc.)

| Var | Dark | Light |
|---|---|---|
| `--background` | `218 43% 6%` | `220 23% 96%` |
| `--foreground` | `214 36% 95%` | `213 39% 13%` |
| `--card` | `217 41% 9%` | `218 21% 92%` |
| `--popover` | `217 41% 9%` | `218 21% 96%` |
| `--primary` | `38.53 51.17% 58.24%` (Gold) | `217.38 58.56% 43.53%` (Sapphire) |
| `--primary-foreground` | `218 43% 6%` | `0 0% 100%` |
| `--secondary` | `215 22% 72%` | `214 22% 38%` |
| `--muted` | `217 38% 12%` | `218 21% 88%` |
| `--muted-foreground` | `215 18% 65%` | `213 14% 35%` |
| `--accent` | `217 38% 14%` | `218 21% 90%` |
| `--destructive` | `359 75% 75%` | `358 47% 43%` |
| `--warning / --success / --info` | `35 68% 62% / 156 56% 70% / 183 57% 50%` | `36.73 67.12% 28.63% / 162 75% 24% / 184 66% 25%` |
| `--border / --input` | `217 32% 18%` | `213 18% 82%` |
| `--ring` | `38.53 51.17% 58.24%` | `217.38 58.56% 43.53%` |
| `--radius` | `0.625rem` | `0.625rem` |

### 2.3 Admin shadcn HSL tokens (where they DIFFER from web)

| Var | Admin Dark | Admin Light |
|---|---|---|
| `--background` | `218 26% 14%` (graphite, **≠ web 6%**) | `220 23% 96%` |
| `--card` | `218 22% 19%` | `218 21% 92%` |
| `--primary` | `38.53 51.17% 58.24%` (Gold, same) | `217.38 58.56% 43.53%` (same) |
| `--secondary` | `220 10% 82%` | `214 22% 38%` |
| `--muted` | `218 18% 24%` | `218 21% 88%` |
| `--muted-foreground` | `215 22% 78%` (**lighter than web 65%**) | `213 14% 35%` |
| `--accent` | `218 18% 27%` | `218 21% 90%` |
| `--destructive` | `359 68% 70%` | `359 51% 49%` |
| `--border / --input` | `217 20% 30%` | `213 18% 82%` |
| `--radius` | inherits `0.5rem` | `0.5rem` |

### 2.4 `.lf-aurora` wrapper tokens (web aurora.css) — `--au-*`

| Var | Dark | Light (`.light .lf-aurora`) |
|---|---|---|
| `--au-ink / -2 / -3 / -4` | `#ECF1F8 / #A8B5C9 / #6E7C92 / #4C586D` | `#14202F / #4A5C75 / #7A8A9F / #ABB6C5` |
| `--au-base / -2 / -3` | `#0A0F18 / #0E1521 / #131C2C` | `#F2F4F8 / #EAEEF4 / #E2E7EE` |
| `--au-pane / -2 / -3` | `rgba(255,255,255,.03/.05/.08)` | `rgba(255,255,255,.55/.75/.92)` |
| `--au-cool / -2` | `#CBA45E / #B0852F` (Gold) | `#2E5FB0 / #244C90` (Sapphire) |
| `--au-violet` | `#CBA45E` (legacy → Gold) | `#2E5FB0` |
| `--au-family` | `#CBA45E` | `#2E5FB0` |
| `--au-mint` | `#54CB7E` | `#0F6B50` |
| `--au-amber` | `#E0A85A` | `#7A5418` |
| `--au-coral` | `#E25C5C` | `#A83333` |
| `--au-rose` | `#F0A0B8` (only true pink in system) | (inherits) |
| `--au-aurora-1..4` | gold/mint/pink blob gradients | sapphire/mint/coral, fainter |
| `--au-row / -pad / -gap` | `44px / 16px / 16px` | (compact `36/12/12`, roomy `52/20/20`) |
| `[data-mode="lite"]` | reduces pane translucency, kills backdrop-filter | — |

`.lf-aurora` ALSO re-declares the full shadcn HSL set (same values as §2.2) so every utility under the wrapper matches.

### 2.5 `.adm-aurora` wrapper tokens (admin aurora.css) — "Phase 3 corporate"

Distinct, RICHER set than web aurora. Key extra tokens **not present in web aurora**:

| Var | Dark (Gold) | Light (`html:not(.dark)`, Sapphire) |
|---|---|---|
| `--au-base / -2 / -3` | `#171E2B / #1C2535 / #232D40` | `#F4F6F9 / #FFFFFF / #EDF1F6` |
| `--au-accent / -2 / -ink` | `#CBA45E / #DCBC7C / #0A1626` | `#2E5FB0 / #3D74C8 / #FFFFFF` |
| `--au-accent-soft / -line` | `rgba(203,164,94,.13/.28)` | `rgba(46,95,176,.10/.30)` |
| `--au-surface` (chrome slab) | `#1C2535` | `#FFFFFF` |
| `--au-field` | `#232D40` | `#F4F6F9` |
| `--au-hover` | `rgba(255,255,255,.05)` | `rgba(20,32,51,.035)` |
| `--au-track / --au-seg-on` | `#243049 / #2A364C` | `#E5E9F0 / #FFFFFF` |
| `--au-scrim` | `rgba(8,12,20,.55)` | `rgba(20,32,51,.26)` |
| `--au-ok / -warn / -danger` (+`-soft`/`-line`) | mint / amber / coral aliases | sapphire-ramp equivalents |
| `--au-shadow-card / -drawer` | feathered dark | feathered light |
| `--au-row / -pad / -gap` | `48 / 18 / 16` (≠ web `44/16/16`) | — |

> **Major structural drift:** admin's aurora wrapper class is **`.adm-aurora`** and keys off `html:not(.dark)` / `.dark`, while web's is **`.lf-aurora`** keying off `.light`. They are NOT interchangeable. Admin glass alphas are ~halved ("flat corporate"), honey demoted strictly to WARN. Admin aurora light is described as "SLATE corporate sheet … No glass in light."

---

## 3. Light / Dark / System mechanism

| Surface | Library / mechanism | Class strategy | Default | Persistence key | System support | No-flash |
|---|---|---|---|---|---|---|
| **web** | `next-themes` via `apps/web/src/components/theme-provider.tsx` | `attribute="class"`, `disableTransitionOnChange`, `themes=[light,dark,system]` | **`dark`** | `localStorage: locateflow-theme` | yes (`enableSystem`) | next-themes inline script (nonce-stamped via `ThemeProvider nonce={nonce}`, layout.tsx 229). `<html suppressHydrationWarning>`. |
| **admin** | `next-themes` via `apps/admin/src/components/theme-provider.tsx` | identical config | **`dark`** | `localStorage: locateflow-admin-theme` (intentionally separate, no cross-subdomain cookie) | yes | same next-themes inline script + `suppressHydrationWarning` |
| **mobile** | Custom Context in `apps/mobile/src/lib/theme.ts` (`ThemeProvider` / `useThemePreference` / `useAppTheme`) | resolved palette object, not a class | **`dark`** (line 365 `?? "dark"`; docstring at line 48 also says default dark) | `AsyncStorage: locateflow.theme.preference` | yes — `useColorScheme()` + `Appearance.addChangeListener` | First render returns OS scheme before AsyncStorage hydrates (docstring "no flash of wrong palette"); `hydrated` flag exposed. |

**Web/admin class application:** next-themes puts `class="dark"` or (for light) `class="light"` on `<html>`. NOTE web CSS targets `:root,.dark` for dark and `.light` for light — meaning **dark is the default even with no class**, light requires an explicit `.light`. Admin aurora instead targets `.dark` / `html:not(.dark)` — so admin's *aurora layer* treats **light as the default** (absence of `.dark`), while admin globals.css `:root` also defines **light** values and `.dark` overrides — an inversion vs web. `[needs verification]` that next-themes always emits an explicit class so these defaults never collide.

**Theme toggles:**
- `apps/web/src/components/theme-toggle.tsx`: `variant="icon"` = 2-state sun/moon on resolved theme; `variant="inline"` = 3-state cycle system→light→dark. i18n via `next-intl` `theme.*`.
- `apps/web/src/components/marketing/landing-theme-toggle.tsx`: segmented radiogroup pill (framer-motion `layoutId`), `full` (3) vs `compact` (2) variants. Selected icon uses `text-tone-orange-fg`. Hardcoded glow `rgba(127,182,232,0.5)` in shadow (a blue that is NOT a current brand token — leftover).
- `apps/admin/src/components/theme-toggle.tsx`: 2-state only (light/dark); system opt-in only via settings page. No i18n (hardcoded English strings).
- `apps/mobile/src/components/ui/ThemeSelector.tsx`: 3-row System/Light/Dark radio list inside Settings, i18n via `react-i18next`.

**theme-color / colorScheme meta:**
| Surface | theme-color | colorScheme | mask-icon color |
|---|---|---|---|
| web (`layout.tsx`) | `<meta name="theme-color" content="#0A0F18">` (static, single dark value — does NOT switch per theme) | not set in `viewport` | `<link rel="mask-icon" color="#CBA45E">` (Gold) |
| admin (`layout.tsx`) | `viewport.themeColor: "#171E2B"` (graphite) | `viewport.colorScheme: "dark light"` | — |
| mobile (`app/_layout.tsx`) | `StatusBar style = light/dark` per resolvedScheme; `NativeStatusBar.setBackgroundColor(colors.background)` | n/a | n/a |

> **Drift/risk:** web theme-color `#0A0F18` ≠ web actual bg `#070B14` ≠ admin `#171E2B`. None of the three is dynamic for light mode, so the mobile browser chrome stays dark even in light theme on web/admin.

---

## 4. Tailwind token mapping (web & admin — near-identical)

`apps/web/tailwind.config.ts` & `apps/admin/tailwind.config.ts` — `darkMode: ["class"]`, content `./src/**/*.{ts,tsx}`.

| Tailwind class | resolves to |
|---|---|
| `bg-background / text-foreground / border-border / ring-ring / bg-input` | `hsl(var(--background))` etc. |
| `bg-primary / -secondary / -destructive / -muted / -accent / -popover / -card` (+`-foreground`) | `hsl(var(--…))` shadcn |
| `text-success / -warning / -danger / -info` (+`.light` = `-soft`) | `var(--success)` … (NOT hsl-wrapped — raw vars) |
| `bg-brand-orange / -orange-light / -orange-dark / -amber / -rose / -foil / -sage / brand-foil-a..c / -ink` | `var(--brand-*)` / `var(--rose)` / `var(--foil*)` (Gold/Sapphire) |
| `bg-rose / -rose-light / -rose-deep`, `text-foil / -foil-a..c / -ink`, `bg-sage` | direct `var(--*)` |
| `bg-orange-50…900` | `var(--orange-50…900)` (Gold scale dark / Sapphire scale light) |
| `bg-tone-{rose,foil,sage,honey,umber,slate}-{bg,br,fg}` + legacy `{orange,emerald,amber,sky,cyan}` | `var(--tone-*)` |
| `rounded-lg/-md/-sm` | `var(--radius)` / `calc(-2px)` / `calc(-4px)`; `xl=20px`, `2xl=28px` |
| `font-sans / -display / -serif / -mono` | `var(--font-sans/-display/-mono)` (+ DM/Playfair fallbacks) |
| `text-brand-xs…brand-display-xl` | fixed px scale (11→96px) with line-height + tracking |
| `shadow-glow / -rose / -foil` | `var(--shadow-*)` |
| `bg-foil` (image) / `bg-rose-gradient` | 135° foil & rose linear-gradients |

**Web-only extras:** `keyframes accordion-up/down` + `animation`, richer DM Sans/Playfair/DM Mono fallback stacks. **Admin-only:** font stacks lack DM/Inter names (just `var(--font-*)` + system fallbacks). Plugins both: `tailwindcss-animate` + `@tailwindcss/typography`.

---

## 5. Mobile NativeWind theming

- **NativeWind className palette is a FIXED DARK palette** — `apps/mobile/tailwind.config.ts` hardcodes hex (Gold primary scale, coral `rose`, Gold `foil`, green `sage`, navy `surface`, semantic green/amber/coral/teal). `bg-primary-500` etc. do **not** switch light/dark.
- **Runtime light/dark is driven entirely by `src/lib/theme.ts`** via StyleSheet objects, NOT by NativeWind classes. Two palettes: `darkColors` (built from `surfaceDark/textDark/borderDark/semanticColors/tonesDark`) and `lightColors` (`…Light` variants). Accent: dark=Gold (`brandColors.rose`), light=Sapphire (`roseScale[500]`).
- Hooks: `useAppTheme()`, `useThemePreference()`, `useThemedStyles(factory)` (re-runs `StyleSheet.create` on theme change), `themeForScheme()`, `getInitialTheme()` (sync, OS-only).
- **Migration gap (documented):** components still importing the static `theme` export render the **dark palette forever** until reload (theme.ts docstring lines 41–45). Only components on `useAppTheme`/`useThemedStyles` live-switch.
- Fonts loaded via `@expo-google-fonts` in `app/_layout.tsx`: Playfair Display (400/600/700/700i/800/900), DM Sans (400/500/600/700), DM Mono (400/500). Explicit constants in `theme.ts fonts.*` (RN needs exact family per weight). `nativewind-env.d.ts` = single `/// <reference types="nativewind/types" />`.
- `applyPlanPalette()` is a **pass-through no-op** (plan accents retired; lines 309–315).
- StatusBar: `app/_layout.tsx` sets `StatusBar style` + Android `setBackgroundColor(colors.background)` from resolved scheme.

---

## 6. Brand palette & semantic tokens

### 6.1 Brand core (Edition VIII)
| Name | Dark | Light | Where |
|---|---|---|---|
| **Gold (primary dark)** | `#CBA45E` | — | `brandColors.orange/rose/foil`, `--rose`, `--foil`, `--au-cool`, HSL `38.53 51.17% 58.24%` |
| Gold light / deep / ink | `#DCBC7C` / `#B0852F` / `#86631A` | — | foil-a/c, rose-light/deep, orange-300..800 |
| **Sapphire (primary light)** | — | `#2E5FB0` | `roseScale[500]`, `--rose`(light), HSL `217.38 58.56% 43.53%` |
| Sapphire light / deep | — | `#3D74C8` / `#244C90` | roseScale 400/700 |
| Gold scale (`orange-*`) dark | `#FFF8E8→#5F4614` | — | tokens + web/admin globals |
| Sapphire scale (`orange-*`) light | — | `#EEF5FF→#18345F` | globals `.light` |

### 6.2 Semantic (Aurora)
| Token | Dark | Light |
|---|---|---|
| success (green) | `#54CB7E` | `#0F6B50` |
| warning (amber) | `#E0A85A` | `#7A5418` |
| danger (coral) | `#E25C5C` | `#A83333` |
| info (teal) | `#37C2C9` | `#16666B` |

### 6.3 Six canonical tones (+legacy aliases)
Canonical: **rose** (=coral/attention), **foil** (=Gold/Sapphire), **sage** (=green), **honey** (=amber), **umber** (=Gold-shadow/Sapphire), **slate** (=neutral ink). Legacy aliases map: `orange→foil`, `emerald→sage`, `amber→honey`, `sky/cyan→info`. Defined as `(bg, border, fg)` triplets in tokens.ts (`tonesDark/tonesLight`), web globals, web aurora, admin globals, admin aurora — **with the alpha/hex drift noted in §1.3**.

### 6.4 Gradients & signature treatments
- **Foil gradient** `linear-gradient(135deg, #DCBC7C, #CBA45E, #B0852F)` = brand "foil-text" moment (`.foil-text`, `h1/h2/h3 em`, `--gradient-foil`).
- `gradients.primary/warm/glow/rose/premium` in tokens.ts (all Gold-flipped).
- Premium ritual CSS: `.premium-sticker`, `.reveal-modal`/`.reveal-*` (foil shimmer, confetti, glow) in web globals.css.
- Dossier-ambient decorative scenes (`.da-*`, web globals 1567–2084) — weather/hazard/housing animations driven off `--foil-b`, `--rose`, `--sage`, `--danger`, `--fg`; all gated by `prefers-reduced-motion`.
- Aurora drift blobs (`.aurora-blob`, `.au-aurora__layer`) — long-loop GPU transforms, reduced-motion safe.

### 6.5 Typography
- Families: **Playfair Display** (display/serif), **DM Sans** (UI/sans), **DM Mono** (mono). Web also loads **legacy Geist + Fraunces** still ("compatibility fallback", layout.tsx 29–52) — dead weight for renewal.
- `--font-display/-sans/-mono` repointed in globals; web wires `--font-playfair/-dm-sans/-dm-mono`, admin wires `--font-display/-sans/-mono` directly.
- Size scale `--fs-xs 11 … --fs-display-xl 96`; Tailwind `text-brand-*` mirror. Weights 300–800. Line-heights tight/snug/normal/relaxed = 1.0/1.15/1.45/1.7.
- `font-variation-settings` (`opsz`/`SOFT`) declared but **Playfair lacks those axes** → ignored (noted in code comments).

---

## 7. Gaps / risks for a renewal

| # | Risk | Evidence |
|---|---|---|
| R1 | **4 hand-synced palette copies** (web globals, web aurora, admin globals, admin aurora) + 1 TS source; a token change must be edited in 5 places. | design-tokens.ts docstring 16–23; admin `aurora-theme-regression.test.ts` guards this. |
| R2 | **Web vs admin dark canvas diverged** (`#070B14` navy vs `#171E2B` graphite) — admin deliberately on a "Linear graphite" track; renewal can't assume one dark surface. | admin globals 166–189. |
| R3 | **Two different aurora wrappers** (`.lf-aurora` vs `.adm-aurora`) with different token names (`--au-cool` vs `--au-accent`), different light/dark selectors (`.light` vs `html:not(.dark)`), different row metrics. Not portable. | web aurora.css vs admin aurora.css. |
| R4 | **Legacy alias sprawl** — `orange*`, `rose`, `foil`, `violet`, `amber`, `sky`, `cyan`, `emerald` all re-point to Gold/Sapphire/semantic. Renaming to honest names is a large codemod; current names lie (e.g. `bg-orange-500` is Gold; mobile `bg-rose` is coral but TS `rose` is Gold). | tokens.ts 30–90, 277–293; mobile tailwind 43–48. |
| R5 | **Dead/leftover values**: legacy Geist+Fraunces fonts still loaded (web layout); `--au-rose #F0A0B8` pink unused-by-brand; landing toggle glow `rgba(127,182,232,.5)` hardcoded non-token blue; `font-variation-settings` axes inert. | layout.tsx 29–52; aurora.css 43; landing-theme-toggle 69. |
| R6 | **Hardcoded hex outside the var system** — premium reveal modal (`#131C2C`, `#0E1521`, `#ECF1F8`, `rgba(203,164,94,*)`), health-pill, tier-stamp, tier-bar, raccoon mascot colors in mobile theme.ts, mobile NativeWind config (entire palette hardcoded). These won't flip if a renewal only edits vars. | web globals 894–907, admin globals 253–456, theme.ts 144–150/231–237, mobile tailwind 27–71. |
| R7 | **theme-color meta is static & inconsistent** — web `#0A0F18`, admin `#171E2B`, neither switches for light mode; web value ≠ actual web bg. | layout.tsx (both). |
| R8 | **Mobile static-`theme` import = stale dark** — any screen not migrated to `useAppTheme` ignores light mode until reload. | theme.ts 41–45. |
| R9 | **Tone alpha & family-hue drift** between web and admin globals (0.10 vs 0.16 bg; admin family = teal `#34D8A6`, web family = Gold). A unified renewal must reconcile. | §1.3, admin globals 326–330/452. |
| R10 | **Default-theme asymmetry** — web CSS defaults to dark (`:root,.dark`), admin aurora defaults to light (`html:not(.dark)`), all three apps default *preference* to dark. Mixed mental models. | §3. |
| R11 | **Known contrast intent (already addressed, verify)** — light semantic hues were darkened "for AA contrast" (globals comments). No automated contrast test found. Dark `--primary` Gold `#CBA45E` on navy and light Sapphire on white should be re-checked at renewal. `[needs verification]` — no a11y/contrast test located. | globals.css 300, 261 comments. |

---

## 8. Wiring summary (where each layer is applied)

| App | Layout file | Wrapper class on DOM | CSS imported |
|---|---|---|---|
| web | `apps/web/src/app/layout.tsx` | `<body class="… lf-aurora">` (whole app) | `globals.css` + `aurora.css` |
| admin | `apps/admin/src/app/layout.tsx` (root) + `(admin)/layout.tsx` | `<div class="adm-aurora …">` per route group (admin, login, set-password) | `globals.css` (root) + `aurora.css` (per route) |
| mobile | `apps/mobile/app/_layout.tsx` | `<ThemeProvider>` Context (no class) | NativeWind classes + `theme.ts` StyleSheets |

Inventory cross-check: all web pages live under `apps/web/src/app/**` (`lf-aurora` global), all admin pages under `apps/admin/src/app/(admin)/**` + login/set-password (`adm-aurora`), all mobile screens under `apps/mobile/app/**` (Context theme). Every entry in `web-pages.txt` (74), `admin-pages.txt` (62), `mobile-screens.txt` (54) inherits the corresponding app theme layer documented above; **no page defines its own independent theme system** — theming is centralized at the three layout layers, so this document covers 100% of enumerated surfaces.

# 06 · Component System Audit

Area slug: `component-system`
Scope: UI component systems across **web** (`apps/web/src/components`), **admin** (`apps/admin/src`), **mobile** (`apps/mobile/src`), and shared design tokens (`packages/shared/src/design-tokens.ts`, the three `tailwind.config.ts`, and the CSS token mirrors).
Method: read-only source inspection. Doc claims (file headers, comments) are treated as orientation only; every finding below is grounded in source.

---

## 1. Design tokens — single file, three runtime stories

`packages/shared/src/design-tokens.ts` declares itself the "single source of truth for colors, typography, spacing, radii, and shadows across web, admin, and mobile" (header, lines 2-24). In practice the token file is consumed at runtime by **mobile only**:

- **Mobile** imports the token objects directly: `apps/mobile/src/lib/theme.ts:5-24` pulls `brandColors`, `surfaceDark/Light`, `tonesDark/Light`, `spacing`, `radii`, `shadowsMobile`, etc. and builds `darkColors` / `lightColors` from them. Changing a token value flows through to every screen.
- **Web** and **admin** do **not** import the file. Their values are hand-copied into CSS custom properties (`apps/web/src/styles/globals.css`, `apps/admin/src/app/globals.css`) and into Tailwind config color maps (`apps/web/tailwind.config.ts`, `apps/admin/tailwind.config.ts`). The token header even admits this: "Web and admin don't import at runtime; their globals.css mirrors these values manually" (`design-tokens.ts:13-15`, and `globals.css:11-15` "Mirrors the numeric values… sync manually").

So there are **four independent copies** of the same palette numbers (shared TS, web CSS, admin CSS, mobile NativeWind config), kept in sync by hand. This is the root cause of the drift findings below.

### Token application
- Web/admin: Tailwind utilities resolve to CSS vars (`primary: "hsl(var(--primary))"`, `--rose`, `--tone-*`, `--orange-*`). Light/dark switch by re-declaring the same var names under `:root,.dark` vs a light block (`globals.css:21` dark, `:242` light).
- Mobile: NativeWind className colors are a **fixed dark palette** (`apps/mobile/tailwind.config.ts:22-71` hardcoded hex); runtime light/dark theming is done separately through `useAppTheme()` JS styles, NOT through className. The config header states this explicitly (`tailwind.config.ts:23-25`).

---

## 2. Primitive components — three parallel, non-shared systems

There is **no shared UI component package**. Each app re-implements primitives:

| Primitive | Web (`components/ui/`) | Admin (`components/`) | Mobile (`components/ui/`) |
|-----------|------------------------|------------------------|----------------------------|
| Button | `button.tsx` (cva + Radix Slot) | **none** — raw `<button>` + Tailwind everywhere | `Button.tsx` (RN, reanimated, 6 variants) |
| Input | `input.tsx` | **none** — raw `<input>` | `Input.tsx` |
| Select | `select.tsx` (native `<select>`) | **none** — raw `<select>` | n/a |
| Modal/Dialog | `dialog.tsx` (hand-rolled focus trap) | `confirm-dialog.tsx`, `quick-drawer.tsx`, `password-confirm-modal.tsx` | (screens/sheets) |
| Card | `card.tsx` | `admin-panel.tsx`, `aurora/aurora-stat-card.tsx` | `Card.tsx` |
| Table | **none** | `data-table-page.tsx` (full shell) | n/a |
| Badge | `badge.tsx`, `status-badge.tsx` | `premium/health-pill.tsx` etc. | `Badge.tsx` |
| Toast | `sonner` (lib) | `sonner` (lib) | `SuccessToast.tsx` (custom RN) |
| Empty state | `shared/empty-state.tsx` + `premium/foil-empty-state.tsx` | `empty-state.tsx` | `ui/EmptyState.tsx` |
| Loading | `shared/loading-state.tsx` (7 skeletons) | inline in `data-table-page.tsx` | `ui/LoadingScreen.tsx`, `ui/Skeleton.tsx` |
| Error state | `app/(app)/error.tsx` | inline | `ui/ErrorState.tsx`, `ErrorBoundary.tsx` |
| Tabs / Dropdown | **none** (rolled inline per page) | `column-settings-menu`, `saved-views-menu`, `sub-nav` | inline |

Confirmed via grep: `apps/admin/src` has **zero** imports of any `Button`/`components/ui` primitive (Grep for `import.*Button.*from` → 0 matches; `components/ui` → 0 files). Admin builds every interactive control as a raw element with copy-pasted Tailwind class strings (see `data-table-page.tsx:365-410, 482-487, 667-684` for ~6 distinct ad-hoc button styles in a single file).

### Web Button is barely adopted
`apps/web/src/components/ui/button.tsx` exists and is well-built (cva variants `default/destructive/outline/secondary/ghost/link/foil`, `Slot` for `asChild`). But it is imported in only **28 files** (Grep `from "@/components/ui/button"`), almost all marketing / error / not-found pages. The authenticated app surface and shared components mostly render raw `<button className="px-5 py-2.5 rounded-xl …">` (e.g. `shared/empty-state.tsx:36-37`). The primitive is effectively optional, so button styling is not actually centralized even within web.

---

## 3. Theme system (light/dark, persistence)

- **Web**: `components/theme-provider.tsx` wraps `next-themes`, `attribute="class"`, `defaultTheme="dark"`, `enableSystem`, `storageKey="locateflow-theme"`, themes `light/dark/system`. Picker UI in `settings/appearance-card.tsx` (3-way radiogroup, proper `role="radio"`/`aria-checked`).
- **Admin**: `components/theme-provider.tsx` is a near-verbatim copy of the web one (same hook shape, same `useTheme` returning `theme/preference/setTheme/toggleTheme`), differing only in `storageKey="locateflow-admin-theme"` (file header confirms it "Mirrors apps/web/src/components/theme-provider.tsx"). Quick toggle in `theme-toggle.tsx`.
- **Mobile**: bespoke `ThemeProvider` + `useAppTheme()`/`useThemePreference()` in `lib/theme.ts:361-494`. Three-state preference persisted in AsyncStorage (`locateflow.theme.preference`, default `"dark"`), reacts to OS via `Appearance.addChangeListener`. Includes a documented **gradual-migration hazard**: components still importing the static `theme` export render the dark palette and "keep rendering the dark palette until next reload" (`lib/theme.ts:43-45`); only components using `useAppTheme`/`useThemedStyles` flip live. This is a real partial-theming trap, not a bug per se but an inconsistency surface.

All three persist preference and support system mode — behavior is consistent at the UX level, but implemented three separate ways with no shared abstraction.

---

## 4. Findings

### component-system-01 — No shared UI primitive package; three parallel component systems (High, Architecture)
**Evidence:** Web primitives in `apps/web/src/components/ui/*`; admin has **no `ui/` dir** and 0 imports of any shared Button/Input (Grep on `apps/admin/src`); mobile primitives in `apps/mobile/src/components/ui/*`. No `packages/*` exports React components (shared package is logic/tokens only, per `packages/shared/src/index.ts`).
**Impact:** Every primitive (button, input, select, dialog, empty state, badge, card) is implemented 2–3× with independent styling, a11y, and focus behavior. Fixes/regressions must be made in multiple places; visual and interaction parity drifts over time.
**Recommendation:** Extract at minimum Button/Input/Select/Badge/EmptyState into a shared web/admin primitive layer (the two are both Next.js + Tailwind + same CSS vars, so this is low-risk). Treat mobile separately (RN) but share tokens.
**Files:** `apps/web/src/components/ui/`, `apps/admin/src/components/`, `apps/mobile/src/components/ui/`.

### component-system-02 — Design tokens manually mirrored into 4 copies (High, Architecture / Data)
**Evidence:** `packages/shared/src/design-tokens.ts:13-23` and `apps/web/src/styles/globals.css:11-20` both state the values are hand-synced; web/admin Tailwind configs (`apps/web/tailwind.config.ts`, `apps/admin/tailwind.config.ts`) re-declare the same color maps; mobile re-hardcodes hex in `apps/mobile/tailwind.config.ts:27-71`. The "single source of truth" header (`design-tokens.ts:2`) is only true for mobile JS runtime.
**Impact:** A token change requires editing up to 4 files; missing one produces silent cross-app palette drift (see -03, -04). The canonical TS file gives false confidence of centralization.
**Recommendation:** Generate the CSS vars and Tailwind color maps from `design-tokens.ts` at build time (e.g. a codegen step), or have web/admin import the token object into the Tailwind config. Remove the "sync manually" pattern.
**Files:** `packages/shared/src/design-tokens.ts`, `apps/web/src/styles/globals.css`, `apps/admin/src/app/globals.css`, all three `tailwind.config.ts`.

### component-system-03 — `bg-orange-*` resolves to different hues in web/admin (dark) vs the shared token scale (Medium, Theme / Data)
**Evidence:** Web/admin dark mode: `--orange-500: #CBA45E` (Gold) at `apps/web/src/styles/globals.css:53` and light mode `--orange-500: #2E5FB0` (Sapphire) at `:290`. The shared token `orangeScale` is aliased to `roseScale` (Sapphire), so `orangeScale[500] = "#2E5FB0"` for all schemes (`design-tokens.ts:90, 60-71`). Mobile NativeWind hardcodes `orange`/`primary` 500 = `#CBA45E` Gold (`apps/mobile/tailwind.config.ts:36`). The three definitions of the same legacy utility name (`orange-500`) therefore disagree across app + scheme.
**Impact:** Any UI relying on legacy `bg-orange-500`/`text-orange-400` utilities will render Gold in web-dark, Sapphire in web-light, and Gold (fixed) on mobile className — inconsistent brand accent for the "same" class. Hard to reason about because the names are deliberately legacy aliases.
**Recommendation:** Pick one canonical value per scheme and codegen all three from the token file; or fully retire the `orange-*` legacy scale in favor of `rose/foil`.
**Files:** `apps/web/src/styles/globals.css:48-57,285-290`, `apps/admin/src/app/globals.css`, `apps/mobile/tailwind.config.ts:30-41`, `packages/shared/src/design-tokens.ts:60-90`.

### component-system-04 — Mobile NativeWind className palette is fixed-dark and ignores light theme (Medium, Theme)
**Evidence:** `apps/mobile/tailwind.config.ts:22-25` "NativeWind className colors are a fixed dark palette; runtime light/dark theming is driven by src/lib/theme.ts". So `bg-primary`, `bg-surface`, `text-sage` etc. always render the dark hex regardless of the user's resolved scheme, while sibling components using `useAppTheme()` flip correctly.
**Impact:** On mobile light mode, any element styled via NativeWind className keeps dark-palette colors (e.g. `bg-surface` = `#070B14` navy) producing mixed light/dark surfaces on the same screen. Severity bounded by how many components use className vs `useThemedStyles`.
**Recommendation:** Either drive NativeWind colors from CSS-var-style runtime theming, or lint/forbid theme-sensitive className colors in favor of `useThemedStyles`. Document which utilities are safe (truly scheme-invariant) vs not.
**Files:** `apps/mobile/tailwind.config.ts`, `apps/mobile/src/lib/theme.ts:40-45`.

### component-system-05 — Web Button primitive exists but is bypassed across the app (Medium, UI/UX / Architecture)
**Evidence:** `apps/web/src/components/ui/button.tsx` defines a full cva variant system, but is imported in only 28 files (Grep), predominantly marketing/error pages. App and shared components render raw buttons with inline Tailwind, e.g. `apps/web/src/components/shared/empty-state.tsx:36-37` (`primaryBtn`/`secondaryBtn` class strings), `apps/admin/src/components/data-table-page.tsx:382-409,667-684`.
**Impact:** Button sizing, focus ring, disabled, and press states are not actually centralized; visual/a11y inconsistencies (e.g. `empty-state` primary uses `bg-tone-orange-fg` while the Button primitive uses `bg-primary`). Future a11y/theming fixes won't reach raw buttons.
**Recommendation:** Adopt `<Button>` in the app surface and shared components; add an ESLint rule discouraging raw `<button className=...>` for actionable controls.
**Files:** `apps/web/src/components/ui/button.tsx`, `apps/web/src/components/shared/empty-state.tsx`, `apps/admin/src/components/data-table-page.tsx`.

### component-system-06 — Empty-state / loading components duplicated 3× with diverging APIs and styling (Medium, UI/UX)
**Evidence:** Three EmptyState implementations with different prop shapes: web `shared/empty-state.tsx` (`actionHref`/`onAction`, `glass-card`, `bg-tone-orange-fg` button), admin `empty-state.tsx` (`icon/title/description/action` slot, `compact`, `bg-card/55` panel), mobile `ui/EmptyState.tsx` (`mascot` raccoon, `<Button>` actions). Plus a 4th variant `web .../premium/foil-empty-state.tsx`. Loading: web `shared/loading-state.tsx` (7 named skeletons) vs admin inline `Loader2` rows (`data-table-page.tsx:558-568`) vs mobile `LoadingScreen`/`Skeleton`.
**Impact:** "Nothing here" and "loading" treatments look and behave differently per app and per surface; no guarantee of consistent copy, spacing, or a11y roles. Admin even notes its EmptyState "Replaces the ad-hoc plain-text 'No X found' lines" (`empty-state.tsx:10-12`) — partial consolidation only within admin.
**Recommendation:** Define one shared web/admin EmptyState + skeleton set with a single prop contract; keep mobile as the RN sibling but align prop names.
**Files:** `apps/web/src/components/shared/empty-state.tsx`, `apps/web/src/components/premium/foil-empty-state.tsx`, `apps/admin/src/components/empty-state.tsx`, `apps/mobile/src/components/ui/EmptyState.tsx`, `apps/web/src/components/shared/loading-state.tsx`.

### component-system-07 — Web Dialog is a hand-rolled modal (no Radix), inconsistent with admin's dialog set (Medium, Accessibility / Reliability)
**Evidence:** `apps/web/src/components/ui/dialog.tsx` implements its own focus trap, Escape handling, and focus restore manually (lines 53-89). It does **not** lock body scroll, does not use `inert`/aria-hidden on the background, and its `DialogTrigger` ignores the `asChild` prop it accepts (lines 39-46) — rendering an extra nested `<button>`. Meanwhile `@radix-ui/react-slot` is already a dependency (used in `button.tsx:2`), and admin has separate dialog components (`confirm-dialog.tsx`, `password-confirm-modal.tsx`, `quick-drawer.tsx`).
**Impact:** Partial/edge-case a11y (background not inert, no scroll lock → background scroll behind modal; nested-button from unused `asChild`). Modal behavior differs between web and admin since they share no dialog primitive.
**Recommendation:** Standardize on a Radix `Dialog` (Radix is already partially in use) shared by web and admin; or at minimum add scroll-lock + background `aria-hidden`/`inert` and honor `asChild`.
**Files:** `apps/web/src/components/ui/dialog.tsx`, `apps/admin/src/components/confirm-dialog.tsx`, `apps/admin/src/components/password-confirm-modal.tsx`.

### component-system-08 — Theme provider duplicated verbatim between web and admin (Low, Dead Code / Architecture)
**Evidence:** `apps/admin/src/components/theme-provider.tsx` is a line-for-line copy of `apps/web/src/components/theme-provider.tsx` (same `useTheme` shape, same next-themes options), differing only in `storageKey`; the admin header says so explicitly.
**Impact:** Two copies to maintain; behavior can drift silently.
**Recommendation:** Move the provider + `useTheme` hook into the shared package, parameterized by `storageKey`.
**Files:** `apps/web/src/components/theme-provider.tsx`, `apps/admin/src/components/theme-provider.tsx`.

### component-system-09 — Tailwind configs duplicated across web and admin (Low, Architecture)
**Evidence:** `apps/web/tailwind.config.ts` and `apps/admin/tailwind.config.ts` share an essentially identical `theme.extend.colors` block (brand, rose, foil, sage, orange scale, 12 tone triples), `fontSize` brand scale, `boxShadow`, and `backgroundImage`. The admin config comment even notes "Mirrors apps/web/tailwind.config.ts" (`apps/admin/tailwind.config.ts:69`). Web adds accordion keyframes; otherwise identical.
**Impact:** Same manual-sync risk as tokens; a new tone added to one app silently missing from the other.
**Recommendation:** Extract a shared Tailwind preset consumed by both apps.
**Files:** `apps/web/tailwind.config.ts`, `apps/admin/tailwind.config.ts`.

### component-system-10 — Heavy reliance on hardcoded raw color/alpha literals in component className/StyleSheet (Low, Theme)
**Evidence:** Despite the token system, components embed raw rgba/hex: mobile `Button.tsx:127,261` (`rgba(255,255,255,0.4)`, `rgba(226,92,92,0.30)`), `theme.ts:137-139` (`rgba(255,255,255,0.07)` etc.); admin `data-table-page.tsx` uses literal opacity utilities like `bg-primary/5`, `border-primary/20` throughout; web `shared/loading-state.tsx` uses `bg-foreground/[0.02]` repeatedly.
**Impact:** Values not derived from tokens won't track palette changes; subtle inconsistencies (e.g. the same "hairline" rendered at slightly different alphas).
**Recommendation:** Promote frequently-reused alpha surfaces (hairlines, track/handle, glass tints) to named tokens/CSS vars and reference those.
**Files:** `apps/mobile/src/components/ui/Button.tsx`, `apps/mobile/src/lib/theme.ts`, `apps/web/src/components/shared/loading-state.tsx`, `apps/admin/src/components/data-table-page.tsx`.

---

## 5. What is consistent / good
- Tokens themselves are well-organized and documented (`design-tokens.ts`), with sensible scales (radii 6/10/14/20/28, 4px spacing rhythm, full type scale).
- Mobile theming infra (`useAppTheme`/`useThemedStyles`/`themeForScheme`) is thoughtfully built with hydration-flash avoidance and reduced-motion handling.
- All three apps support light/dark/system with persistence.
- Web `Dialog` does implement a focus trap + focus restore (just not via a vetted lib).
- Admin's `DataTablePage` is a strong consolidation of ~20 list pages (search/sort/filter/paginate/bulk/saved-views) — the one place admin genuinely centralized a pattern.

## 6. Open questions / needs verification
- Whether the mobile NativeWind fixed-dark palette (-04) actually causes visible light-mode artifacts depends on how many shipping screens use className colors vs `useThemedStyles`; not exhaustively counted. [needs verification]
- Exact count of raw-`<button>` usages in the web app surface (only the primitive-import count of 28 was measured). [needs verification]

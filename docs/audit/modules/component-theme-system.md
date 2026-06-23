# Module Audit: Component & Theme System

> READ-ONLY audit. Evidence is source code only. Paths are relative to repo root
> `staging-move/`. Line numbers are from the files as read on 2026-06-22.

## 1. Module Summary

The Component & Theme System spans three apps (web, admin, mobile) and a shared
token package. It is built on:

- **Design tokens**: `packages/shared/src/design-tokens.ts` — the documented
  "single source of truth" for color/typography/spacing/radius/shadow. At runtime
  it is consumed **only by mobile** (`apps/mobile/src/lib/theme.ts`,
  `apps/mobile/tailwind.config.ts`). Web and admin re-declare the same numeric
  values by hand in CSS (`apps/web/src/styles/globals.css`,
  `apps/admin/src/app/globals.css`) plus an additional `aurora.css` layer.
- **Theming**: `next-themes` (class strategy, `storageKey` per app) for web/admin;
  a custom React Context (`ThemeProvider` / `useAppTheme`) backed by AsyncStorage
  for mobile. All three default to **dark** with a user-selectable light/system.
- **UI primitives**: a small shadcn-style set under `apps/web/src/components/ui/`
  (button, input, card, dialog, select, badge, label, textarea, separator,
  skeleton, status-badge, password-input, category-icon). Admin has **no** shared
  `ui/` folder and re-implements dialogs, empty states, language selector, theme
  provider/toggle independently.

Edition VIII palette: Gold (`#CBA45E`) primary in dark, Sapphire (`#2E5FB0`) in
light, with green/amber/coral/teal semantics. Legacy names (`orange`, `rose`,
`foil`) are aliased so old call sites flip palette without a codemod.

Overall the token plumbing is well-organized and there is a real (if narrow)
contrast test. The main risks are: (a) **dark-mode contrast failures** on solid
semantic badges and several accent-on-white buttons that the existing test does
not cover; (b) **three-way token drift** (design-tokens.ts vs globals.css vs
aurora.css, plus admin's own values); (c) **heavy component duplication** between
web and admin with no shared UI layer; and (d) several **a11y gaps** in the
hand-rolled `Dialog`/`ConfirmDialog` (no scroll lock, `asChild` ignored, misuse
of `role="status"`, hardcoded English).

## 2. Related Files

Theme / tokens:
- `packages/shared/src/design-tokens.ts`
- `apps/web/src/styles/globals.css`, `apps/web/src/styles/aurora.css`
- `apps/admin/src/app/globals.css`, `apps/admin/src/app/aurora.css`
- `apps/web/tailwind.config.ts`, `apps/admin/tailwind.config.ts`, `apps/mobile/tailwind.config.ts`
- `apps/web/src/components/theme-provider.tsx`, `theme-toggle.tsx`
- `apps/admin/src/components/theme-provider.tsx`, `theme-toggle.tsx`
- `apps/web/src/components/marketing/landing-theme-toggle.tsx`
- `apps/mobile/src/lib/theme.ts`
- `apps/web/src/app/layout.tsx`, `apps/admin/src/app/layout.tsx`

UI primitives (web):
- `apps/web/src/components/ui/{button,input,card,dialog,select,badge,label,textarea,separator,skeleton,status-badge,password-input,category-icon}.tsx`

Shared/admin components:
- `apps/web/src/components/shared/{empty-state,confirm-dialog,loading-state}.tsx`
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/admin/src/components/{confirm-dialog,empty-state,language-selector}.tsx`

Tests:
- `apps/web/src/components/theme-provider.test.tsx`
- `apps/web/src/lib/design-tokens-contrast.test.ts`
- `apps/admin/src/app/aurora-theme-regression.test.ts`

## 3. Related Routes / Screens

The theme/component system is cross-cutting — every web route (`apps/web/src/app/**`)
and admin route (`apps/admin/src/app/**`) inherits the providers via the two root
layouts, and every mobile screen reads `useAppTheme()`. No dedicated route owns the
module. Theme preference UI surfaces in: web header dropdown + marketing
header/footer; admin sidebar; mobile Settings.

## 4. Related APIs

None. Theme state is client-only (localStorage `locateflow-theme` /
`locateflow-admin-theme`; AsyncStorage `locateflow.theme.preference`). No
server-persisted preference, no cookie, no API route. This is the root cause of the
SSR/first-paint behavior discussed in §11/§12.

## 5. Related Components

Primitives: `Button`, `Input`, `Card(+Header/Title/Description/Content/Footer)`,
`Dialog(+Trigger/Content/Header/Footer/Title/Description)`, `Select`, `Badge`,
`Label`, `Textarea`, `Separator`, `Skeleton`, `StatusBadge`, `PasswordInput`,
`CategoryIcon`. Composites: `EmptyState` (web + admin variants), `ConfirmDialog`
(web + admin variants), `LoadingSpinner`/skeleton family, `AppShell`,
`ThemeToggle` (web inline/icon), `LandingThemeToggle` (full/compact), admin
`ThemeToggle`. Mascot/brand: `RaccoonMark`/`RaccoonHero`/`RaccoonLost`/`RaccoonReading`.

## 6. Related State / Hooks / Stores

- Web/admin: `useTheme()` wrappers around `next-themes` `useNextTheme()` in each
  app's `theme-provider.tsx`. `mounted` guard returns `"dark"` pre-hydration.
- Mobile: `ThemeProvider` Context + `useThemePreference()` / `useAppTheme()` /
  `useThemedStyles()` in `apps/mobile/src/lib/theme.ts`; reads `useAuthStore` plan
  tier (currently a pass-through via `applyPlanPalette`).
- `AppShell` keeps `mobileMenuOpen`, `embedMode` (sessionStorage `lf:embed-mobile`).

## 7. Related Database / Models

None. No Prisma model stores theme/appearance. (Confirmed: theme is client-only;
no `prisma-models` inventory entry references theme/appearance.) [needs verification
that no user-preference model carries a theme column — not found in scoped reads.]

## 8. Impact Map

- **UI**: global — every surface inherits palette + primitives.
- **API**: none.
- **DB**: none.
- **Auth**: none directly. Skip-link/`AppShell` chrome is auth-gated by route, not by this module.
- **Admin**: separate provider/storage key/toggle; partial token mirror with its own surface + tone values.
- **Mobile**: separate runtime token consumer; `rose` className resolves to coral (danger), diverging from web's brand `rose`.
- **Notifications/Integrations/Analytics**: none.
- **SEO**: `theme-color` meta + `colorScheme` viewport affect mobile browser chrome only.
- **Tests**: light-mode contrast test + two token-string regression tests; no dark-mode contrast, no primitive a11y tests.

## 9. Buttons / Actions / Functions

### `ThemeToggle` (web, `apps/web/src/components/theme-toggle.tsx`)
- **Where**: header dropdown (`inline`), header chrome (`icon`).
- **Expected**: inline cycles system→light→dark; icon flips light/dark from resolved theme.
- **Actual**: matches expectation. Pre-mount placeholder keeps bounding box (no CLS).
- **Loading/disabled/error**: N/A (synchronous). **Success feedback**: visual icon/label change.
- **Permission**: none needed. **Edge cases**: pre-hydration shows Sun placeholder regardless of stored theme (acceptable; icon-only). i18n via `next-intl` ✔.

### `LandingThemeToggle` (`apps/web/src/components/marketing/landing-theme-toggle.tsx`)
- **Where**: marketing header/footer. `radiogroup` with `radio` buttons ✔ (good a11y).
- **Actual**: works; framer-motion pill. **Issue**: labels hardcoded English ("Match system", "Light mode") — not `next-intl`. Duplicate of ThemeToggle logic.

### Admin `ThemeToggle` (`apps/admin/src/components/theme-toggle.tsx`)
- **Where**: admin sidebar. Flips light/dark only; system via settings.
- **Issue**: labels hardcoded English ("Switch to light mode", "Theme", "Light mode"). Third independent toggle implementation.

### `Button` (`ui/button.tsx`)
- Variants default/destructive/outline/secondary/ghost/link/foil; sizes default/sm/lg/icon.
- **Disabled**: `disabled:pointer-events-none disabled:opacity-50` ✔. **Focus**: `focus-visible:ring-2 ring-ring ring-offset-2` ✔.
- **No built-in loading state** — callers must implement spinner + `disabled` themselves (see ConfirmDialog). No `aria-busy` convention.

### `Dialog` (`ui/dialog.tsx`)
- **DialogTrigger**: accepts `asChild?` prop but **ignores it** — always renders a `<button>` wrapping children. If a child is itself a `<button>`/link → invalid nested-interactive HTML.
- **Focus**: moves focus in, Tab-traps, Escape closes, restores focus ✔.
- **Missing**: no body scroll lock; focus list is computed once at open (dynamically added focusables aren't trapped); overlay click closes with no "are you sure" for destructive content.
- "Close" `aria-label` hardcoded English.

### `ConfirmDialog` (web, `shared/confirm-dialog.tsx`)
- **Loading**: `loading` state disables both buttons, swaps label ✔. **Error**: `onConfirm` errors are swallowed by `finally` (dialog closes regardless of success/failure — no error surface).
- **Trigger**: wrapped in `<div onClick className="contents">` — activation is on the div, relying on bubbling; keyboard activation works only because the child is interactive. No focus trap (Tab can leave dialog). Defaults `"Confirm"`/`"Cancel"`/`"Deleting..."` hardcoded English.

### `PasswordInput` (`ui/password-input.tsx`)
- Toggle button has `aria-pressed`, `aria-label` (i18n), disabled handling ✔. Good.

### `StatusBadge` (`ui/status-badge.tsx`)
- Forces icon+label (good color-independence) but uses `role="status"` (a live region) on a static badge → screen readers re-announce on render. Also `aria-label={label}` duplicates the visible label text.

## 10. UI/UX Audit

1. **Dark-mode solid semantic badges are low-contrast** — `Badge` `success`/`warning`/`info` use `text-white` on `bg-success/warning/info`. In dark mode those tokens are light (`#54CB7E`/`#E0A85A`/`#37C2C9`); white text yields 2.05/2.12/2.16:1 (measured). Evidence: `ui/badge.tsx:14-16`, dark tokens `globals.css:89-96`. Impact: status badges hard to read for everyone in default (dark) theme. Recommendation: use dark ink on these fills (like `proSolid` does), or switch to the tonal `text-tone-*-fg` pattern already used by `StatusBadge`. Priority: High.
2. **Accent-on-white buttons fail contrast in dark mode** — `EmptyState` primary button `bg-tone-orange-fg text-white` (`shared/empty-state.tsx:36`) and `AppShell` skip-link `bg-brand-orange text-white` (`layout/app-shell.tsx:108`) and `LoadingSpinner` aside. In dark mode `--tone-orange-fg`/`--brand-orange` = Gold `#CBA45E`; white = 2.33:1. Impact: primary CTA / skip link unreadable in the default theme. Recommendation: use `text-primary-foreground` (near-black) on Gold, mirroring `Button` default. Priority: High.
3. **Single static `theme-color`** — `layout.tsx:180` sets `#0A0F18` only; no light-mode `theme-color` media variant. In light mode the mobile browser chrome stays dark navy. Priority: Low.
4. **Web viewport lacks `colorScheme`** — admin declares `colorScheme: "dark light"` (`apps/admin/src/app/layout.tsx:69`); web does not. UA form controls/scrollbars may render dark in web light mode except where `globals.css` manually patches `select`. Priority: Low.
5. **`--bg` token vs painted background mismatch** — `globals.css --bg:#070B14` but `bg-background` HSL ≈ `#0A0F18` and `aurora.css --au-base:#0A0F18`. Surfaces referencing `var(--bg)` (e.g. focus-ring inset) sit on a slightly different black than the canvas. Priority: Low.

## 11. Logic Audit

- **Expected flow**: provider reads stored theme → applies `.light`/`.dark` class on `<html>` → CSS vars cascade → Tailwind utilities resolve. `next-themes` injects a pre-paint script (auto in 0.4.x) to set the class before first paint, avoiding flash.
- **`useTheme` mounted gate**: returns `"dark"` until mounted (web `theme-provider.tsx:27`). This only affects JS that reads `theme` (e.g. icon choice); the CSS class itself is set by the next-themes script, so CSS does not flash. Components that branch on `useTheme().theme` (e.g. canvas/map accent) will momentarily compute against `"dark"` even for a light user until hydration → possible one-frame wrong accent in JS-rendered graphics.
- **Mobile default mismatch with its own docstring**: `theme.ts:348-359` says "First render returns `system`…no flash" but the actual initial `preference` is `"dark"` (`theme.ts:365`) and `hydrated` starts false. A fresh install on a light device renders dark for the first frames, then may stay dark (default), contradicting the "matches the device" comment. Stale-comment / behavior mismatch.
- **No server persistence**: preference lives only in browser storage, so it does not follow the user across devices/sessions cleared, and SSR always emits the dark-class default markup (hydration-safe via `suppressHydrationWarning`).

## 12. Reverse Logic Audit

- **Unauthorized / direct route access**: theme is global and auth-independent — no leak.
- **Empty data**: `EmptyState` variants render fine; web variant's CTA contrast issue (§10.2) applies.
- **API error / slow network**: N/A (no API).
- **Double-click**: `ConfirmDialog` disables buttons while `loading` ✔; `Dialog` close is idempotent.
- **Stale data**: theme toggling is immediate; no staleness.
- **Mobile viewport**: `AppShell` strips chrome in `embed=mobile`; responsive paddings present.
- **Dark theme**: this is where contrast failures bite (§10.1, §10.2) — and it is the **default**, so the worst case is the common case.
- **Role change / token expiry**: no effect on theme.
- **Cross-app**: switching theme on web does not propagate to admin (separate storage keys, by design); mobile separate again. A user toggling light on web still sees dark admin/mobile.

## 13. Security Audit

No high-severity security issues found in this module; it is presentation-only with
no secrets, no network, no user input reflected into the DOM as HTML.

**Finding (Low) — inline pre-paint embed script.**
- **Severity**: Low.
- **Affected area**: `apps/web/src/app/layout.tsx:220-226` (embed-mode bootstrap) and the `next-themes` injected script.
- **Evidence**: a `dangerouslySetInnerHTML` inline script reads `location.search`/`sessionStorage` and sets a `data-embed` attribute; it is nonce-gated (`nonce={nonce}`) under a `strict-dynamic` CSP.
- **Risk**: inline scripts widen the CSP surface; if the nonce were ever omitted or the CSP relaxed, an inline-script foothold becomes easier. The script itself only reads a fixed query param and writes a static attribute — no user-controlled value is interpolated into executable code.
- **Defensive abuse scenario (high-level)**: an attacker who could already inject markup might try to ride an un-nonced inline-script allowance; here the nonce closes that path.
- **Prevention**: keep the nonce mandatory; prefer moving embed detection to a static external nonced file like `register-sw.js`.
- **Detection**: CSP violation reports; test asserting the script always receives a nonce.
- **Analysis (root cause)**: pre-paint logic must run before React, forcing an inline script.
- **Recommendation**: extract to an external nonced script; add a test that the embed/theme bootstrap is never emitted without a nonce.
- **Tests to add**: layout test asserting `nonce` present on every inline `<script>`.

**Finding (Info) — no PII/secret exposure.** Tokens, palettes, mascot SVGs contain
no secrets. localStorage theme key is non-sensitive.

## 14. Performance Audit

- **Token strategy is efficient**: CSS variables + Tailwind utilities; no runtime JS recolor on web/admin.
- **Mobile `useThemedStyles`**: re-runs `StyleSheet.create` on theme change via `useMemo(factory, [factory, t])` — correct, but if a call site passes an inline `factory` (new identity each render) it defeats the memo and rebuilds styles every render. [needs verification at call sites] — `theme.ts:516-519`.
- **`LandingThemeToggle`** pulls in `framer-motion` for a pill animation on a marketing surface — modest bundle cost for a small affordance.
- **Duplicated providers/CSS** across web+admin increase total CSS shipped but each app loads only its own.
- **No N+1 / no redundant API calls** (no API). Skeletons (`loading-state.tsx`) are CLS-aware (mirror real layout) ✔.

## 15. Reliability Audit

- **Error handling**: `ConfirmDialog` swallows `onConfirm` rejection in `finally` and closes regardless — a failed destructive action looks successful (no toast/error state). `shared/confirm-dialog.tsx:51-59`. Reliability/UX gap.
- **Theme persistence best-effort**: mobile `setPreference` catches AsyncStorage write failure silently (acceptable, documented). Web relies on `next-themes` localStorage (can throw in private mode; next-themes guards internally).
- **No error boundary** specific to the theme provider; a throw in a provider would blank the app, but providers here are simple.
- **Monitoring/logging**: none for theme; appropriate.

## 16. Dead Code / Cleanup

- **`Dialog.DialogTrigger asChild` prop** is declared but unused (`ui/dialog.tsx:39`) — dead/ misleading API. Confirm by usage: the prop is accepted and discarded. [low risk to remove or implement]
- **Legacy token aliases** (`brand.orange`, `orangeScale`, `tones.orange/emerald/amber/sky/cyan`, `gradients.warm/glow`, `fontVariationSettings`, Fraunces/Geist fonts in `web/layout.tsx:29-52`) are intentionally retained for back-compat. Whether all are still referenced is **[needs verification]** — a codemod-then-prune pass could remove Fraunces/Geist if no live refs remain (grep needed across full app, not just components).
- **Duplicate components** (not dead, but redundant): web vs admin `ConfirmDialog`, `EmptyState`, `theme-provider`, `theme-toggle`, `language-selector`; web `ThemeToggle` vs `LandingThemeToggle`. Candidates for consolidation into `packages/shared` or a new `packages/ui`.

## 17. Tests

Existing:
- `apps/web/src/components/theme-provider.test.tsx` — asserts string defaults in the provider source (brittle: checks source text, not behavior).
- `apps/admin/src/app/aurora-theme-regression.test.ts` — asserts CSS contains specific token strings (string-match regression).
- `apps/web/src/lib/design-tokens-contrast.test.ts` — real WCAG math, but **light mode only**, and only tone-text-on-tone-fill + light semantic-on-soft + light plan accent.

Missing / suggested:
- **Dark-mode contrast** unit test covering `text-white` on solid `bg-success/warning/info` and accent-on-white (`brand-orange`, `tone-orange-fg`) — would have caught §10.1/§10.2.
- Primitive a11y tests: `Dialog`/`ConfirmDialog` focus trap, Escape, scroll lock, restore focus; `StatusBadge` role; `Button` disabled/focus.
- Token-parity test asserting design-tokens.ts ⇄ globals.css ⇄ admin globals.css numeric values stay in sync (catches the manual-mirror drift).
- Mobile `rose`/`primary` token mapping test to document the intentional coral-vs-Sapphire divergence.
- e2e: toggle theme persists across reload (web/admin/mobile); system preference followed when selected.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| component-theme-system-01 | High | Accessibility | Dark-mode solid semantic badges (`success`/`warning`/`info`) use `text-white` on light fills → 2.0–2.2:1 | Status badges unreadable in default theme; WCAG AA fail | Use dark ink (`text-primary-foreground`) or tonal `text-tone-*-fg` | `apps/web/src/components/ui/badge.tsx:14-16`; `apps/web/src/styles/globals.css:89-96` |
| component-theme-system-02 | High | Accessibility | Accent-on-white CTAs fail dark-mode contrast: EmptyState primary btn + AppShell skip-link (Gold + white = 2.33:1) | Primary CTA / skip link unreadable in default theme | Swap to near-black ink on Gold like `Button` default | `apps/web/src/components/shared/empty-state.tsx:36`; `apps/web/src/components/layout/app-shell.tsx:108` |
| component-theme-system-03 | Medium | Architecture | Three-way token drift: design-tokens.ts (mobile runtime) vs web globals.css vs admin globals.css/aurora.css, synced by hand; values already diverge (admin surfaces/tones differ) | Palette changes risk app-to-app inconsistency; "single source of truth" not enforced | Generate CSS vars from design-tokens.ts at build, or add a parity test | `packages/shared/src/design-tokens.ts:13-23`; `apps/web/src/styles/globals.css`; `apps/admin/src/app/globals.css:39-59` |
| component-theme-system-04 | Medium | Dead Code | Component duplication with no shared UI layer: web vs admin ConfirmDialog/EmptyState/theme-provider/theme-toggle/language-selector + web ThemeToggle vs LandingThemeToggle (3 toggles) | Divergent APIs/behavior, double maintenance, inconsistent UX & i18n | Extract shared primitives into `packages/shared`/`packages/ui` | `apps/web/src/components/shared/confirm-dialog.tsx`; `apps/admin/src/components/confirm-dialog.tsx`; `apps/web/src/components/marketing/landing-theme-toggle.tsx`; `apps/admin/src/components/theme-toggle.tsx` |
| component-theme-system-05 | Medium | Accessibility | Custom `Dialog` lacks body scroll lock; `DialogTrigger asChild` ignored → can emit nested interactive elements; focusables computed once | Background scroll under modal; invalid HTML / broken trap when trigger is a button/link | Add scroll lock; honor `asChild` via Slot; recompute focusables | `apps/web/src/components/ui/dialog.tsx:39-46,53-89` |
| component-theme-system-06 | Medium | Reliability | `ConfirmDialog.onConfirm` rejection swallowed in `finally`; dialog closes regardless of success/failure | Failed destructive action appears to succeed; no error feedback | Catch + surface error; keep open on failure | `apps/web/src/components/shared/confirm-dialog.tsx:51-59` |
| component-theme-system-07 | Low | Accessibility | i18n gaps: admin ThemeToggle, LandingThemeToggle, Dialog "Close", ConfirmDialog defaults hardcode English | Non-English users see English controls in parts of the UI | Route through `next-intl` | `apps/admin/src/components/theme-toggle.tsx:26-44`; `apps/web/src/components/marketing/landing-theme-toggle.tsx:14-23`; `apps/web/src/components/ui/dialog.tsx:108`; `apps/web/src/components/shared/confirm-dialog.tsx:20-24` |
| component-theme-system-08 | Low | Accessibility | `StatusBadge` uses `role="status"` (live region) on static badges + redundant `aria-label` | Screen readers re-announce on render; verbose | Drop `role="status"` for static usage; rely on visible label | `apps/web/src/components/ui/status-badge.tsx:86-104` |
| component-theme-system-09 | Low | Theme | Single static `theme-color` (`#0A0F18`) + web viewport missing `colorScheme`; mobile browser chrome stays dark in light mode | Minor visual mismatch in light mode on mobile | Add light `theme-color` media variant; add `colorScheme:"dark light"` to web viewport | `apps/web/src/app/layout.tsx:149-152,180` |
| component-theme-system-10 | Low | Logic | Mobile theme docstring claims first render follows system/no-flash, but default `preference` is `"dark"` | Light-device users get dark first frames; misleading comment | Align comment with behavior, or default to `system` to honor device | `apps/mobile/src/lib/theme.ts:348-367` |
| component-theme-system-11 | Info | Data | Mobile `rose` className = coral `#E25C5C` (danger tone), diverging from web brand `rose` (Gold/Sapphire) | Cross-platform "rose" means different things; risk of mis-coloring | Document divergence; consider renaming mobile alias | `apps/mobile/tailwind.config.ts:43-48`; `apps/mobile/src/lib/theme.ts:110,197` |
| component-theme-system-12 | Info | Test | Contrast test covers light mode only; provider/aurora tests are string-match regressions | Dark-mode regressions (the default) ship untested | Add dark-mode contrast + token-parity + primitive a11y tests | `apps/web/src/lib/design-tokens-contrast.test.ts`; `apps/web/src/components/theme-provider.test.tsx` |

## 19. Module TODO

- [ ] **(High, a11y) Fix dark-mode badge contrast.** Reason: §10.1, 2.0–2.2:1. Files: `ui/badge.tsx`. Fix: use `text-primary-foreground`/tonal fg on `success/warning/info`. Deps: none. Complexity: low. Risk: low.
- [ ] **(High, a11y) Fix accent-on-white CTA contrast.** Reason: §10.2, 2.33:1. Files: `shared/empty-state.tsx`, `layout/app-shell.tsx`. Fix: near-black ink on Gold. Deps: none. Complexity: low. Risk: low.
- [ ] **(Medium, arch) Enforce token parity.** Reason: §10/§11 drift. Files: `design-tokens.ts`, web/admin `globals.css`. Fix: codegen CSS vars or parity test. Deps: build tooling. Complexity: med. Risk: med (palette changes).
- [ ] **(Medium, cleanup) Consolidate duplicated components into shared UI.** Reason: §16. Files: web/admin confirm-dialog/empty-state/theme-*/language-selector. Fix: `packages/ui`. Deps: cross-app refactor. Complexity: high. Risk: med.
- [ ] **(Medium, a11y) Harden `Dialog`.** Reason: §9/§10. Files: `ui/dialog.tsx`. Fix: scroll lock, honor `asChild`, recompute focusables. Deps: `@radix-ui/react-slot` (already present). Complexity: med. Risk: low.
- [ ] **(Medium, reliability) Surface `ConfirmDialog` errors.** Reason: §15. Files: `shared/confirm-dialog.tsx`. Fix: keep open + toast on rejection. Deps: toast (`sonner`). Complexity: low. Risk: low.
- [ ] **(Low, i18n) Route hardcoded strings through next-intl.** Files per §18-07. Complexity: low. Risk: low.
- [ ] **(Low, a11y) Reconsider `StatusBadge` `role="status"`.** Files: `ui/status-badge.tsx`. Complexity: low. Risk: low.
- [ ] **(Low, theme) Add light `theme-color` + web `colorScheme`.** Files: `apps/web/src/app/layout.tsx`. Complexity: low. Risk: low.
- [ ] **(Low, logic) Align mobile theme default/comment.** Files: `apps/mobile/src/lib/theme.ts`. Complexity: low. Risk: med (changing default to `system` is user-visible).
- [ ] **(Info, test) Add dark-mode contrast + a11y + parity tests.** Files: new under `apps/web`, `packages/shared`. Complexity: med. Risk: low.

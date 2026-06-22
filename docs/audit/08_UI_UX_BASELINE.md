# 08 — UI/UX Baseline (LocateFlow monorepo)

Area slug: `ui-ux-baseline`. READ-ONLY audit. Evidence cites source files relative
to repo root. Items needing a running app are marked
`[needs verification - requires dynamic check]`.

Scope sampled: web (`apps/web`), admin (`apps/admin`), mobile (`apps/mobile`),
shared design tokens (`packages/shared/src/design-tokens.ts`).

---

## 1. Brand / Logo

- **Single design-token source of truth.** `packages/shared/src/design-tokens.ts`
  is documented as the canonical palette/type/spacing source. Crucially it states
  (lines 14-23) that **web and admin do NOT import tokens at runtime** — their
  `globals.css` keeps a *hand-maintained copy* of the same numeric values, "sync
  manually when these change." Only mobile (`apps/mobile/src/lib/theme.ts`)
  imports the tokens at runtime. This is a drift hazard (see `ui-ux-08`).
- **Wordmark is inconsistent across surfaces.** Marketing/`Wordmark`
  (`apps/web/src/components/marketing/logo.tsx:49`) renders the brand as a single
  word "LocateFlow" in Playfair `font-weight:900`. The app sidebar
  (`apps/web/src/components/layout/sidebar.tsx:174-177`) renders it as
  `Locate` + italic foil `flow` ("Locate*flow*"), semibold, DM Sans base. Two
  different lockups for the same product (see `ui-ux-02`).
- **Favicon / app icons.** Root layout (`apps/web/src/app/layout.tsx:185-196`)
  wires `favicon.ico`, `favicon.svg`, a face-only `favicon-small.svg` for 16/32px,
  `apple-touch-icon` (icon-192.png), mask-icon with brand gold `#CBA45E`, and a
  manifest. Reasonable coverage. `LogoMark` uses `<img src="/logo-mark.svg">`
  with `alt=""` + `aria-hidden` (decorative) — correct since the adjacent text
  carries the name.
- **Legacy palette naming carries heavy cognitive debt.** The brand flipped from
  orange → Gold/Sapphire but kept every legacy name (`brand.orange`,
  `orangeScale`, `--orange-500`, `bg-orange-500`, tone `orange`) aliased onto the
  new values (`design-tokens.ts:31-90`, `globals.css:41-57`). Functional, but a
  maintenance trap: `bg-orange-500` renders gold, `tone-orange` renders gold/blue,
  and new contributors will mis-reason about color. (see `ui-ux-09`).

---

## 2. Layout Consistency

- **App shell** (`apps/web/src/components/layout/app-shell.tsx`) is coherent:
  sidebar + header + main + mobile bottom nav, a skip-to-main link
  (lines 106-111), `id="main-content"` focusable region, impersonation banner,
  pending-invitations banner, install prompt. Content max width
  `max-w-screen-2xl`, padding `p-4 md:p-6 pb-20 md:pb-6` (extra bottom padding for
  the floating mobile nav). Good.
- **Embed mode** strips chrome for the mobile in-app browser
  (`app-shell.tsx:89-101`) using a separate `<main>` with `max-w-screen-md`.
  Reasonable, but duplicate `<main id="main-content">` markup exists in two
  branches.
- **Marketing header** (`marketing-header.tsx:31`) sticky, backdrop blur,
  container, h-16. Separate from the app header — expected for a marketing/app
  split.
- **Three distinct CSS systems.** `apps/web/src/styles/globals.css` +
  `aurora.css`; `apps/admin/src/app/globals.css`; mobile NativeWind/`theme.ts`.
  Each re-declares the palette. The `.light` block in web globals.css contains a
  very large hand-written set of per-utility overrides
  (`globals.css:619-767`, e.g. mapping `.text-white/90` → dark ink, dozens of
  `bg-white/*`, `border-white/*`, `text-amber-300` etc.). This is brittle:
  any new `text-white/NN` opacity used in a component won't be remapped for light
  mode unless someone adds the matching override (see `ui-ux-03`).
- **Minor bug:** `app-shell.tsx:117` has a duplicated class
  `backdrop-blur-sm backdrop-blur-sm` on the mobile menu scrim. Harmless but
  sloppy (see `ui-ux-13`).

---

## 3. Theme (light / dark / system)

- **Mechanism:** `next-themes` with `attribute="class"`, `defaultTheme="dark"`,
  `enableSystem`, `disableTransitionOnChange`, persisted in `localStorage`
  (`apps/web/src/components/theme-provider.tsx:6-20`, key `locateflow-theme`;
  admin key `locateflow-admin-theme`). System theme supported. Theme persists
  across reloads via localStorage.
- **CSS default is dark.** `globals.css:21-22` declares vars on `:root, .dark`,
  with `.light` (line 215) overriding. So an un-classed document renders dark.
  `next-themes` injects the class pre-paint via its inline script, so the
  documented intent is no-flash. **However** `<html suppressHydrationWarning>`
  plus a hard-coded `defaultTheme="dark"` means **a user whose preference is
  `light` or `system`-light can see a one-frame dark flash** before the theme
  script resolves on slow hydration — classic next-themes behavior; needs runtime
  confirmation (see `ui-ux-04`, `[needs verification - requires dynamic check]`).
- **Static `<meta theme-color content="#0A0F18">`** is hard-coded dark in web
  root (`layout.tsx:180`) and `#171E2B` in admin viewport
  (`apps/admin/src/app/layout.tsx:68`). It does not switch in light mode, so the
  mobile browser chrome stays dark even when the app is in light theme
  (see `ui-ux-05`). Note also the value `#0A0F18` does not match the actual dark
  surface token `--bg: #070B14` (`design-tokens.ts:97`) — a third, unsynced color.
- **Mobile theme** (`apps/mobile/src/lib/theme.ts`) has a genuine dual-palette
  Context with `system|light|dark` preference persisted in AsyncStorage
  (`locateflow.theme.preference`), default dark. **Documented gradual-migration
  gap (lines 36-45):** components still using the static `theme` import keep
  rendering the dark palette and do NOT live-switch until reload. So mobile theme
  switching is partial/inconsistent by design (see `ui-ux-06`).
- **Contrast risk:** focus ring `--border-focus` in dark mode is
  `rgba(203,164,94,0.55)` gold (`globals.css:81`); muted text uses very low
  opacities (`--fg-3: 0.43`, `--fg-4: 0.30`, `--fg-muted: 0.22`,
  `design-tokens.ts:118-121`). Text at `--fg-4`/`--fg-muted` on the dark surface
  is likely below WCAG AA 4.5:1 (see `ui-ux-07`,
  `[needs verification - requires dynamic check]`).

---

## 4. Typography

- **Font stack:** Playfair Display (display/serif), DM Sans (UI), DM Mono
  (numerals/meta) — loaded via `next/font/google` in both web and admin layouts
  (`apps/web/src/app/layout.tsx:57-80`, `apps/admin/src/app/layout.tsx:15-38`).
  Web additionally loads **legacy Geist, Geist Mono, and Fraunces** "for
  not-yet-migrated references" (`layout.tsx:29-52`). Loading 6 font families in
  web — three of them legacy fallbacks still shipped to every visitor — is a
  perf/weight concern (see `ui-ux-10`).
- **Type scale** is defined in tokens (`fontSizes` 11→96px,
  `design-tokens.ts:439-452`) but web/admin components hardcode Tailwind text
  sizes (`text-sm`, `text-2xl`, `text-[22px]`, `text-[13.5px]`,
  `text-[10px]`) rather than referencing the scale — e.g. `CardTitle` is
  `text-2xl` (`card.tsx:41`), Wordmark `text-[22px]` (`logo.tsx:43`), nav labels
  `text-[10px]`/`text-[13.5px]`. Scale exists but isn't enforced.
- **Heading hierarchy:** `CardTitle` renders as `<h3>` (`card.tsx:41`) regardless
  of document context, so card grids can produce `h3`s without a parent `h1/h2`,
  breaking the heading outline on some pages (see `ui-ux-11`,
  `[needs verification - requires dynamic check]`).
- **line-height / letter-spacing** tokens exist (`lineHeights`,
  `letterSpacing`, `design-tokens.ts:463-476`) and are consumed by mobile;
  web relies on Tailwind defaults + a few `leading-none` usages.

---

## 5. Components (states inventory)

Web UI primitives live in `apps/web/src/components/ui/`. They are lightweight,
hand-rolled (NOT a full shadcn set):

| Component | File | Notes |
|---|---|---|
| Button | `ui/button.tsx` | CVA variants default/destructive/outline/secondary/ghost/link/foil; sizes; focus-visible ring. No built-in loading/spinner state. |
| Input | `ui/input.tsx` | focus ring, disabled. **No `aria-invalid`/error styling, no built-in label association** (see `ui-ux-12`). |
| Select | `ui/select.tsx` | native `<select>` only — no custom dropdown/listbox. |
| Textarea | `ui/textarea.tsx` | same pattern as Input; no error state. |
| Label | `ui/label.tsx` | styling only; does not auto-wire `htmlFor`. |
| Card | `ui/card.tsx` | default/glass variants, optional hover lift. Title=`<h3>`. |
| Dialog (modal) | `ui/dialog.tsx` | hand-rolled focus trap, Esc close, focus restore, `role=dialog` + `aria-modal` + `aria-labelledby`. See a11y notes. |
| Badge / StatusBadge | `ui/badge.tsx`, `ui/status-badge.tsx` | present. |
| Skeleton | `ui/skeleton.tsx` | present (loading). |
| Separator | `ui/separator.tsx` | present. |
| Toast | `sonner` `<Toaster richColors position="top-right">` (`layout.tsx:233`) | global. |
| Empty state | `components/shared/empty-state.tsx` | icon/illustration + title + desc + primary/secondary action. |
| Confirm dialog | `components/shared/confirm-dialog.tsx` | present. |

- **No shared Table, Tabs, Dropdown-menu, Tooltip, or generic Loading/Spinner
  primitive** under `ui/`. Tables/tabs/dropdowns are evidently composed ad-hoc
  per page (admin has many table pages). This means table/tab/dropdown
  accessibility and styling are not centralized and likely vary
  (see `ui-ux-14`).
- **Empty state** is well-designed and on-brand (raccoon illustration support).
  But it is a plain `<div>` with no `role`/landmark and the action buttons are
  bare `<button>`/`<Link>` styled inline rather than the `Button` primitive
  (`empty-state.tsx:36-37,49-63`) — visual divergence from the Button component.

---

## 6. Accessibility

Positives:
- Skip-to-main link with proper sr-only/focus reveal (`app-shell.tsx:106-111`).
- `<html lang={locale}>` mirrors the active locale (`layout.tsx:174`).
- Sidebar nav items set `aria-current="page"` on the active route and provide
  `sr-only` unread-count text (`sidebar.tsx:116,136`).
- Dialog implements a focus trap, Esc-to-close, focus restoration, and ARIA
  dialog roles (`dialog.tsx:53-119`).
- Mobile sidebar overlay has `aria-label`, the close button has `aria-label`,
  decorative icons/badges are `aria-hidden`.

Gaps / risks:
- **`ui-ux-15` Bottom mobile nav lacks `aria-current`.** Unlike the sidebar, the
  mobile tab bar (`mobile-nav.tsx:33-50`) marks the active tab only via color,
  with no `aria-current` and no `<nav aria-label>`. Screen-reader users get no
  "current page" cue and active state relies on color alone.
- **`ui-ux-12` Inputs/Textarea have no error/invalid affordance.** No
  `aria-invalid`, `aria-describedby`, or error styling baked into the primitives.
  Form error messaging is therefore per-page and may omit programmatic
  association of error text to fields — a WCAG 3.3.1 risk.
- **`ui-ux-16` Dialog focus trap is shallow.** The trap queries focusables once
  on open (`dialog.tsx:67`) and the scrim is a full-screen clickable
  `<div onClick>` with `aria-hidden` (`dialog.tsx:95`) — acceptable, but the
  dialog has no `aria-describedby` wiring to `DialogDescription`, and dynamically
  added focusables aren't re-scanned. Compared to Radix, this is a reduced
  implementation. `[needs verification - requires dynamic check]`
- **`ui-ux-17` Native `<select>` only.** No combobox pattern; long option lists
  (states, providers) rely on the native control. Functional and accessible by
  default, but inconsistent with the custom-styled rest of the UI.
- **Contrast** of low-opacity foreground tokens and gold-on-navy focus ring needs
  measured verification (`ui-ux-07`).
- Color-only state communication appears in mobile nav and active sidebar
  (mitigated by `aria-current` in sidebar, not in mobile nav).

---

## 7. Responsive

- Viewport meta present (`layout.tsx:149-152`, admin adds `viewportFit:"cover"`).
- Tailwind breakpoints used throughout: sidebar `hidden md:flex`, mobile sidebar
  drawer `md:hidden`, mobile bottom nav `md:hidden`, padding `p-4 md:p-6`,
  content `max-w-screen-2xl`/`max-w-screen-md` (`app-shell.tsx`, `sidebar.tsx`,
  `mobile-nav.tsx`). Marketing nav `hidden lg:flex` with a separate mobile nav.
- `safe-area-inset-bottom` used on the floating mobile nav (`mobile-nav.tsx:29`).
- Collapsible desktop sidebar (`w-60` ↔ `w-[68px]`) (`sidebar.tsx:164`).
- Large-screen and orientation behavior, plus whether the floating bottom nav
  overlaps content on short viewports, need runtime checks
  `[needs verification - requires dynamic check]`.

---

## 8. UX Flows

- **First run / onboarding:** dedicated `apps/web/src/app/onboarding/` route +
  layout and `components/onboarding/*` (ob-coach, ob-cta, pro-showcase). Mobile
  has `app/onboarding.tsx`. Present.
- **Form submit / success / error:** global `sonner` toaster with `richColors`
  provides success/error toasts app-wide (`layout.tsx:233`). Per-field inline
  error association is not standardized (see `ui-ux-12`).
- **Empty data:** shared `EmptyState` used (e.g. addresses-client uses it). Good
  consistency where adopted.
- **Unauthorized access:** admin has a `(admin)/forbidden/page.tsx`; web auth
  gating handled server-side (out of this area's scope, see auth audit).
- **Back nav / offline:** `apps/web/src/app/offline/page.tsx` exists; service
  worker registered (`layout.tsx:238`).
- **i18n inconsistency in marketing nav:** `marketing-header.tsx:15-22` hardcodes
  English nav labels ("Features", "Why free", "Pricing", "Help", "Blog", "FAQ")
  while the app sidebar deliberately uses `nav.*` translation keys
  (`sidebar.tsx:72-95`). The codebase's own comment forbids hardcoded strings in
  nav; the marketing header violates that convention (see `ui-ux-18`).

---

## Findings summary

See structured findings. Severities reflect UI/UX baseline impact, not security.
Several items require a running app to confirm pixel-level contrast and
flash-of-theme behavior and are flagged accordingly.

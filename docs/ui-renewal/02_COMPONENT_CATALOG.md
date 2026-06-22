# 02 — Component Catalog (Theme-Renewal Memory)

Exhaustive inventory of reusable UI components across **web** (`apps/web`), **admin** (`apps/admin`),
and **mobile** (`apps/mobile`). Captures current structure, styling approach, theme handling,
hardcoded values, and brand usage. This is an inventory of **what EXISTS** — no redesign proposals.

All file paths are relative to repo root `C:/Users/Windows/Desktop/Staging/staging-move/`.

---

## 0. Styling-system summary (how "theme-aware" is judged below)

| App | Styling approach | Theme mechanism | Token source | "Theme-aware" means |
|---|---|---|---|---|
| **web** | Tailwind 3.4 + CSS variables; CVA for variants; `cn()` util | `next-themes`, `attribute="class"`, `defaultTheme="dark"`, `storageKey="locateflow-theme"`, themes `light/dark/system` (`apps/web/src/components/theme-provider.tsx`) | `apps/web/src/styles/globals.css` (manual mirror of canonical tokens) | Uses semantic Tailwind tokens: `bg-primary`, `text-foreground`, `bg-card`, `border-input`, `text-muted-foreground`, `bg-tone-*`, `text-tone-*-fg` |
| **admin** | Tailwind + CSS variables; aurora `--au-*` token layer; `cn()`; `sonner` for toasts | `next-themes` via `apps/admin/src/components/theme-provider.tsx` (light = "slate", dark = "aurora") | `apps/admin/src/app/globals.css` + `apps/admin/src/app/aurora.css` (`.au-*`, `--au-*`, `tone-*`) | Uses `text-foreground`, `bg-card`, `bg-tone-*`, `--au-*` driven classes (`.admin-panel`, `.adp-topbar`, `.au-q*`) |
| **mobile** | React Native `StyleSheet` + NativeWind 4; `useAppTheme()` hook injects a JS `Theme` object | `useAppTheme()` from `apps/mobile/src/lib/theme.ts` (light/dark JS palettes); `react-native-reanimated` for motion | `packages/shared/src/design-tokens.ts` (runtime consumer) → `apps/mobile/src/lib/theme.ts` | Reads `theme.colors.*`, `theme.radius.*`, `theme.shadow.*` via `makeStyles(theme)` |

**Canonical token module:** `packages/shared/src/design-tokens.ts` — *Edition VIII LocateFlow Gold/Sapphire*.
Dark mode = **Gold** (`#CBA45E`) primary; light mode = **Sapphire** primary. Legacy export names
(`brand.orange`, `roseScale`, `foilScale`) preserved on purpose. **Only mobile consumes this file at
runtime**; web `globals.css` and admin `aurora.css` keep *manually-synced copies* of the same numeric
values (drift risk flagged below).

**Brand:** raccoon mascot + "LocateFlow" wordmark in `var(--font-display, Playfair Display)`.
Logo asset `/logo-mark.svg` reused by web launcher, admin rail, favicon, PWA.

---

## 1. PRIMITIVES

### 1.1 Button

| Component | App(s) | File | Purpose | Variants / props (visual) | Theme-aware? | States (loading/empty/error/disabled) | Used by | Duplication | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `Button` | web | `apps/web/src/components/ui/button.tsx` | Core CTA | CVA `variant`: default, destructive, outline, secondary, ghost, link, **foil** (Aurora Sapphire premium); `size`: default/sm/lg/icon; `asChild` (Radix Slot) | **Yes** — `bg-primary`, `text-primary-foreground`, `bg-secondary`, etc. `foil` styling lives in `globals.css` `.btn-foil` | disabled (`disabled:opacity-50 disabled:pointer-events-none`). **No built-in loading/spinner state** | All web app + auth + settings forms | **Triplicated** primitive (web/admin/mobile each own a Button) | No loading prop on web; callers add spinners manually. Add `loading` for parity with mobile |
| (Button styling) | admin | `apps/admin/src/app/aurora.css` (no dedicated component) | Admin reuses raw `<button>` + utility classes / inline `bg-destructive` etc. | No CVA component — `confirm-dialog`/`password-confirm-modal` hardcode button class strings (`bg-destructive text-destructive-foreground hover:bg-destructive/90`) | Yes (token classes) | per-call-site | All admin modals/forms | **Missing shared admin Button primitive** — button styles copy-pasted across admin components | Extract an admin `Button`; currently inconsistent |
| `Button` | mobile | `apps/mobile/src/components/ui/Button.tsx` | Core CTA (RN) | `variant`: primary, secondary, ghost, danger, outline, **gradient**; `size`: sm/md/lg/**cta** (54px onboarding); `disabledTone`: opacity\|neutral (real locked state w/ Lock glyph); `icon`/`iconRight`/`rightIcon`; `fullWidth`; Aurora shimmer sweep on press | **Yes** — `theme.colors.primary/accent/...`; `makeStyles(theme)` | **loading** (ActivityIndicator), **disabled** (opacity + neutral-locked variants) | Mobile-wide | Triplicated; richest of the three (loading + locked + gradient + shimmer) | **Hardcoded:** `"#fff"` text/spinner, `"rgba(226,92,92,0.30)"` danger border, `"rgba(255,255,255,0.4)"` shimmer. Mostly intentional achromatic overlays |

### 1.2 Input / Textarea / Select / Label / PasswordInput

| Component | App(s) | File | Purpose | Variants / props | Theme-aware? | States | Used by | Duplication | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `Input` | web | `apps/web/src/components/ui/input.tsx` | Text field | passthrough `InputHTMLAttributes`; no variants | Yes (`border-input bg-background text-muted-foreground focus-visible:ring-ring`) | disabled. **No error/invalid styling built in** | All web forms | Dup of mobile `Input` | No `error`/`label`/`hint` props (unlike mobile). Error state is caller-managed |
| `Textarea` | web | `apps/web/src/components/ui/textarea.tsx` | Multiline field | passthrough; `min-h-[80px]` | Yes | disabled | Forms (quotes, support) | web-only | Same gap as Input |
| `Select` | web | `apps/web/src/components/ui/select.tsx` | Native `<select>` wrapper | passthrough; no variants | Yes | disabled | Filters, forms | web-only | **Native select only** — no styled dropdown/listbox primitive (see Missing Primitives §6) |
| `Label` | web | `apps/web/src/components/ui/label.tsx` | Form label | passthrough; `peer-disabled` styling | Yes (`text-sm font-medium`) | disabled (via peer) | All web forms | web-only | Not Radix; plain `<label>` |
| `PasswordInput` | web | `apps/web/src/components/ui/password-input.tsx` | Password field w/ eye toggle | `wrapperClassName`; i18n via `next-intl` | Yes (`text-muted-foreground focus-visible:ring-ring`) | disabled; toggle visible/hidden | Auth (login/register/reset) | Dup of mobile `Input isPassword` | OK |
| `Input` | mobile | `apps/mobile/src/components/ui/Input.tsx` | Text field (RN) | `label`, `error`, `hint`, `icon`/`leftIcon`/`rightIcon`, `isPassword` (eye toggle), `containerStyle` | Yes (`theme.colors.surface/border/borderFocus/text`) | **focused**, **error** (red border + msg), disabled (editable=false), password toggle | Mobile forms | Dup of web Input (richer — has error/label/hint baked in) | **Hardcoded** `"rgba(226,92,92,0.50)"` error border (matches `theme.colors.error`) |

### 1.3 Dialog / Modal

| Component | App(s) | File | Purpose | Variants / props | Theme-aware? | States | Used by | Duplication | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `Dialog` (+ Trigger/Content/Header/Footer/Title/Description) | web | `apps/web/src/components/ui/dialog.tsx` | Hand-rolled accessible modal (NOT Radix) | controlled `open`/`onOpenChange`; `max-w-lg`; custom focus trap, Esc, focus restore | Yes (`bg-background`, `bg-black/80` scrim) | open/closed | Settings dialogs, confirmations | Conceptually dup of admin's per-modal implementations | Custom focus-trap reimplements Radix Dialog. Scrim `bg-black/80` is fixed (not token) |
| `ConfirmDialog` (web shared) | web | `apps/web/src/components/shared/confirm-dialog.tsx` | Confirm prompt | — | Yes | busy | Destructive actions | Dup of admin `confirm-dialog` | Two confirm dialogs (web shared vs admin) |
| `ConfirmDialog` | admin | `apps/admin/src/components/confirm-dialog.tsx` | Destructive confirm (no step-up) | `tone`: destructive\|default; `busy`; `confirmLabel`/`cancelLabel` | Yes (`bg-card border-border text-foreground`; `bg-destructive`) | busy/disabled; focus mgmt, Esc | Admin destructive actions | Dup of web ConfirmDialog + web Dialog | Self-contained modal markup (not built on a shared Modal) |
| `PasswordConfirmModal` | admin | `apps/admin/src/components/password-confirm-modal.tsx` | Step-up auth (password + MFA/backup code) | `requiresMfa`, `error`, `busy` | Yes (`bg-card border-border`) | busy, error, mfa-required | Admin privileged ops | admin-only | Good a11y; modal chrome copy-pasted from confirm-dialog |
| `QuickDrawer` (+ Section/Row) | admin | `apps/admin/src/components/quick-drawer.tsx` | 432px right slide-in quick-look | `eyebrow`, `title`, `subtitle`, `initials`/`icon`, `tone` (MinistatTone), `stats[]`, `meta`, `footer` | Yes — visuals in `aurora.css` `.au-q*` | open/closed; focus trap, Esc, scrim | Admin list→detail peeks | admin-only | Renders in-memory data only (no fetch) |
| `command-palette` | admin | `apps/admin/src/components/command-palette.tsx` | ⌘K/Ctrl+K global search overlay | nav/action/user/provider rows; permission-gated | Yes (`cn` + token classes) | empty query, loading entities | Admin global | admin-only (web has `global-search`) | — |
| `RevealModal` | web | `apps/web/src/components/premium/reveal-modal.tsx` | Premium reveal modal | — | Partial — **contains hardcoded hex** | — | Premium reveal flow | web-only | **Flag: hardcoded colors** |

> **No mobile modal/dialog primitive in `ui/`** — mobile uses RN `Modal`/screens or `@gorhom/bottom-sheet` ad hoc per screen. [needs verification of exact lib per screen]

### 1.4 Toast / Notification

| Component | App(s) | File | Purpose | Variants | Theme-aware? | States | Used by | Duplication | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `toast` (sonner) | admin | external `sonner` (imported in `data-table-page.tsx`, `sidebar.tsx`, etc.) | Toast notifications | sonner defaults | Inherits theme via Toaster config | success/error | Admin-wide | Admin uses `sonner` | Web/mobile do NOT use sonner — inconsistent toast strategy |
| `SuccessToast` | mobile | `apps/mobile/src/components/ui/SuccessToast.tsx` | In-app success toast (RN) | — | Yes (theme) | success | Mobile flows | mobile-only bespoke | No web equivalent component |
| `OfflineChip` | mobile | `apps/mobile/src/components/ui/OfflineChip.tsx` | Offline status chip | — | Yes | offline | Mobile global | mobile-only | — |
| `NotificationCenter` | web | `apps/web/src/components/layout/notification-center.tsx` | Bell + notifications panel | — | Yes | empty/loading | Web header | web-only | Feature, not a toast primitive |

> **Missing shared Toast primitive** across web/mobile — admin's sonner, mobile's `SuccessToast`, and web's inline patterns are three different systems.

### 1.5 Card

| Component | App(s) | File | Purpose | Variants | Theme-aware? | States | Used by | Duplication | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `Card` (+ Header/Title/Description/Content/Footer) | web | `apps/web/src/components/ui/card.tsx` | Surface container | `variant`: default \| **glass** (Aurora frosted, `glass-card`); `hover` (lift `lf-card-hover`) | Yes (`bg-card text-card-foreground`; glass uses `--glass-bg`) | static | Dashboards, settings, marketing | Triplicated | Glass treatment in `globals.css` |
| `Card` | mobile | `apps/mobile/src/components/ui/Card.tsx` | Surface (RN, pressable) | `variant`: default, elevated, bordered, glow, glass; `onPress`/`onLongPress` w/ press-scale | Yes (`makeStyles(theme)`) | pressable | Mobile-wide | Triplicated (richer variants) | — |
| `AdminPanel` | admin | `apps/admin/src/components/admin-panel.tsx` | Section wrapper (head + body) | `dense`, `flagship` (foil ring/glow); `actions` slot | Yes — `.admin-panel`/`.admin-panel-head` in globals.css | static | ~all admin pages | admin's "card" equivalent | Admin has no generic `Card`; `AdminPanel` is the de-facto surface |
| `CollapsibleCard` | mobile | `apps/mobile/src/components/ui/CollapsibleCard.tsx` | Expand/collapse card | — | Yes | expanded/collapsed | Mobile detail screens | mobile-only | — |

### 1.6 Badge / Status

| Component | App(s) | File | Purpose | Variants | Theme-aware? | States | Used by | Duplication | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `Badge` | web | `apps/web/src/components/ui/badge.tsx` | Label chip | CVA: default, secondary, destructive, outline, success, warning, info, **rose, foil, sage, honey, danger**, **individual, family, pro, proSolid** (plan badges) | Mostly yes (`bg-tone-rose-bg`, `text-tone-foil-fg`...) | static | Plans, statuses | Dup of mobile Badge | **Hardcoded:** `proSolid` ink `text-[#0A0F18]` |
| `StatusBadge` | web | `apps/web/src/components/ui/status-badge.tsx` | A11y status chip (icon is structural, WCAG 1.4.1) | `status`: success/warning/error/info/pending/neutral; `size` sm/md/lg; `icon` override | **Yes** — `bg-tone-emerald-bg text-tone-emerald-fg` etc. | conveys state via icon+label (not color alone) | Payment/job status | web-only | Model component for color-blind safety; replicate to admin/mobile |
| `Badge` | mobile | `apps/mobile/src/components/ui/Badge.tsx` | Label chip (RN) | tone variants (neutral, etc.) | Yes (theme) | static | Mobile-wide | Dup of web Badge | **Hardcoded** `"rgba(236,241,248,0.05)"` neutral bg |
| `health-pill` | admin | `apps/admin/src/components/premium/health-pill.tsx` | Health/status pill | tone-based | Yes | status | Admin premium/health | admin-only | — |
| `tier-stamp` / `tier-medallion` | admin | `apps/admin/src/components/premium/{tier-stamp,tier-medallion}.tsx` | Plan tier visual marks | tier-based | medallion = SVG | static | Admin premium | admin-only | **`tier-medallion` hardcodes hex** (`#fff`, `#DDE7F5` gradient stops) — SVG gradient |
| `premium-sticker` | web | `apps/web/src/components/premium/premium-sticker.tsx` | Premium foil sticker | — | Partial — **hardcoded hex** | static | Premium upsell | web-only | **Flag: hardcoded colors** |

### 1.7 Skeleton / Spinner / Loading / Empty / Error

| Component | App(s) | File | Purpose | Variants | Theme-aware? | States | Used by | Duplication | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `Skeleton` | web | `apps/web/src/components/ui/skeleton.tsx` | Pulse placeholder | passthrough | Yes (`bg-muted`, `motion-safe:animate-pulse`) | loading | Many | Dup of mobile Skeleton | — |
| `LoadingSpinner` / `CardSkeleton` / `ListSkeleton` / `DashboardSkeleton` | web | `apps/web/src/components/shared/loading-state.tsx` | Loading states | count prop on ListSkeleton; layout-matched DashboardSkeleton (CLS-safe) | Mostly — but **`text-tone-orange-fg`** spinner + `bg-foreground/5` placeholders | loading | App-wide | — | **No generic web `Spinner` primitive** — only this `Loader2`-based helper. Spinner color tied to `tone-orange-fg` |
| `EmptyState` | web | `apps/web/src/components/shared/empty-state.tsx` | Empty state w/ optional illustration | `icon` or `illustration` (raccoon), primary+secondary action (label/href/onClick) | Mostly — but **primary btn = `bg-tone-orange-fg text-white`** hardcoded class, `glass-card` | empty | List/dashboard surfaces | Dup of admin + mobile EmptyState | Inline button styling (not the `Button` primitive) |
| `EmptyState` | admin | `apps/admin/src/components/empty-state.tsx` | Empty state panel | `icon`, `title`, `description`, `action`, `compact` | Yes (`bg-card/55 border-border/60 text-muted-foreground backdrop-blur-xl`) | empty | ~20 admin list pages (via `DataTablePage`) | Dup (3 EmptyStates) | Glass/backdrop-blur baked in |
| `EmptyState` | mobile | `apps/mobile/src/components/ui/EmptyState.tsx` | Empty state (RN) | — | Yes (theme) | empty | Mobile lists | Dup (3 EmptyStates) | — |
| `foil-empty-state` | web | `apps/web/src/components/premium/foil-empty-state.tsx` | Premium-flavored empty state | foil treatment | Yes/partial | empty | Premium surfaces | web-only | — |
| `ErrorState` | mobile | `apps/mobile/src/components/ui/ErrorState.tsx` | Error display (RN) | — | Yes; **contains rgba/hex** | error | Mobile screens | mobile-only | **No web/admin `ErrorState` component** — error UI inline elsewhere |
| `LoadingScreen` / `LoadingOverlay` | mobile | `apps/mobile/src/components/ui/LoadingScreen.tsx` | Full-screen / overlay loaders | — | Yes; **rgba/hex** | loading | Mobile-wide | mobile-only | — |
| `Skeleton` | mobile | `apps/mobile/src/components/ui/Skeleton.tsx` | Pulse placeholder (RN) | — | Yes | loading | Mobile | Dup of web | — |
| `GradientProgress` | mobile | `apps/mobile/src/components/ui/GradientProgress.tsx` | Gradient progress bar | — | Yes; **rgba/hex gradient stops** | progress | Onboarding/move | mobile-only | — |
| `install-prompt` | web | `apps/web/src/components/shared/install-prompt.tsx` | PWA install banner | — | Partial — **hardcoded hex** | dismissible | App shell | web-only | **Flag: hardcoded colors** |

### 1.8 Avatar / Icon / Logo / Mascot

| Component | App(s) | File | Purpose | Theme-aware? | Brand usage | Duplication | Renewal notes |
|---|---|---|---|---|---|---|---|
| `CategoryIcon` (+ `categoryIconFor`) | web | `apps/web/src/components/ui/category-icon.tsx` | Maps service category → Lucide icon | Yes (`currentColor`) | — | **Dup** of mobile `CategoryIcon` (`apps/mobile/src/components/ui/CategoryIcon.tsx`) | Two identical category→icon maps to keep in sync |
| `CategoryIcon` | mobile | `apps/mobile/src/components/ui/CategoryIcon.tsx` | same | Yes | — | Dup of web | — |
| `Avatar` | mobile | `apps/mobile/src/components/ui/Avatar.tsx` | User avatar (RN) | Yes | — | mobile-only (web uses initials inline in header) | No shared web `Avatar` component |
| `LogoMark` / `Wordmark` | web | `apps/web/src/components/marketing/logo.tsx` | Brand mark + wordmark | Yes (`text-foreground`, `var(--font-display)`) | **`/logo-mark.svg`** + Playfair Display wordmark | Logo asset reused in admin rail (`sidebar.tsx` `RailMark`) | Single source of brand mark image |
| `LogoBrand` | mobile | `apps/mobile/src/components/ui/LogoBrand.tsx` | Brand lockup (RN) | Yes; **rgba/hex** | wordmark/mark | Dup of web `Wordmark` | — |
| `BrandLogos` / `ServiceLogoMark` | mobile / both | `apps/mobile/src/components/ui/BrandLogos.tsx`; `apps/mobile/src/components/services/ServiceLogoMark.tsx`; `apps/web/src/components/services/service-logo-mark.tsx` | Third-party service logos | Partial; **rgba/hex** | provider brand marks | `ServiceLogoMark` dup web↔mobile | — |
| `RaccoonMascot` / `RaccoonWalking` | mobile | `apps/mobile/src/components/ui/{RaccoonMascot,RaccoonWalking}.tsx` | Animated mascot | Yes/partial | **mascot** | Dup of web raccoon illustrations | — |
| Raccoon illustrations | web | `apps/web/src/components/illustrations/{RaccoonHero,RaccoonLost,RaccoonMark,RaccoonReading}.tsx` | Mascot SVG illustrations | `RaccoonMark` **hardcodes hex** | **mascot** | Dup of mobile mascots | **Flag: hardcoded hex** in `RaccoonMark.tsx` (likely intentional SVG fills) |

### 1.9 Theme controls / Language

| Component | App(s) | File | Purpose | Variants | Theme-aware? | Duplication | Renewal notes |
|---|---|---|---|---|---|---|---|
| `ThemeToggle` | web | `apps/web/src/components/theme-toggle.tsx` | Theme switch | `variant`: inline (system→light→dark cycle) \| icon (light/dark only) | Yes; i18n `next-intl` | Dup across apps | Mount-guard to avoid hydration jump |
| `ThemeToggle` | admin | `apps/admin/src/components/theme-toggle.tsx` | Theme switch | — | Yes | Dup of web | — |
| `ThemeSelector` | mobile | `apps/mobile/src/components/ui/ThemeSelector.tsx` | Theme picker (RN) | light/dark/system | Yes | Dup of web ThemeToggle | — |
| `theme-provider` | web/admin | `apps/{web,admin}/src/components/theme-provider.tsx` | next-themes wrapper + `useTheme()` | — | — | Parallel providers | Web default `dark`; both `storageKey`-scoped |
| `language-selector` | web/admin | `apps/web/src/components/language-selector.tsx`; `apps/admin/src/components/language-selector.tsx` | Locale switch | — | web one **has hardcoded hex** | Dup web↔admin | — |
| `LanguageSelector` | mobile | `apps/mobile/src/components/ui/LanguageSelector.tsx` | Locale switch (RN) | — | Yes | Dup | — |

---

## 2. TABLE / TABS / DROPDOWN / DATA (the "is a primitive missing?" check)

| Concern | Status | Where | Notes |
|---|---|---|---|
| **Table** | **No shared `Table` primitive.** Admin has a full data-table *page shell* | `apps/admin/src/components/data-table-page.tsx` (`DataTablePage`, `DataTableColumn`, `FetchResult`, `FilterControl`) | Standardizes search/sort/filter/paginate/column-settings/bulk-select/saved-views for ~20 admin list pages. Token-themed (aurora chrome). **Web/mobile have no table abstraction** — web renders tables ad hoc. Supporting: `column-settings-menu.tsx`, `saved-views-menu.tsx`, `ministat-strip.tsx`, `sub-nav.tsx`, `admin-page-header.tsx` |
| **Tabs** | **No shared `Tabs` primitive in any app.** | — | `sub-nav.tsx` (admin) is the closest (segmented nav). [needs verification of any web tab pattern] |
| **Dropdown / Menu** | **No generic `DropdownMenu` primitive.** | — | Web uses native `Select` (`ui/select.tsx`) + bespoke menus (header user menu inline in `layout/header.tsx`). Admin uses bespoke menus (`column-settings-menu`, `saved-views-menu`, `command-palette`). No Radix DropdownMenu |
| **Spinner** | **No standalone `Spinner` primitive.** | — | Web: `LoadingSpinner` (Loader2) in `shared/loading-state.tsx`. Mobile: RN `ActivityIndicator` inline. Admin: `Loader2` inline in `data-table-page.tsx` |
| **Tooltip** | Partial | `apps/admin/src/components/info-hint.tsx` (tap/click popover, a11y) | Admin-only `InfoHint`. No shared Tooltip primitive |
| **Separator** | web only | `apps/web/src/components/ui/separator.tsx` | horizontal/vertical, `decorative` |
| **Charts/Viz** | admin aurora set | `apps/admin/src/components/aurora/{sparkline,ring,plan-donut,revenue-trend,signups-trend,overview-trends,aurora-stat-card}.tsx` | Admin dashboard viz. Mobile has `monthly-spark` equivalents (`budget-donut`, `monthly-spark` on web dashboard). Web dashboard: `budget-donut.tsx`, `monthly-spark.tsx`, `stats-card.tsx`. **Viz duplicated web↔admin↔mobile** |

---

## 3. LAYOUT components

| Component | App | File | Purpose | Theme-aware? | Notes |
|---|---|---|---|---|---|
| `AppShell` | web | `apps/web/src/components/layout/app-shell.tsx` | Authenticated shell (header + sidebar + mobile nav + banners) | Yes | `planTier` class hook; embed-mobile mode via `lf:embed-mobile` |
| `Header` | web | `apps/web/src/components/layout/header.tsx` | Top header (user menu, search, theme, lang) | Yes | User menu inline (no Dropdown primitive) |
| `Sidebar` | web | `apps/web/src/components/layout/sidebar.tsx` | App nav rail | Yes | — |
| `MobileNav` | web | `apps/web/src/components/layout/mobile-nav.tsx` | Bottom/mobile nav | Yes | — |
| `GlobalSearch` | web | `apps/web/src/components/layout/global-search.tsx` | App search | Yes | Parallel to admin `command-palette` |
| `ImpersonationBanner` | web | `apps/web/src/components/layout/impersonation-banner.tsx` | Admin impersonation notice | **hardcoded hex** | **Flag** |
| `PendingInvitationsBanner` | web | `apps/web/src/components/layout/pending-invitations-banner.tsx` | Invite banner | Yes | — |
| `NotificationCenter` | web | `apps/web/src/components/layout/notification-center.tsx` | Notifications panel | Yes | — |
| `Sidebar` | admin | `apps/admin/src/components/sidebar.tsx` | Admin nav rail (76px + section sheets) | Yes (`bg-tone-*`, ROLE_META tones); `RailMark` uses `/logo-mark.svg` | Role badge tones; permission-filtered nav |
| `Topbar` (+ `topbar-breadcrumb`) | admin | `apps/admin/src/components/topbar.tsx` | Sticky admin chrome (breadcrumb, search trigger, bell, identity) | Yes — `.adp-topbar` driven by `--au-*` | PWA install prompt logic embedded |
| `sub-nav` / `admin-page-header` / `ministat-strip` | admin | `apps/admin/src/components/{sub-nav,admin-page-header,ministat-strip}.tsx` | Page sub-nav / header / stat strip | Yes | — |
| `admin-navigation-fallback` | admin | `apps/admin/src/components/admin-navigation-fallback.tsx` | Nav fallback | Yes | — |
| `AuroraBackground` | admin | `apps/admin/src/components/aurora/aurora-background.tsx` | Ambient gradient bg | Yes (aurora) | Brand ambient |
| `public-page-shell` / `marketing-header` / `marketing-footer` / `marketing-mobile-nav` | web | `apps/web/src/components/marketing/*` | Marketing chrome | Yes (some glass) | — |
| `MoveCommandCenter` / `UpNext` / primitives | mobile | `apps/mobile/src/components/ui/MoveCommandCenter.tsx`, `UpNext.tsx`, `apps/mobile/src/components/move/primitives.tsx` | Home shell pieces (RN) | Yes; **rgba/hex** | — |

---

## 4. MARKETING components (web only)

All in `apps/web/src/components/marketing/`. Token-aware unless flagged. Heavy brand/visual surface.

| Component | File | Purpose | Theme/brand notes |
|---|---|---|---|
| `marketing-header` / `marketing-footer` / `marketing-mobile-nav` / `marketing-user-menu` | `marketing-*.tsx` | Marketing chrome | Token-aware; `landing-theme-toggle.tsx` for landing theme switch |
| `hero-move-animation` / `hero-phone-mock` / `hero-phone-showcase` / `mobile-mockup` / `moving-moment-mock` | `hero-*.tsx`, `mobile-mockup.tsx`, `moving-moment-mock.tsx` | Hero visuals & device mockups | Animation-heavy; verify hardcoded gradient stops [needs verification] |
| `pricing-section` / `plan-compare-table` / `workspace-plans-section` / `embedded-checkout-card` | `*.tsx` | Pricing & plans | Plan badges via `Badge` `individual/family/pro`; tested (`.test.tsx`) |
| `social-proof` / `hard-stats` / `recognition-chip-storm` / `testimonial-quote` / `bilingual-showcase` / `dossier-showcase` | `*.tsx` | Trust/marketing sections | — |
| `app-store-cta` / `app-store` badges | `app-store-cta.tsx` | Store CTAs | **hardcoded hex** (store badge brand colors — likely intentional) |
| `waitlist-form` / `early-access-capture` | `*.tsx` | Lead capture | Forms |
| `latest-blog-posts` | `latest-blog-posts.tsx` | Blog teasers | — |
| `logo` (`LogoMark`/`Wordmark`) | `logo.tsx` | Brand lockup | **Canonical brand mark** (see §1.8) |

---

## 5. FEATURE components (grouped, condensed)

| Group | App | Dir | Representative components | Theme/brand notes |
|---|---|---|---|---|
| Dashboard | web | `components/dashboard/` | `home-dossier`, `move-briefing-card`, `budget-donut`, `budget-widget`, `monthly-spark`, `milestone-timeline`, `route-map-card`, `stats-card`, `upcoming-bills`, `household-activation-card`, `dossier-ambient` | Token-aware; viz dup w/ admin aurora & mobile |
| Move / Moving | web | `components/moving/`, `movers/` | `movers-list`, `moving-quote-form`, `service-quote-form`, `plan-recommendations`, `vehicle-check`, `mover-apply-form`, `mover-portal-login` | Forms reuse `Input/Select/Button` |
| Onboarding | web | `components/onboarding/` | `ob-coach`, `ob-cta`, `ob-pro-showcase` | Mirrors mobile onboarding (`ob-coach-state` shared logic both sides) |
| Premium | web/admin | `components/premium/` | web: `foil-empty-state`, `premium-sticker`(hex), `reveal-modal`(hex); admin: `health-pill`, `tier-stamp`, `tier-medallion`(hex) | **Foil/Gold premium = brand-critical; several hardcode hex** |
| Settings | web | `components/settings/` | `appearance-card`, `ui-preferences-card`, `subscription-management`, `plan-change-section`, `cancel-survey-modal`, `delete-account-dialog` | `appearance-card`/`ui-preferences-card` are the theme-pref surfaces |
| Address | web/mobile | `components/address(es)/` | web: `address-autocomplete-input`; mobile: `address-autocomplete-field`, `AddressesMap`, `TransitRouteMap` | Autocomplete dup web↔mobile |
| Provider/Services | mobile | `components/provider/`, `services/` | `ProviderCard`, `RecommendedRow`, `CategoryChipRow`, `StateRulesCard`, `GovernmentSourceLinks`, `AffiliateCtaButton`, `ProviderReason` | RN; theme-aware; some rgba |
| Move home cards | mobile | `components/ui/` | `HomeDossierCard`, `HomeInsightCard`, `MoveBriefingCard`, `MoveTeaserCard`, `SavingsInsightsCard`, `VehicleCheckCard`, `FreeMoveUpsellCard`, `PlanHero`, `FirstRunHero`, `ServicesMoodBoard`, `DossierAmbient` | **Many use rgba/hex** (gradients, glass) — brand-rich home surface |
| Onboarding | mobile | `components/onboarding/` | `NotificationPrimingCard`, `ProShowcaseCard`, `onboarding-motion` | — |
| Consent/Legal | web/admin/mobile | various | web `shared/{cookie-consent,ccpa-opt-out-controls,cookie-preference-controls}`, `legal/legal-consent-panel`; mobile `legal/LegalConsentPanel` | Consent UI dup across apps |
| Upsell | web | `components/shared/` | `service-limit-upsell`, `upgrade-prompt`, `service-usage-indicator` | Plan-gating UI |
| Affiliate/Partners | web | `components/affiliate/`, `partners/` | `affiliate-cta-button`, `affiliate-disclosure`, `partner-apply-form`, `partner-portal-request-form` | — |
| Motion/Misc | mobile | `components/ui/` | `PressableScale`, `ListEntrance`, `CountUp`, `AnimatedSplash`, `ObCoach`, `RaccoonMascot/Walking` | Reanimated; reduced-motion aware |
| Admin widgets | admin | `components/` | `email-health-widget`, `spending-by-region-widget`, `backup-control-plane`, `coverage-editor`, `aurora/audit-feed`, `aurora/aurora-stat-card` | Dashboard widgets |

---

## 6. KEY FINDINGS for renewal

### 6.1 Components duplicated across apps (re-implemented per platform)
Each of these is a **separate implementation** that must be re-themed in N places:

| Primitive | web | admin | mobile |
|---|---|---|---|
| Button | `ui/button.tsx` | inline classes (no component) | `ui/Button.tsx` |
| Input / Password | `ui/input.tsx`, `ui/password-input.tsx` | inline | `ui/Input.tsx` |
| Card / surface | `ui/card.tsx` | `admin-panel.tsx` | `ui/Card.tsx` |
| Badge | `ui/badge.tsx` | `premium/*` pills | `ui/Badge.tsx` |
| Skeleton | `ui/skeleton.tsx` | inline `Loader2` | `ui/Skeleton.tsx` |
| EmptyState | `shared/empty-state.tsx` | `empty-state.tsx` | `ui/EmptyState.tsx` |
| ConfirmDialog | `shared/confirm-dialog.tsx` | `confirm-dialog.tsx` | (none) |
| CategoryIcon | `ui/category-icon.tsx` | — | `ui/CategoryIcon.tsx` |
| ServiceLogoMark | `services/service-logo-mark.tsx` | — | `services/ServiceLogoMark.tsx` |
| ThemeToggle | `theme-toggle.tsx` | `theme-toggle.tsx` | `ui/ThemeSelector.tsx` |
| LanguageSelector | `language-selector.tsx` | `language-selector.tsx` | `ui/LanguageSelector.tsx` |
| Logo/Wordmark | `marketing/logo.tsx` | reuses `/logo-mark.svg` | `ui/LogoBrand.tsx` |
| Raccoon mascot | `illustrations/Raccoon*` | — | `ui/Raccoon*` |
| Dashboard viz (donut/sparkline/ring) | `dashboard/*` | `aurora/*` | `ui/*` |

### 6.2 Components with hardcoded colors (re-theme blockers)
- **web:** `ui/badge.tsx` (`text-[#0A0F18]` proSolid ink), `layout/impersonation-banner.tsx`, `marketing/app-store-cta.tsx`, `premium/premium-sticker.tsx`, `premium/reveal-modal.tsx`, `shared/install-prompt.tsx`, `illustrations/RaccoonMark.tsx`, `language-selector.tsx`.
- **admin:** `premium/tier-medallion.tsx` (SVG hex `#fff`, `#DDE7F5` gradient stops) — likely intentional.
- **mobile:** **pervasive** `rgba()`/hex in `ui/Button.tsx` (`#fff`, coral/white overlays), `Input.tsx` (`rgba(226,92,92,...)` error), `Badge.tsx`, and ~15 rich home/brand cards (`HomeDossierCard`, `MoveCommandCenter`, `PlanHero`, `GradientProgress`, `FirstRunHero`, `ServicesMoodBoard`, etc.). Many are **intentional achromatic overlays** (white/black at alpha) and **brand gradient stops** rather than themeable surface colors — but they are NOT token-driven and will need audit per-file during renewal.

> Also note semantic brand coral `#E25C5C` is hardcoded as `rgba(226,92,92,*)` in multiple mobile files instead of referencing `theme.colors.error` — a sync hazard.

### 6.3 Missing / inconsistent shared primitives
- **No shared `Table` primitive** (admin `DataTablePage` is a page shell, not a reusable table; web/mobile have none).
- **No shared `Tabs` primitive** anywhere.
- **No generic `DropdownMenu`/`Menu` primitive** — web uses native `<select>` + inline menus; admin rolls bespoke menus.
- **No standalone `Spinner` primitive** — `Loader2`/`ActivityIndicator` used inline; web `LoadingSpinner` hardcodes `text-tone-orange-fg`.
- **No shared `Tooltip`** (only admin `InfoHint`).
- **No shared `Toast`** — three systems: admin `sonner`, mobile `SuccessToast`, web inline.
- **No web/admin `ErrorState`** component (only mobile has one); web error UI is inline.
- **No admin `Button` component** — button class strings copy-pasted across admin modals.
- **`StatusBadge`** (WCAG-safe, web only) is a model worth promoting to admin + mobile.

### 6.4 Token drift hazard (highest renewal risk)
`packages/shared/src/design-tokens.ts` is the canonical source but **only mobile consumes it at runtime**.
Web `globals.css` and admin `aurora.css`/`globals.css` hold **manually-synced copies** of the same hex
values. A theme renewal must update **three independent token surfaces** (mobile JS theme, web CSS vars,
admin `--au-*`/`tone-*` vars) and keep them in sync — there is no single build-time pipeline. Legacy
alias names (`brand.orange`, `roseScale`, `foilScale`, `tone-orange-*`) still resolve to the new
Gold/Sapphire values, so class names lie about their color (e.g. `tone-orange-fg` is actually Gold).

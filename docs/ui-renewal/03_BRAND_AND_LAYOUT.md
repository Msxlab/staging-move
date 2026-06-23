# 03 — Brand & Global Layout / Navigation

Theme-renewal inventory of brand assets and global layout/navigation shells across the three LocateFlow surfaces: **web** (consumer app + marketing), **admin**, **mobile** (Expo/RN). Captures what EXISTS — files, structure, theme handling, hardcoded values, brand usage. No redesign proposals here.

Repo root: `C:/Users/Windows/Desktop/Staging/staging-move`
All paths below are relative to root unless noted. Marked `[needs verification]` where not directly confirmed.

---

## 0. TL;DR — highest-signal facts for a reskin

| # | Fact | Evidence |
|---|------|----------|
| 1 | **Brand mark is a raccoon mascot** drawn as inline SVG (face + ears + eyes + striped tail), NOT a generic logo. ~Identical geometry across web/admin/mobile. | `apps/web/public/logo-mark.svg`, `apps/admin/public/logo-mark.svg`, `apps/mobile/assets/icon.svg` |
| 2 | **Eye color is the only per-app divergence in the mark:** web/mobile use gold/foil `#CBA45E`; admin uses Sapphire `#2E5FB0`. | `diff` web vs admin `logo-mark.svg` (lines 16/19 only) |
| 3 | **`--brand-orange` token is misnamed — it is GOLD `#CBA45E`, not orange.** Many layout accents reference "orange" tone tokens that resolve to gold/foil. | `apps/web/src/styles/globals.css:42` |
| 4 | **OG image route still renders a leftover "M" glyph** (legacy "Move" wordmark) inside the logo tile instead of the raccoon/"L". | `apps/web/src/app/opengraph-image.tsx:46` |
| 5 | **Two parallel font systems loaded simultaneously** ("legacy" Geist+Fraunces and "canonical" Playfair+DM Sans+DM Mono). Migration in progress; both ship to every page. | `apps/web/src/app/layout.tsx:27-80`, `apps/mobile/app/_layout.tsx:483-511` |
| 6 | **Wordmark casing/style is inconsistent:** marketing = `LocateFlow` Playfair 900; app sidebar = `Locate` + italic foil `flow`; footer = `LocateFlow` font-display bold; admin = `LocateFlow` + mono "OPERATIONS" kicker. | see §1 |
| 7 | **Three distinct shells, three distinct nav idioms:** web app = left sidebar + topbar + bottom mobile tab bar; admin = 76px icon-rail + contextual panel + mobile dock/sheet; mobile = 5-tab bottom bar + stack. No shared nav primitive. | see §2–3 |
| 8 | Theming: web/admin = CSS variables on `:root`/`.dark` via `next-themes` (`ThemeProvider`, system/light/dark). Mobile = JS theme object via `useAppTheme()`/`useThemePreference()`, NativeWind global.css. | see §6 |
| 9 | Marketing `<header>` & app `<Header>` are SEPARATE components; movers/partners portals have **no shared shell** at all (bare `<header>` per page). | `apps/web/src/components/marketing/marketing-header.tsx`, `.../layout/header.tsx`, `apps/web/src/app/movers/portal/page.tsx:27` |

---

## 1. Logo / Wordmark / Icon usage per app

### 1.1 Brand asset files

| Asset | Web (`apps/web/public/`) | Admin (`apps/admin/public/`) | Mobile (`apps/mobile/assets/`) |
|-------|--------------------------|------------------------------|--------------------------------|
| Raccoon mark (SVG) | `logo-mark.svg` (gold eyes), `favicon.svg`, `favicon-small.svg` (16/32 face-only), `app-icon.svg` | `logo-mark.svg` (**Sapphire eyes**), `favicon.svg` | `icon.svg`, `icon.png`, `adaptive-icon.png`, `favicon.png`, `notification-icon.png`, `splash-icon.png` |
| Wordmark lockup (SVG) | `logo.svg` (viewBox 320×72: mark + "LocateFlow" text) | `logo.svg` | — (uses PNG icon only, no SVG wordmark) |
| Favicon (raster) | `favicon.ico` | — (icon.svg only) | `favicon.png` (Expo web) |
| PWA / app icons | `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon.svg` | `icon-192.png`, `icon-512.png` | `icon.png`, `adaptive-icon.png` (bg `#070B14`) |
| OG image | `og-image.svg` (static) **+** `src/app/opengraph-image.tsx` (dynamic edge, **has "M" glyph bug**) | `og-image.svg` | n/a |
| Mask icon | `logo-mark.svg` (`color="#CBA45E"`) | — | — |

**Mark geometry** (`logo-mark.svg`): rounded-rect tile `#07101F` (rx 15, 64×64), raccoon = grey body `#8C9AB2`, mauve inner-ear `#C4A090`, dark mask patches `#0C1525`, **eyes = `#CBA45E` (web) / `#2E5FB0` (admin)**. Striped tail forms the left/right triangular ears.

### 1.2 Logo component & where rendered (web)

`apps/web/src/components/marketing/logo.tsx` exports:
- **`LogoMark`** — `<img src="/logo-mark.svg">`, size-prop, `aria-hidden`. NOTE: declares `animated?` prop but **ignores it** (no animation). Shared by sidebar, footer.
- **`Wordmark`** — `LogoMark` + `<span>LocateFlow</span>` styled `font-display`/Playfair `fontWeight:900`, 22px. Links to `/`.

| Render site | Component | Style notes |
|-------------|-----------|-------------|
| Marketing header | `Wordmark` (markSize default 34) | `apps/web/src/components/marketing/marketing-header.tsx:33` |
| Marketing footer | `LogoMark` size=24 + `<span class="font-display text-lg font-bold">LocateFlow` | `marketing-footer.tsx:22-23` |
| App sidebar (logged-in) | `LogoMark` size=32 + `Locate`+`<span class="italic foil-text">flow</span>` | `apps/web/src/components/layout/sidebar.tsx:172-177` — **different wordmark treatment than marketing** |
| Onboarding header | `Wordmark` | `apps/web/src/app/onboarding/layout.tsx:3` |
| OG (dynamic) | inline gold gradient tile + **"M" letter** + "LocateFlow" | `opengraph-image.tsx:34-57` — **leftover glyph bug** |

### 1.3 Logo usage (admin)

- **`RailMark`** (`apps/admin/src/components/sidebar.tsx:47-51`): `<img src="/logo-mark.svg">` 36×36, used in 76px rail AND contextual-panel header.
- Panel header wordmark: `font-display text-[19px] font-black "LocateFlow"` + mono kicker `OPERATIONS` (uppercase, tracking 0.22em, `text-primary`). `sidebar.tsx:330-337`.
- No wordmark on admin login page header `[needs verification — login page header not read]`.

### 1.4 Logo usage (mobile)

- **`LogoBrand`** (`apps/mobile/src/components/ui/LogoBrand.tsx`): renders `assets/icon.png` (raccoon) as `<Image>`, sizes sm36/md72/lg96, gold shadow `#CBA45E`. **No text wordmark.**
- Rendered in `AnimatedSplash` (`apps/mobile/src/components/AnimatedSplash.tsx:97`, `size="lg"`).
- Auth screens use `AppleLogoMark`/`GoogleGMark` (third-party SSO marks) from `components/ui/BrandLogos`, not the LocateFlow mark. `apps/mobile/app/(auth)/sign-in.tsx:13`.
- Notification icon: `assets/notification-icon.png`, accent color `#2E5FB0` (Sapphire) — `app.json:150-152`.

### 1.5 Favicon / app-icon / OG metadata declarations

| Surface | Theme-color / status bar | Icons declared | Source |
|---------|--------------------------|----------------|--------|
| Web | `<meta theme-color="#0A0F18">`; apple status-bar black-translucent; apple-title "LocateFlow" | manifest.json, favicon.ico (any), favicon.svg, favicon-small.svg (16/32), apple-touch `/icons/icon-192.png`, mask-icon `/logo-mark.svg` color `#CBA45E` | `apps/web/src/app/layout.tsx:179-208` |
| Admin | viewport `themeColor:"#171E2B"`, colorScheme `dark light` | `icon:/icon.svg`, shortcut `/icon.svg`, apple `/icon-192.png`; manifest.json | `apps/admin/src/app/layout.tsx:57-70` |
| Mobile | splash bg `#070B14` (light+dark), android adaptiveIcon bg `#070B14`, notification color `#2E5FB0` | `icon.png` (ios+android), `adaptive-icon.png`, web favicon `favicon.png` | `apps/mobile/app.json:7,73-76,128-153` |

**Brand color constants seen hardcoded** (theme-renewal will need to consolidate): `#0A0F18`, `#070B14`, `#07101F`, `#121B2D`, `#171E2B` (navy surfaces); `#CBA45E` / `#DCBC7C` / `#B0852F` (gold/foil triplet); `#2E5FB0` (Sapphire primary); `#EFF3FA` (ink).

---

## 2. Global shells — structure

### 2.1 Web — root layout (`apps/web/src/app/layout.tsx`)
- `<html>` carries 6 font CSS-var classes; `<body class="dmSans lf-aurora">`.
- Providers: `NextIntlClientProvider` → `QueryProvider` → `ThemeProvider` (next-themes, nonce) → children + `Toaster` (sonner, top-right, richColors) + `CookieConsent`.
- Pre-paint inline script latches `?embed=mobile` → `data-embed` (chromeless in-app browser mode). `register-sw.js` deferred.
- Global CSS: `@/styles/globals.css` + `@/styles/aurora.css`.

### 2.2 Web — authenticated app shell (`AppShell`)
File `apps/web/src/components/layout/app-shell.tsx`. Wraps `(app)/*` routes via `(app)/layout.tsx`.

```
<div flex min-h-screen> (style background:var(--surface); planClass: plan-pro|plan-family|plan-free)
  .app-shell-backdrop (fixed inset-0, decorative)
  skip-link (focus → #main-content; bg-brand-orange)
  <Sidebar>  (desktop sticky w-60 / collapsed w-[68px])
  [mobile overlay Sidebar variant="mobile" w-72]
  <div flex-1>
    <ImpersonationBanner>
    <Header onMenuClick>
    <main #main-content p-4 md:p-6 pb-20 md:pb-6>
      <div mx-auto w-full max-w-screen-2xl>
        <PendingInvitationsBanner>
        {children}
    <MobileNav>   (fixed bottom tab bar, md:hidden)
  <InstallPrompt>
```
- **Embed mode** strips all chrome → bare `<main p-4>` with `max-w-screen-md`.
- `planTier` → class hook only; comment notes "colors remain Sapphire" (plan tiers no longer recolor). `app-shell.tsx:18,68-72`.

### 2.3 Web — marketing shell
No single layout component; composed per page. Two patterns:
- **Direct** (homepage etc.): `<MarketingHeader>` … `container` sections … `<MarketingFooter>`. `apps/web/src/app/page.tsx:198-...`.
- **`PublicPageShell`** (legal/info pages): header + hero (eyebrow/title/desc) + `container max-w-6xl py-14 lg:py-20` + footer; `PublicSection` = rounded-[22px] bordered card. `apps/web/src/components/marketing/public-page-shell.tsx`.
- **Marketing header** (`marketing-header.tsx`): `sticky top-0 z-50 border-b bg-background/95 backdrop-blur`, `container h-16`, `Wordmark` + desktop `<nav hidden lg:flex>` + `MarketingMobileNav` + LanguageSelector + LandingThemeToggle + auth CTAs/`MarketingUserMenu`.
- **Marketing footer** (`marketing-footer.tsx`): `border-t bg-card py-12`, `container`, 4-col grid (brand / Product / Privacy-Terms / Help) + bottom bar (copyright + lang + theme toggle).
- **Movers/Partners portals** (`/movers/portal/*`, `/partners/portal/*`): **NO shared shell** — each page renders its own bare `<header class="mb-8 text-center">`. `apps/web/src/app/movers/portal/page.tsx:27`.

### 2.4 Admin shell (`apps/admin/src/app/(admin)/layout.tsx`)
```
<div .adm-aurora flex min-h-screen bg-background text-foreground>
  <AuroraBackground>  (animated northern-lights, prefers-reduced-motion aware)
  skip-link (#admin-main)
  <Sidebar ctx={role,permissions,email}>  (76px icon-rail + 180px panel = w-64)
  <CommandPalette>  (⌘K / Ctrl+K)
  <main #admin-main lg:pl-64 pb-24 lg:pb-0>
    <Topbar>  (.adp-topbar sticky: breadcrumb + search trigger + bell/help/identity)
    <div .admin-workspace> <div .admin-workspace-inner>
      <SubNav>  (section tab bar)
      {children}
```
- Root layout adds `AdminNavigationFallback`, `ThemeProvider`, `Toaster`. `bg-background font-sans`.

### 2.5 Mobile shell (`apps/mobile/app/_layout.tsx`)
- `RootLayout`: holds native + animated splash until fonts (20 faces) + i18n ready; bg held `#0A0F18`. Providers: `ErrorBoundary` → `ThemeProvider` → `QueryClientProvider` → `AuthGuard` → `RootNavigator`.
- `RootNavigator`: `expo-router` `<Stack headerShown:false contentStyle bg=colors.background>`; remounts on `resolvedScheme` change (`key`); push `slide_from_right` 220ms, container swaps `fade`, onboarding `slide_from_bottom`; all `none` under reduce-motion. Screens: `(auth)`, `(tabs)`, `onboarding`, `setup-password`.
- `(auth)/_layout.tsx`: Stack, headerless, `fade`, `contentStyle bg=colors.background`.
- `(tabs)/_layout.tsx`: 5-tab bottom bar (see §3).

---

## 3. Navigation maps (primary nav per surface)

### 3.1 Web — marketing nav (`marketing-header.tsx:15-22`)
`Features → Why free → Pricing → Help → Blog → FAQ`. Mobile: same links in `MarketingMobileNav` sheet + auth CTAs. Labels hardcoded English (not i18n keys here).

### 3.2 Web — app sidebar (`layout/sidebar.tsx`) — i18n keys `nav.*`
| Group | Items (key → href, lucide icon) |
|-------|----------------------------------|
| Workspace | dashboard `/dashboard` Home · addresses `/addresses` MapPin · services `/services` Zap · providers `/providers` Building2 · *budget* `/budget` DollarSign (if showBudget) · moving `/moving` Truck · *workspace* `/settings/workspace` Users (if showWorkspace) |
| Account | notifications `/notifications` Bell (unread badge) · support `/support` LifeBuoy · help `/help` HelpCircle · settings `/settings` Settings |
| Footer | Pro upsell card (`/pricing`, hidden if consumerFree / plan-pro) + collapse toggle |

Active = `bg-tone-orange-bg text-tone-orange-fg` (gold tone). Collapsible w-60↔w-[68px]; mobile = overlay drawer w-72.

### 3.3 Web — bottom mobile tab bar (`layout/mobile-nav.tsx`, md:hidden)
`dashboard Home · addresses MapPin · moving Truck · services Zap · settings Settings` — fixed bottom-3, rounded-2xl, blur, gold active tone. (5 items; subset of sidebar.)

### 3.4 Web — app topbar (`layout/header.tsx`)
GlobalSearch · NotificationCenter (bell dropdown w-80/96) · ThemeToggle (system→light→dark) · LanguageSelector · user-menu (avatar initials → Dashboard / Settings / Edit profile / Sign out).

### 3.5 Admin nav (`apps/admin/src/lib/admin-nav.ts`) — single source for sidebar + ⌘K
| Rail group (icon, railLabel) | Items (href) |
|------------------------------|--------------|
| Core (LayoutDashboard, "Core") | Dashboard `/` · Users `/users` · Subscriptions `/subscriptions` · Plans `/plans` · Workspaces `/workspaces` · Acquisition Campaigns `/acquisition-campaigns` · Analytics `/analytics` · Insights `/insights` |
| Content (Building2, "Content") | Providers `/providers` · Provider Quality `/provider-quality` · Movers `/movers` · Mover Applications `/movers/applications` · Partner Applications `/partners` · Sponsored `/sponsored` · Affiliate `/affiliate` · Leads `/leads` · State Rules `/state-rules` · Moving Plans `/moving` |
| Communication (Bell, "Comms") | Support `/support` · Notifications `/notifications` · Help Center `/help-center` · Blog `/blog` · Waitlist `/waitlist` |
| System (Cog, "System") | Feature Flags `/feature-flags` · Runtime Config `/runtime-config` · Connectors `/connectors` · Connector Metrics `/connector-metrics` · Connector Fallbacks `/connector-fallbacks` · Security `/security` · Audit Logs `/logs` · Admin Team `/team` · Settings `/settings` (pinned to footer) |
- Role/permission `show()` gates each item. Active item: `bg-primary/10 text-primary` + left 3px bar.
- **SubNav clusters** (`sub-nav.tsx`) surface sub-pages removed from sidebar: Subscriptions(billing), Providers(coverage/governance/needs-logo), Analytics(reports/intelligence), Communication(email-templates), Security(sessions), Logs(activity), Settings(health/two-factor/backups/runtime-config).
- Mobile: dock (group icons) + bottom-sheet of group sub-pages (`sidebar.tsx:383-464`).
- Quick actions (⌘K only): New provider `/providers/new`, New blog post `/blog/new`.

### 3.6 Mobile — bottom tab bar (`(tabs)/_layout.tsx`) — i18n `tabs.*`
`dashboard (index) LayoutDashboard · addresses MapPin · moving Truck · services Zap · more Menu`. Active tint `theme.colors.primary`; inactive `theme.colors.faint`; bar bg `colors.bg2`, height iOS 84 / Android 66.
- **`more` tab** (`(tabs)/more.tsx`) is the overflow menu: Search, Budget, Providers, Custom providers, Reminders | Profile, Subscription, Workspace, Connections, Notification settings | Privacy, Export, Address changes | Help, Support, Notifications, Blog. Plus plan pill, theme + language selectors, sign-out, build info.

---

## 4. Spacing / grid / container system

| Surface | Container | Notes |
|---------|-----------|-------|
| Web (Tailwind 3.4) | `container { center:true; padding:2rem; screens:{ "2xl":"1400px" } }` | `apps/web/tailwind.config.*:9-15`. Marketing uses `.container` (+ per-section `max-w-6xl`); legal pages `max-w-6xl`. |
| Web app main | `mx-auto w-full max-w-screen-2xl`, main padding `p-4 md:p-6 pb-20 md:pb-6` | `app-shell.tsx:138-140` |
| Web sidebar | desktop w-60 / collapsed w-[68px]; mobile drawer w-72; header/sidebar-logo row `h-14` | `sidebar.tsx` |
| Admin | identical `container` config (center, 2rem, 2xl:1400px); sidebar fixed w-64 (76px rail + panel); main `lg:pl-64`; topbar h-16 | `apps/admin/tailwind.config.*:9-15`, `(admin)/layout.tsx:49` |
| Admin workspace | `.admin-workspace` + `.admin-workspace-inner` (max-width centering + section padding) | defined in `aurora.css` `[needs verification — CSS not read here]` |
| Mobile | per-screen `StyleSheet`; tab bar height iOS 84 / Android 66, paddingTop 8; cards via `@/components/move` (HeroCard/SectionHeader) | `(tabs)/_layout.tsx:102-140` |

Common radii seen: `rounded-xl` (nav rows), `rounded-2xl` (mobile nav, cards), `rounded-[22px]` (public sections). Icon sizes: web nav 18px, mobile tab 20px, admin nav 17px.

---

## 5. Typography / fonts (load-bearing for reskin)

| Surface | "Canonical" (active) | "Legacy" (still loaded) | Mapping |
|---------|----------------------|--------------------------|---------|
| Web | Playfair Display (`--font-display`), DM Sans (`--font-dm-sans`, body), DM Mono (`--font-dm-mono`) | Geist, Geist Mono, Fraunces (opsz/SOFT axes) | `--font-display/sans/mono` repointed in globals.css; `<body class=dmSans>`. `layout.tsx:27-80` |
| Admin | Playfair (`--font-display`), DM Sans (`--font-sans`), DM Mono (`--font-mono`) | — (admin loads only the 3 canonical) | `layout.tsx:15-38` |
| Mobile | Playfair (600/700/800/900 + italic), DM Sans (400-700), DM Mono | Fraunces (400/500/600 + italic), Geist, Geist Mono | all 20 faces loaded on boot; `fonts.*` in `@/lib/theme`. `_layout.tsx:19-46,489-511` |

Display/serif (Playfair) = wordmark, hero numerals, section titles. DM Sans = UI body. DM Mono = numerals/meta, mono kickers (e.g. admin "OPERATIONS", sidebar group labels `font-mono uppercase tracking-[0.16em]`).

---

## 6. Theme handling per surface

| Surface | Mechanism | Modes | Tokens |
|---------|-----------|-------|--------|
| Web | `next-themes` `<ThemeProvider nonce>`; `ThemeToggle` 3-state system→light→dark; `LandingThemeToggle` for marketing | system / light / dark | CSS vars on `:root`/`.dark` in `globals.css`; surfaces via `var(--surface)`, `var(--surface-secondary)`, `var(--glass-border)`; tone tokens `tone-orange/sky/sage/slate/foil-bg/-fg/-br` |
| Admin | `next-themes` ThemeProvider; `--au-*` token system (slate light / aurora dark) | system / light / dark | `bg-background text-foreground text-primary` (Sapphire); aurora.css drives `.adp-*` chrome |
| Mobile | custom `ThemeProvider` + `useThemePreference()` / `useAppTheme()`; drives StatusBar, SystemUI bg, Stack remount on scheme change; NativeWind 4 `global.css` | automatic (`userInterfaceStyle:"automatic"`) → light/dark | JS `theme.colors.{background,bg2,primary,faint,border,...}`; ThemeSelector in `more` tab |

Plan-tier theming: **deprecated** on web — `plan-pro/family/free` classes are now "Sapphire pass-throughs" (no recolor). `app-shell.tsx:18,68`.

---

## 7. Consistency gaps across the three apps

| Gap | Detail | Files |
|-----|--------|-------|
| **OG "M" glyph** | Dynamic OG route renders letter "M" (legacy "Move" brand) in logo tile, not raccoon/"L" / "LocateFlow". | `apps/web/src/app/opengraph-image.tsx:46` |
| **Misnamed token** | `--brand-orange` = `#CBA45E` (gold), not orange; `tone-orange-*` active states are gold. Renamer risk during reskin. | `globals.css:42`; sidebar/mobile-nav active states |
| **Eye-color split** | Admin raccoon eyes Sapphire `#2E5FB0`; web/mobile eyes gold `#CBA45E`. Same SVG otherwise. | `logo-mark.svg` web vs admin |
| **Wordmark treatments differ** | Marketing `LocateFlow` Playfair-900; app sidebar `Locate`+italic-foil `flow`; footer `LocateFlow` font-display-bold; admin `LocateFlow`+mono "OPERATIONS". No single wordmark component reused across all. | §1.2–1.3 |
| **Mobile has no text wordmark** | Only PNG raccoon icon (`LogoBrand`); auth screens show only Apple/Google SSO marks. | `LogoBrand.tsx`, `sign-in.tsx:13` |
| **Two font systems shipped** | Geist/Fraunces still loaded alongside Playfair/DM on every web + mobile boot (perf + cleanup debt). | `layout.tsx:27-52`, `_layout.tsx:19-46` |
| **`LogoMark.animated` prop dead** | Accepted but unused; callers pass `animated={false}`/`true` with no effect. | `logo.tsx:6-13` |
| **Theme-color values diverge** | Web `#0A0F18`, admin `#171E2B`, mobile splash/adaptive `#070B14`, OG gradient `#070B14→#18233A`. Four "navy" values, no shared token. | layouts + app.json + OG |
| **Nav idioms unshared** | 3 different nav systems (web sidebar+tabbar, admin rail+dock, mobile tabbar); web marketing nav is a 4th, hardcoded-English list. | §3 |
| **Portals shell-less** | Movers/Partners portals have no MarketingHeader/AppShell; bare per-page `<header>`. Inconsistent chrome vs rest of web. | `movers/portal/page.tsx:27` |
| **App active-tone vs admin active-tone** | Web app nav active = gold (`tone-orange`); admin nav active = Sapphire (`primary`). Different accent language between consumer app and admin. | sidebar.tsx (web) vs sidebar.tsx (admin) |

---

## Appendix — primary files read

Web: `app/layout.tsx`, `app/(app)/layout.tsx`, `app/onboarding/layout.tsx`, `components/layout/{app-shell,header,sidebar,mobile-nav,notification-center}.tsx`, `components/marketing/{logo,marketing-header,marketing-footer,public-page-shell}.tsx`, `app/opengraph-image.tsx`, `tailwind.config.*`, `styles/globals.css` (tokens), public assets.
Admin: `app/layout.tsx`, `app/(admin)/layout.tsx`, `components/{sidebar,topbar,sub-nav}.tsx`, `lib/admin-nav.ts`, `tailwind.config.*`, public assets.
Mobile: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(tabs)/more.tsx`, `src/components/ui/LogoBrand.tsx`, `app.json`, `app.config.js`, assets.

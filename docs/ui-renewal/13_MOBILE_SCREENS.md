# 13 — Mobile Screens Inventory (Expo / React Native)

App: `apps/mobile` — Expo Router (file-based routing) + NativeWind 4 (Tailwind) **and** RN `StyleSheet`.
Scope: **all 54 entries** from `docs/audit/_inventory/mobile-screens.txt`. One row per entry.

---

## Shared infrastructure (read this first — it explains every "tokens? Y" cell)

| Concern | How it works | Source |
|---|---|---|
| **Theme system** | `ThemeProvider` (Context) exposes `preference` (`system`/`light`/`dark`, **default `dark`**) + `resolvedScheme`. Hooks: `useAppTheme()` (active `Theme`), `useThemePreference()`, `useThemedStyles(makeStyles)` / `useMemo(()=>makeStyles(theme),[theme])`. `StyleSheet.create` is captured once, so every reskinned screen re-runs a `makeStyles(theme)` factory to flip light/dark live. Static `theme`/`lightTheme` exports also exist (back-compat, dark-only until reload). | `apps/mobile/src/lib/theme.ts` |
| **Token source of truth** | Palettes consume `@locateflow/shared` (`packages/shared/src/design-tokens.ts`): `brandColors`, `surfaceDark/Light`, `textDark/Light`, `borderDark/Light`, `tonesDark/Light`, `semanticColors`, `gradients`, `roseScale`, `spacing`, `radii`, `shadowsMobile`. Color object also carries many **back-compat aliases** (`bg2`, `surface2/3`, `dim`, `faint`, `onAccent`, `accentSoft`, `green/red/teal`, `track`, `handle`, `heroGrad`, `mapBg`, `raccoon{}`). | `theme.ts` lines 5–238 |
| **Accent** | Dark = `brandColors.rose` (Gold/rose accent); Light = `roseScale[500]`. `tabBarActiveTintColor` = `colors.primary`; inactive = `colors.faint`. | `theme.ts`, `(tabs)/_layout.tsx` |
| **Fonts** | Playfair Display (serif/display + wordmark), DM Sans (UI), DM Mono (numerals/meta). Legacy Fraunces + Geist still loaded during reskin transition. Constants in `fonts` (`serif*`, `sans*`, `mono*`). Loaded on boot in `app/_layout.tsx`; splash held until fonts + i18n resolve. | `app/_layout.tsx` 19–46, 489–511; `theme.ts` 267–279 |
| **Root shell** | `RootLayout` → `ErrorBoundary` → `ThemeProvider` → `QueryClientProvider` → `AuthGuard` → `RootNavigator` (`<Stack headerShown:false>` keyed on `resolvedScheme` to force remount on theme flip). `StatusBar` + `SystemUI.setBackgroundColorAsync` follow theme. Animations: push `slide_from_right` 220ms, container swap `fade`, onboarding `slide_from_bottom`, all `none` under reduce-motion. | `app/_layout.tsx` 413–542 |
| **Screen shell convention** | Most screens: `SafeAreaView` + `ScrollView` (forms add `KeyboardAvoidingView`; lists use `FlatList`). Per-screen styles via `makeStyles(theme)`. | per-screen |
| **`move/primitives` (in almost every screen)** | Shared composables faithful to the "Move.dc.html" design: `SectionHeader` (uppercase 10px tracked label + optional "All →"), `MoveCard` (navy/white surface, hairline border, radius 20), gradient progress, tonal status pills, hero gradient. **All theme-aware.** | `src/components/move/primitives.tsx` |
| **Shared state components (all theme-aware, i18n)** | `LoadingScreen`/`LoadingOverlay` (ActivityIndicator `colors.primary`), `ErrorState` (AlertTriangle + retry Button), `EmptyState` (raccoon **mascot** `MoveRaccoon` or icon disc + CTA), `Skeleton`, `OfflineChip`, `SuccessToast`. | `src/components/ui/*` |
| **Brand / logo** | **Raccoon mascot** is the identity: `LogoBrand` renders `assets/icon.png` (sm/md/lg); `MoveRaccoon`/`RaccoonMascot`/`RaccoonWalking` SVG moods; `AnimatedSplash`. Wordmark = "Move" in Playfair. OAuth marks: `BrandLogos` (`GoogleGMark` 4-color per Google guidelines, `AppleLogoMark`) — **brand-mandated colors, do not retheme.** | `LogoBrand.tsx`, `BrandLogos.tsx`, `move/MoveRaccoon.tsx` |
| **Responsive** | Phone-first RN; layout via flex + `Dimensions`/percentage widths, not breakpoints. `Platform.OS` branches (e.g. tab bar height iOS 84 / Android 66; OAuth button styling). No tablet-specific layouts found. **[needs verification - runtime]** for landscape/large-screen behavior. |

### Hardcoded-color hotspots (the only meaningful theme-renewal debt)
| Pattern | Where | Note |
|---|---|---|
| `CATEGORY_COLORS` hex map (`#E25C5C`, `#CBA45E`, `#54CB7E`, `#F0A0B8`, `#B0852F`, `#6E7C92`) | **duplicated** in `(tabs)/services.tsx` 84–86, `services/[id].tsx` 56–58, `services/[id]/edit.tsx` 45–54 | Per-category accent colors NOT from tokens; same map copied 3×. **Renewal: extract to shared tokens.** |
| `#fff` / `#000` on filled accents & checkmarks | `services.tsx` 953–954, `moving/[id].tsx` 947/1351/1658, `onboarding.tsx` 1609/2312/2366 | "on-accent" white; should use `colors.onAccent`. |
| OAuth button colors `#fff`/`#000`/`#14202F` | `(auth)/sign-up.tsx` 486–499, `sign-in.tsx` | Google/Apple brand buttons — **keep brand-mandated.** |
| Mascot/raccoon hex | `theme.ts` `raccoon{}`, `MoveRaccoon` | Illustration palette, intentional. |

---

## Auth group — `(auth)/*`

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme (tokens? hex? L+D?) | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `(auth)` layout | `(auth)/_layout.tsx` | `Stack` (no header) | nav container only | move primitives | Y; no hex; L+D | n/a | — | — | Pure navigator; nothing visual to preserve. |
| Forgot password | `(auth)/forgot-password.tsx` | KAV + ScrollView | wordmark, email form, submit, back link | `ui/Button`, `ui/Input`, move | Y; **0 hex**; L+D | KAV for keyboard | "Move" wordmark | submit pending (Button) | Clean reference for form theming. |
| Sign in | `(auth)/sign-in.tsx` | KAV + ScrollView | hero/wordmark, email+password, OAuth (Google/Apple), forgot/sign-up links | `ui/Button`, `ui/Input`, `ui/BrandLogos`, move | Y; **3 hex** (OAuth brand) | KAV; `Platform` OAuth styling | wordmark + `BrandLogos` | submit pending, inline error alerts | Preserve OAuth brand marks; route OAuth via WebBrowser handoff. |
| Sign up | `(auth)/sign-up.tsx` | KAV + ScrollView | wordmark, register form, OAuth, **LegalConsentPanel** | `ui/Button`, `ui/Input`, `ui/BrandLogos`, `legal/LegalConsentPanel`, move | Y; **5 hex** (OAuth `#fff/#000/#14202F`) 486–499 | KAV; `Platform` OAuth | wordmark + `BrandLogos` | submit pending, validation errors | Legal consent block must persist; OAuth colors brand-mandated. |

## Tabs group — `(tabs)/*`

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Tabs layout | `(tabs)/_layout.tsx` | `Tabs` w/ custom `TabBarBackground` | 5 tabs (Dashboard/Addresses/Moving/Services/More), lucide icons | `makeStyles(theme)` | Y; **1 hex** (`shadowColor:"#000"`) | `Platform` height iOS 84/Android 66 | tab icons only | — | bg `bg2`, hairline top border, active=`primary`/inactive=`faint`. |
| Dashboard (index) | `(tabs)/index.tsx` | SafeArea + ScrollView + **Modal** | hero/briefing, dossier cards, insight cards, command center, up-next, savings, count-up stats | move, `ui/Card`, `ui/MoveBriefingCard`, `HomeDossierCard`, `HomeInsightCard`, `MoveCommandCenter`, `UpNext`, `SavingsInsightsCard`, `OfflineChip`, `ErrorState`, `Skeleton`, `CountUp`, `CategoryIcon` | Y; **1 hex**; L+D | flex/ScrollView; RefreshControl | wordmark, raccoon via cards | Skeleton (load), ErrorState, RefreshControl, offline chip | **2328 lines** — heaviest screen; densest card composition; main reskin target. |
| Addresses tab | `(tabs)/addresses.tsx` | SafeArea + ScrollView | map, address cards, transit route, progress | `EmptyState`, `ErrorState`, `Skeleton`, `GradientProgress`, `PressableScale`, `CategoryIcon`, `AddressesMap`, `TransitRouteMap`, move | Y; **0 hex**; L+D | RefreshControl; map sizing | map (themed `mapBg`/`mapGrid`) | Skeleton, EmptyState, ErrorState, RefreshControl | Map colors come from theme aliases; preserve. |
| More tab | `(tabs)/more.tsx` | SafeArea + ScrollView | profile header (avatar), menu list, language + theme selectors | `ui/Avatar`, `LanguageSelector`, `ThemeSelector`, move | Y; **0 hex**; L+D | ScrollView | avatar | — | **Hosts the `ThemeSelector`** (system/light/dark) — verify all three live-switch. |
| Moving tab | `(tabs)/moving.tsx` | SafeArea + ScrollView | plan list/timeline, list entrance anim | `EmptyState`, `ErrorState`, `Skeleton`, `ListEntrance`, `PressableScale`, `OfflineChip`, move | Y; **1 hex**; L+D | RefreshControl | — | Skeleton, EmptyState, ErrorState, RefreshControl, offline | List entrance animation; reduce-motion already handled at root. |
| Services tab | `(tabs)/services.tsx` | SafeArea + ScrollView | service cards by category, badges, logos | move, `ui/Card`, `Badge`, `EmptyState`, `ErrorState`, `OfflineChip`, `Skeleton`, `ListEntrance`, `PressableScale`, `CategoryIcon`, `ServiceLogoMark` | Y; **12 hex** (CATEGORY_COLORS 84–86 + `#fff` 953–954) | RefreshControl | service provider logos | Skeleton, EmptyState, ErrorState, RefreshControl, offline | **Worst hex offender**; dedupe CATEGORY_COLORS into tokens. |

## Top-level routes

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Root layout | `_layout.tsx` | `Stack` + providers | AuthGuard, AppLockGate, SessionTracker, splash gate | `AnimatedSplash`, `AppLockGate`, `ErrorBoundary`, `SessionTracker` | Y; **1 hex** (`#0A0F18` pre-splash bg 525) | n/a | AnimatedSplash (raccoon) | splash until fonts+i18n | Pre-splash `#0A0F18` hardcoded — match if bg token changes. |
| Not found | `+not-found.tsx` | SafeArea | 404 message + home button | `ui/Button` | Y; **1 hex**; L+D | static | — | terminal state | Trivial; theme the single hex. |
| OAuth callback | `oauth.tsx` | delegates | — | `OAuthCallbackScreen` | inherits | n/a | spinner | loading | 3-line re-export; styling in `OAuthCallbackScreen`. |
| Onboarding | `onboarding.tsx` | KAV + SafeArea + ScrollView | multi-step wizard: welcome hero, address autocomplete, service pickers, legal consent, pro showcase, notification priming, coach | move, `Button`, `Input`, `CategoryIcon`, `ServiceLogoMark`, `Skeleton`, `PressableScale`, `LegalConsentPanel`, `EmailVerificationBanner`, `MoveTeaserCard`, **`LogoBrand`**, `ProShowcaseCard`, `onboarding-motion`, `ObCoach`, `NotificationPrimingCard` | Y; **3 hex** (`#fff` checks/icons 1609/2312/2366); L+D | KAV; step layout | **`LogoBrand` raccoon**, wordmark, coach mascot | Skeleton; step transitions | **2733 lines** — largest; richest brand expression (mascot + coach). Preserve coach/motion. |
| Search | `search.tsx` | SafeArea | search input, results list, empty | `EmptyState`, `LoadingScreen`, `ListEntrance`, move | Y; **0 hex**; L+D | Scroll/list | — | LoadingScreen, EmptyState | Standard search pattern. |
| Setup password | `setup-password.tsx` | KAV + SafeArea + ScrollView | password form (OAuth-only users) | `ui/Button`, move | Y; **0 hex**; L+D | KAV | wordmark | submit pending | — |
| Reminders | `reminders/index.tsx` | SafeArea + ScrollView | reminder cards list | `EmptyState`, `ErrorState`, `Skeleton`, move | Y; **0 hex**; L+D | RefreshControl | — | Skeleton, EmptyState, ErrorState, RefreshControl | — |
| Reset password | `reset-password/[token].tsx` | KAV + SafeArea + ScrollView | wordmark, new-password form | `ui/Input`, move | Y; **0 hex**; L+D | KAV | wordmark | submit pending | Public route (no auth guard). |

## Addresses — `addresses/*`

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Address detail | `addresses/[id]/index.tsx` | SafeArea + ScrollView | detail card, category icon, list entrance | `ui/Card`, `CategoryIcon`, `LoadingScreen`, `ErrorState`, `ListEntrance`, move | Y; **0 hex**; L+D | RefreshControl | — | LoadingScreen, ErrorState, RefreshControl | — |
| Edit address | `addresses/[id]/edit.tsx` | SafeArea + ScrollView | autocomplete form | `address-autocomplete-field`, `LoadingScreen`, move | Y; **0 hex**; L+D | form | — | LoadingScreen, ActivityIndicator (save) | — |
| New address | `addresses/new.tsx` | KAV + SafeArea + ScrollView | autocomplete form, email-verify banner, success toast | `address-autocomplete-field`, `EmailVerificationBanner`, `SuccessToast`, move | Y; **0 hex**; L+D | KAV | — | ActivityIndicator (save), SuccessToast | — |

## Blog — `blog/*`

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Blog layout | `blog/_layout.tsx` | `Stack` | nav container | — | inherits; 0 hex | n/a | — | — | Public group (AuthGuard allows `blog`). |
| Blog index | `blog/index.tsx` | SafeArea + **FlatList** | post list cards | move | Y; **0 hex**; L+D | FlatList; RefreshControl | — | ActivityIndicator, RefreshControl | Only public content list; FlatList pagination. |
| Blog post | `blog/[slug].tsx` | SafeArea + ScrollView | article header, rich body | move | Y; **0 hex**; L+D | ScrollView; RefreshControl | — | ActivityIndicator, RefreshControl | Rich-text rendering — verify typography tokens. **[needs verification - runtime]** |

## Budget — `budget/*`

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Budget index | `budget/index.tsx` | SafeArea + ScrollView | summary, progress, collapsible category cards, count-up totals, badges | `ui/Card`, `Badge`, `EmptyState`, `ErrorState`, `LoadingScreen`, `GradientProgress`, `CountUp`, `ListEntrance`, `PressableScale`, `CollapsibleCard`, `SuccessToast`, move | Y; **0 hex**; L+D | RefreshControl | — | LoadingScreen, EmptyState, ErrorState, RefreshControl, SuccessToast | **1575 lines**; richest data-viz (progress/count-up). Token-clean. |
| Budget detail | `budget/[id].tsx` | SafeArea + ScrollView | line-item detail | `ErrorState`, `LoadingScreen`, move | Y; **0 hex**; L+D | RefreshControl | — | LoadingScreen, ErrorState, RefreshControl | — |
| New budget | `budget/new.tsx` | SafeArea + ScrollView | create form | move | Y; **0 hex**; L+D | form | — | ActivityIndicator (save) | — |

## Custom providers — `custom-providers/*`

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Custom providers list | `custom-providers/index.tsx` | SafeArea + ScrollView | provider list | `EmptyState`, `ErrorState`, `LoadingScreen`, move | Y; **0 hex**; L+D | RefreshControl | — | LoadingScreen, EmptyState, ErrorState, RefreshControl | — |
| Custom provider detail | `custom-providers/[id].tsx` | SafeArea + ScrollView | detail card, category icon | `CategoryIcon`, `ErrorState`, `LoadingScreen`, move | Y; **0 hex**; L+D | RefreshControl | — | LoadingScreen, ErrorState, RefreshControl | — |
| Edit custom provider | `custom-providers/[id]/edit.tsx` | KAV + SafeArea + ScrollView | edit form, category icon | `LoadingScreen`, `CategoryIcon`, move | Y; **0 hex**; L+D | KAV | — | LoadingScreen, ActivityIndicator (save) | — |

## Help — `help/*`

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Help index | `help/index.tsx` | SafeArea + ScrollView | FAQ/help sections, contact | `LoadingScreen`, `ErrorState`, move | Y; **0 hex**; L+D | RefreshControl | — | LoadingScreen, ErrorState, RefreshControl | — |
| Tickets list | `help/tickets.tsx` | SafeArea + ScrollView | support ticket list | `ErrorState`, `LoadingScreen`, move | Y; **0 hex**; L+D | RefreshControl | — | LoadingScreen, ErrorState, ActivityIndicator, RefreshControl | — |
| Ticket thread | `help/tickets/[id].tsx` | KAV + SafeArea + ScrollView | message thread, reply composer | `ErrorState`, `LoadingScreen`, move | Y; **0 hex**; L+D | KAV (composer) | — | LoadingScreen, ErrorState, RefreshControl | Chat-style thread; verify bubble theming. |

## Invitations & Workspace

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Invite landing | `invitations/[token].tsx` | SafeArea | invite card, accept/decline | `LoadingScreen`, move | Y; **0 hex**; L+D | static | wordmark | LoadingScreen, ActivityIndicator | Deep-link target; token stashed pre-auth. |
| Accept invite | `workspace/accept-invite.tsx` | SafeArea + ScrollView | workspace invite accept | move | Y; **0 hex**; L+D | ScrollView | — | ActivityIndicator | — |

## Moving — `moving/*` (top-level, distinct from tab)

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Plan detail | `moving/[id].tsx` | SafeArea + ScrollView | hero, dossier, vehicle check, state rules, transit map, collapsibles, swipe actions, migration banner | move, `CategoryIcon`, `Avatar`, `ui/Card`, `CollapsibleCard`, `HomeDossierCard`, `VehicleCheckCard`(+helpers), `StateRulesCard`, `TransitRouteMap`, `Badge`, `ErrorState`, `Skeleton` | Y; **3 hex** (`#fff` 947/1351/1658); L+D | RefreshControl; swipe gestures | — | Skeleton, ErrorState, RefreshControl | **1659 lines**; most composed detail screen. `#fff` on swipe/migration buttons → `onAccent`. |
| New plan | `moving/new.tsx` | KAV + SafeArea + ScrollView | autocomplete wizard form | `address-autocomplete-field`, move | Y; **1 hex**; L+D | KAV | — | ActivityIndicator (save) | — |

## Notifications

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Notifications list | `notifications/index.tsx` | SafeArea + ScrollView | grouped notification cards, list entrance | `EmptyState`, `ErrorState`, `LoadingScreen`, `ListEntrance`, `PressableScale`, move | Y; **0 hex**; L+D | RefreshControl | — | LoadingScreen, EmptyState, ErrorState, RefreshControl | Push-tap deep-link target (see root `resolveNotificationRoute`). |

## Providers — `providers/*`

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Providers index | `providers/index.tsx` | SafeArea + **FlatList** | category chip row, recommended row, provider cards, state rules | `EmptyState`, `ErrorState`, `LoadingScreen`, `ProviderCard`, `ListEntrance`, `CategoryChipRow`, `RecommendedRow`, `CategoryIcon`, `PressableScale`, `StateRulesCard` | Y; **0 hex**; L+D | FlatList; RefreshControl | provider logos (ProviderCard) | LoadingScreen, EmptyState, ErrorState, ActivityIndicator, RefreshControl | **1308 lines**; FlatList virtualization; rich filtering chrome. |
| Provider detail | `providers/[id].tsx` | SafeArea + ScrollView | hero, reason, affiliate CTA, gov source links, provider card | move, `ui/Button`, `ErrorState`, `LoadingScreen`, `ServiceLogoMark`, `ProviderCard`, `ProviderReason`, `GovernmentSourceLinks` | Y; **0 hex**; L+D | ScrollView | provider/service logos | LoadingScreen, ErrorState | Affiliate CTA button styling; preserve gov-source link block. |
| Compare providers | `providers/compare.tsx` | SafeArea + ScrollView | side-by-side comparison cards | move, `ui/Card`, `ErrorState`, `LoadingScreen`, `EmptyState`, `ServiceLogoMark` | Y; **0 hex**; L+D | ScrollView (horizontal compare) | service logos | LoadingScreen, EmptyState, ErrorState | Comparison layout — verify column behavior on narrow screens. **[needs verification - runtime]** |

## Services — `services/*` (top-level)

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Service detail | `services/[id].tsx` | SafeArea + ScrollView | hero, logo, detail cards, actions | `ErrorState`, `LoadingScreen`, `PressableScale`, `ServiceLogoMark`, move | Y; **10 hex** (CATEGORY_COLORS 56–58); L+D | RefreshControl | service logo | LoadingScreen, ErrorState, RefreshControl | Dedupe CATEGORY_COLORS map (shared w/ services tab + edit). |
| Edit service | `services/[id]/edit.tsx` | SafeArea + ScrollView | edit form, logo | `LoadingScreen`, `ServiceLogoMark`, move | Y; **10 hex** (CATEGORY_COLORS 45–54); L+D | form | service logo | LoadingScreen, ActivityIndicator (save) | Third copy of CATEGORY_COLORS. |
| New service | `services/new.tsx` | KAV + SafeArea + ScrollView | category picker, logo, form, email-verify banner, success toast | move, `CategoryIcon`, `EmailVerificationBanner`, `SuccessToast`, `ServiceLogoMark` | Y; **0 hex**; L+D | KAV | service logos | ActivityIndicator (save), SuccessToast | **1509 lines**; multi-step add flow. |

## Settings — `settings/*`

| Route/Screen | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| Address changes | `settings/address-changes.tsx` | SafeArea + ScrollView | change-request list | move | Y; **0 hex**; L+D | ScrollView | — | ActivityIndicator | — |
| Connections | `settings/connections.tsx` | SafeArea + ScrollView | linked OAuth accounts list, connect/disconnect | `LoadingScreen`, move | Y; **0 hex**; L+D | ScrollView | OAuth provider marks (via labels) | LoadingScreen, ActivityIndicator | — |
| Delete account | `settings/delete-account.tsx` | SafeArea + ScrollView | warning, confirm input | `ui/Input`, move | Y; **0 hex**; L+D | ScrollView | — | ActivityIndicator | Destructive — preserve warning emphasis (uses error tokens). |
| Export data | `settings/export.tsx` | SafeArea + ScrollView | export options, request form | `ui/Input`, move | Y; **0 hex**; L+D | ScrollView | — | ActivityIndicator, isLoading | — |
| Notifications settings | `settings/notifications.tsx` | SafeArea + ScrollView | toggle rows, priming | `LoadingScreen`, move | Y; **0 hex**; L+D | ScrollView | — | LoadingScreen, ActivityIndicator | RN `Switch` theming — verify track/thumb tokens. |
| Privacy & security | `settings/privacy.tsx` | SafeArea + ScrollView | app-lock, password, security sections | move, `ui/Button` | Y; **0 hex**; L+D | ScrollView | — | — | **754 lines**; hosts app-lock controls (AppLockGate). |
| Profile | `settings/profile.tsx` | SafeArea + ScrollView | avatar, profile form | `ErrorState`, `LoadingScreen`, move | Y; **0 hex**; L+D | ScrollView | avatar | LoadingScreen, ErrorState, ActivityIndicator | — |
| Subscription | `settings/subscription.tsx` | SafeArea + ScrollView | plan hero, tier cards, IAP purchase/restore, billing | move | Y; **0 hex**; L+D | ScrollView | plan badges | ActivityIndicator (purchase/restore) | **1693 lines**; IAP flows + plan accent. Plan palette currently pass-through (`applyPlanPalette` retired). |
| Two-factor | `settings/two-factor.tsx` | SafeArea + ScrollView | QR/setup, codes, verify | move | Y; **1 hex**; L+D | ScrollView | — | ActivityIndicator | QR rendering — verify contrast in both themes. |
| Workspace | `settings/workspace.tsx` | SafeArea + ScrollView | members list, invites, roles | `LoadingScreen`, move | Y; **0 hex**; L+D | ScrollView | member avatars | LoadingScreen, ActivityIndicator | **818 lines**; member/role management. |

---

## Theme-renewal readiness summary

- **Strengths:** ~85% of screens are **0-hex** and fully token-driven via `useAppTheme`/`makeStyles(theme)`; light+dark already wired through `ThemeProvider` with live switching (Stack remount on scheme change). Shared state components (Loading/Error/Empty/Skeleton) are centralized and theme-aware. Brand identity (raccoon mascot + Playfair "Move" wordmark) is componentized (`LogoBrand`, `MoveRaccoon`, `AnimatedSplash`).
- **Debt to fix in renewal:** (1) `CATEGORY_COLORS` hex map duplicated across 3 services files (32 of the hex hits) — extract to shared tokens; (2) scattered `#fff`/`#000` on filled accents/checkmarks → use `colors.onAccent`; (3) pre-splash `#0A0F18` in `_layout.tsx`; (4) legacy Fraunces/Geist fonts still loaded during reskin transition — drop once migration completes; (5) many back-compat color aliases in `theme.ts` (`bg2`, `surface2/3`, `dim`, `faint`…) indicate an in-progress token migration that a redesign should finish/collapse.
- **Must preserve:** OAuth brand marks/colors (`BrandLogos`, sign-in/up); raccoon mascot personality (splash, EmptyState, onboarding coach); `move/primitives` design language (uppercase section labels, hairline navy cards, accent gradient).
- **Runtime-only items:** landscape/tablet behavior, blog rich-text typography, comparison-screen narrow-width layout, Switch/QR contrast — all marked **[needs verification - runtime]**.

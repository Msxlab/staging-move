# Web App Shell / Dashboard — Design ↔ Code Gap Analysis

**Area:** `web-app-shell` · **Type:** GAP ANALYSIS ONLY (no code changes).

**NEW design (source of truth)**
- `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move Web.dc.html` (landing/marketing page body)
- `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Web.dc.html` (global web shell + hash router)

**CURRENT implementation**
- `apps/web/src/app/(app)/layout.tsx` (auth gate → AppShell)
- `apps/web/src/components/layout/app-shell.tsx`, `.../sidebar.tsx`, `.../header.tsx`, `.../mobile-nav.tsx`
- Inventory: `docs/ui-renewal/11_WEB_APP_PAGES.md`, `docs/ui-renewal/03_BRAND_AND_LAYOUT.md`

---

## designSummary

The two handoff files are the **public web experience**, not an authenticated dashboard.

`Web.dc.html` is the global web shell: a single **sticky top nav bar** (`height:60px`, `backdrop-filter:blur(14px)`, `background:rgba(7,11,20,0.82)`, navy `#070B14` body) with a raccoon-mark + "Move" Playfair-900 wordmark on the left and `Features / Why free / Guides`, `Log in`, and a gold-gradient **"Get the app"** CTA on the right. Below it a `.w-stage` hash-router (`#/features`, `#/why-free`, `#/blog`, `#/login`, `#/onboarding`, `#/app`) swaps in marketing sub-pages via `dc-import`. There is **no left sidebar, no app topbar with search/notifications/user-menu, no bottom tab bar, and no in-page dashboard.**

The only "logged-in" surface is the `#/app` route (`Web.dc.html:63-68`): it renders a centered **"Signed in as Liam Kutay · live app"** status pill (green dot) and then **embeds the mobile `Move` app inside a 390×844 desktop phone frame** (`<dc-import name="Move" embed="true">`, `border-radius:46px`, big drop shadow). In other words, the new design's web "app" = the mobile app in a phone bezel, not a responsive desktop web app.

`Move Web.dc.html` is the landing page body (rendered into `#/` via `rHome`): badge eyebrow "Relocation Intelligence", Playfair shimmer hero "Your entire move, handled.", a live **Rough home / Dream home** demo phone (embeds `Move`), "How Move works — in 3 steps", **Home Dossier** band (DossierScene cards: area/weather/water/transit/air/housing), services + address-map split, AI Briefing / Smart Reminders / Move Budget trio, **"Always free"** feature grid, testimonials, FAQ, gold CTA, and a footer wordmark "Move **by LocateFlow**". Palette: navy `#070B14` bg, surfaces `#121B2D`/`#18233A`, **Gold accent `#CBA45E`/`#DCBC7C`/`#B0852F`** (NOT teal/green), green `#54CB7E` / teal `#37C2C9` / amber / red semantics, Playfair + DM Sans + DM Mono.

## currentSummary

The current web app is a full **authenticated SPA-style shell**. `(app)/layout.tsx` auth-gates and renders `AppShell` (`app-shell.tsx`), which composes a **persistent left `Sidebar`** (desktop sticky `w-60`/collapsed `w-[68px]`, mobile drawer `w-72`; grouped nav Workspace/Account + Pro upsell footer), a **`Header` topbar** (GlobalSearch, NotificationCenter bell, ThemeToggle, LanguageSelector, user-menu), a **`MobileNav` bottom tab bar** (5 items, `md:hidden`), `ImpersonationBanner`, `PendingInvitationsBanner`, `InstallPrompt`, an `app-shell-backdrop` decorative layer, and a skip-to-main link. Main content: `<main p-4 md:p-6 pb-20 md:pb-6>` → `max-w-screen-2xl`. There are ~28 authenticated routes (dashboard with 13 drag-reorderable widgets, addresses, budget, moving, providers, services, settings hub + 8 subpages, support, notifications). Brand = LocateFlow raccoon (gold eyes), sidebar wordmark `Locate`+italic-foil `flow`, Sapphire/Gold tokens, `--surface:#121B2D` dark / `.light` override, `planClass` Sapphire pass-through, an `?embed=mobile` chrome-stripped variant. Theme via `next-themes` (system/light/dark).

---

## Gap table

| ID | Type | Title | Design evidence | Code evidence | Severity | Decision? |
|---|---|---|---|---|---|---|
| web-app-shell-01 | missing | New design ships **no authenticated web app shell** — web "app" is the mobile app in a phone frame | `Web.dc.html:63-68` `#/app` route = status pill + `<dc-import name="Move" embed="true">` in a 390×844 bezel; no sidebar/topbar/widgets anywhere in handoff | Full shell `app-shell.tsx` (Sidebar+Header+MobileNav+banners) wrapping ~28 routes; `11_WEB_APP_PAGES.md` | High | **Yes** |
| web-app-shell-02 | rebrand | "Move" wordmark replaces "LocateFlow" in shell/nav | `Web.dc.html:40` Playfair-900 "Move"; `Move Web.dc.html:45/265` "Move" + footer "Move **by LocateFlow**" | Sidebar wordmark `Locate`+italic-foil `flow` (`sidebar.tsx:172-177`); marketing `Wordmark`=`LocateFlow` | High | **Yes** |
| web-app-shell-03 | different | Persistent left **sidebar** has no equivalent in new design | No sidebar in `Web.dc.html`/`Move Web.dc.html`; only a top nav bar | `sidebar.tsx` grouped Workspace/Account nav, collapse `w-60↔w-[68px]`, mobile drawer, Pro upsell footer | High | **Yes** |
| web-app-shell-04 | different | App **topbar** (search / notifications / theme / lang / user-menu) absent in new design | `Web.dc.html:36-53` nav = wordmark + 3 links + Log in + "Get the app" only | `header.tsx` GlobalSearch, NotificationCenter, ThemeToggle, LanguageSelector, user-menu | High | **Yes** |
| web-app-shell-05 | different | **Bottom mobile tab bar** not present in new web design | New web mobile nav = burger → dropdown links (`Web.dc.html:42/49`, `.wnav-links` slide-down) | `mobile-nav.tsx` fixed bottom 5-tab bar (`md:hidden`) | Medium | No |
| web-app-shell-06 | missing | **Dashboard with 13 drag-reorderable widgets** has no web counterpart in design | No dashboard surface in handoff; new "dashboard" = embedded mobile `Move` home screen | `(app)/dashboard/dashboard-client.tsx` 13 dnd-kit widgets, A/B top slots, customization panel | High | **Yes** |
| web-app-shell-07 | theme | Nav active state: gold tinted pill vs current gold tone-bg | `Web.dc.html:84` active link `col:#CBA45E, bg:rgba(203,164,94,0.10)` | Sidebar active `bg-tone-orange-bg text-tone-orange-fg` (`03_BRAND_AND_LAYOUT.md §3.2`) | Low | No |
| web-app-shell-08 | rebrand | New web nav IA = `Features / Why free / Guides` (marketing), not the app's Workspace/Account nav | `Web.dc.html:86` `links:[Features, Why free, Guides]` + Log in + Get the app | Marketing header `Features/Why free/Pricing/Help/Blog/FAQ` (`03_..§3.1`); app sidebar 11 routes | Medium | **Yes** |
| web-app-shell-09 | new | **Raccoon mark in a gold-bordered rounded-tile** is the nav logo (parametric `Raccoon` component) | `Web.dc.html:39` `<dc-import name="Raccoon" ... eye="#CBA45E">` in `34×34` tile `box-shadow:0 0 0 1px rgba(203,164,94,0.22)` | Current sidebar uses `LogoMark` `<img src="/logo-mark.svg">` size 32, no tile border (`logo.tsx`, `sidebar.tsx`) | Low | No |
| web-app-shell-10 | new | `#/app` shows a **"Signed in as … · live app" green-dot status pill** above the phone | `Web.dc.html:65` status row, `#54CB7E` glowing dot | No equivalent (current shell shows real chrome, not a demo pill) | Low | No |
| web-app-shell-11 | different | New shell is a **client-side hash router** (`#/features` etc.); current is Next.js route groups + SSR auth gate | `Web.dc.html:74-90` `location.hash` router, `nav()` | `(app)/layout.tsx` server auth gate (`requireDbUserId`/`getAppGateState`) + App Router | Medium | No |
| web-app-shell-12 | theme | Nav bar chrome: `60px` height, `blur(14px)`, `rgba(7,11,20,0.82)`, gold-gradient CTA | `Web.dc.html:36-47` | Header/marketing-header `h-16`, `bg-background/95 backdrop-blur`; app shell has no marketing-style translucent bar | Low | No |
| web-app-shell-13 | theme | Accent stays **Gold `#CBA45E`** in shell/nav — brief's "teal/green primary" not in source | `Web.dc.html:39/47/84` all gold; `Move Web.dc.html:29` `--gold:#CBA45E` | Current dark primary already Gold `#CBA45E` (`03_..§1`, `01_DESIGN_SYSTEM_DELTA.md §1.2`) | Medium | **Yes** |
| web-app-shell-14 | missing | New design has **no settings hub / 8 subpages / impersonation / install-prompt / pending-invitations** web surfaces | None present in `Web.dc.html`/`Move Web.dc.html` | `app-shell.tsx:133-147` ImpersonationBanner, PendingInvitationsBanner, InstallPrompt; `(app)/settings/**` | High | **Yes** |
| web-app-shell-15 | different | Embed mode inverts: current strips chrome for native; new design **makes the embed the whole web app** | `Web.dc.html:66` web app *is* the embedded mobile component | `app-shell.tsx:89-99` `?embed=mobile` strips chrome only inside native in-app browser | Medium | **Yes** |
| web-app-shell-16 | theme | Card radius far rounder; phone frame `46px`, CTA `11-14px`, pills `99px` | `Web.dc.html:66` `border-radius:46px`; `Move Web.dc.html:65/79` | Current cards `rounded-2xl`/8-10px md radius (`01_DESIGN_SYSTEM_DELTA.md §3`) | Low | No |
| web-app-shell-17 | wrong | Footer/brand mixing: design keeps "**by LocateFlow**" endorsement under "Move" — naming not fully resolved | `Move Web.dc.html:265` `<span>by LocateFlow</span>`; `© 2024` | Repo is mid-rename (LocateFlow primary); OG "M" glyph bug (`03_..§7`) | Medium | **Yes** |

---

## Detail & recommendations

### web-app-shell-01 / 06 / 14 — There is no web app shell in the handoff (the central finding)
The brief asks to compare `Move Web.dc.html` + `Web.dc.html` against the authenticated app shell, but **these files do not contain an authenticated desktop web app**. `Web.dc.html`'s `#/app` route (lines 63-68) renders only a status pill and an embedded **mobile** `Move` component inside a phone bezel. The new product's web "app" is therefore the mobile app shown in a frame — there is no sidebar, no topbar, no dashboard widgets, no settings/notifications/support web pages, and no impersonation/invitation/install chrome.

This is the single biggest scope decision. Options:
1. **Web becomes marketing-only + a phone-framed embed of the mobile app** (literal reading of the design) — would mean deprecating the entire `(app)/**` desktop web app (~28 routes, the 13-widget dashboard, settings hub, etc.).
2. **The handoff simply didn't redesign the authenticated web shell** (likely — the export is "Initial check requested"), and the team must re-theme the existing shell with Move branding + navy/gold tokens while keeping its structure.

Recommendation: treat the missing shell as **out of scope of this handoff**, not as an instruction to delete the web app. Re-skin the existing `AppShell`/`Sidebar`/`Header` with the Move wordmark + handoff tokens, and confirm with product whether the phone-framed embed (`#/app`) is the intended desktop "app" or just a marketing device. `decisionNeeded`.

### web-app-shell-02 / 08 / 17 — Rebrand scope (Move vs LocateFlow)
Design nav/wordmark = "Move" (Playfair-900) with raccoon mark; footer still says "Move **by LocateFlow**" and `© 2024`. Current sidebar uses the split `Locate`+italic-foil`flow` wordmark and marketing uses `LocateFlow`. The rename touches the sidebar wordmark, marketing header/footer, manifest/apple-title, OG image (which still has the legacy "M" glyph bug, `03_..§7`), and the nav IA (`Features/Why free/Guides` vs `Features/Why free/Pricing/Help/Blog/FAQ`). Whether "by LocateFlow" endorsement stays is itself a branding call. `decisionNeeded`.

### web-app-shell-03 / 04 / 05 — Nav primitives diverge
The new web design has only a **single translucent top nav bar** with a burger-dropdown on mobile. The current app has three distinct nav surfaces (left sidebar, app topbar, bottom tab bar). If the existing shell is kept (per 01 option 2), these survive and just get re-skinned (gold active pill, Move wordmark). If the design is taken literally, the sidebar/topbar/tab-bar all go away. `decisionNeeded` on the sidebar (03) since dropping it is a major layout change.

### web-app-shell-13 — Accent stays Gold (not teal/green)
Consistent with `01_DESIGN_SYSTEM_DELTA.md §1.2`: every nav/CTA/active-state color in `Web.dc.html` and `Move Web.dc.html` is **Gold `#CBA45E`/`#DCBC7C`/`#B0852F`**, identical to the current dark primary. The brief's `#168E9C`/`#1C8A63`/`#2A8E66` are light-mode semantic teal/green and the Emerald accent ramp, not the shell primary. The shell color swap is therefore near-zero unless the team elects Emerald as the new default accent. `decisionNeeded`.

### web-app-shell-15 — Embed-mode semantics flip
Current `?embed=mobile` *removes* chrome so a web page blends into a native in-app browser (`app-shell.tsx:89-99`). The new design instead *makes the embed the product* on desktop web (a phone bezel around the mobile app). These are opposite intents and must be reconciled if the design's `#/app` route is adopted. `decisionNeeded`.

### web-app-shell-07 / 09 / 10 / 11 / 12 / 16 — Cosmetic / structural deltas
Low-to-medium polish items: gold-tinted active pill (matches current gold tone, trivial), raccoon-in-gold-tile nav logo, the demo "Signed in as Liam Kutay" status pill, hash-router vs Next App Router (architectural, not a re-skin), translucent 60px nav-bar chrome with gold-gradient CTA, and the global radius bump (46px phone frame, rounder cards). None block the shell re-skin.

---

## Open questions
1. Is the authenticated desktop web app (`(app)/**`, sidebar+topbar+13-widget dashboard, ~28 routes) being **kept and re-skinned**, or replaced by the design's marketing site + phone-framed mobile embed?
2. Does the `#/app` "phone in a bezel" embed represent the intended desktop product, or is it only a marketing showcase?
3. Final wordmark: "Move" alone, or "Move by LocateFlow"? Does the raccoon mark stay, and with gold or a new accent's eyes?
4. Default accent for the shell: keep **Gold** (matches source) or adopt **Emerald** (brief's teal/green)?
5. If the existing shell is kept, do the left sidebar + bottom tab bar survive, or collapse to the design's single top-nav + burger model?

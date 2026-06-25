# 2026-06-25 Source Bundle UI Integration Audit Progress

## Scope

- Continued the source-bundle audit requested for web, mobile, and admin UI/UX/theme/dossier/cache behavior.
- Used source bundle files under `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`.
- Did not use existing repo memory/docs as product evidence.
- Did not modify mobile, admin, dependencies, env files, deployment config, or production data.

## Source Bundle Inventory

- `Move.dc.html` is the main mobile-style app experience with light/dark theme tokens, route map, dashboard, services, settings, address screens, and the Home Dossier deck.
- `DossierScene.dc.html` is the animated scene matrix used by dossier cards.
- `Move Web.dc.html` is the dark marketing/landing experience and explicitly says the free-feature grid should be backed by real feature registry data.
- `Web.dc.html` is the marketing router and registers the prototype `sw.js`.
- `Admin.dc.html` is a separate dark-only operations console prototype.
- `Auth.dc.html`, `Onboarding.dc.html`, `Reminders.dc.html`, `Help.dc.html`, `Search.dc.html`, `Providers.dc.html`, `CustomProviders.dc.html`, and `Invitations.dc.html` are standalone mobile modules.

## Source Theme Evidence

From `Move.dc.html`:

- Light tokens: `bg #EFEADF`, `bg2 #E7E1D4`, `surface #FFFFFF`, `surface2 #F5F0E7`, `surface3 #ECE6DA`.
- Source prototype light theme uses `bg #EFEADF` as the warm paper family and `surface #FFFFFF` for cards/panels. A follow-up staging screenshot showed that a flat full-screen `#EFEADF` app canvas made the dashboard look muddy, so web now keeps the source paper as the warm edge tone in a white-to-paper gradient rather than as a solid wash.
- Dossier card stage: 82px dark animated stage `linear-gradient(180deg,#101b30,#0a1322)` even when the app theme is light.
- Dossier layout: source deck with `View full` / `Swipe view`, horizontal swipe mode at `76%`, expanded wrap mode at `calc(50% - 6px)`.

## Current Web Findings

- Web had the source deck code and tests already (`lf-dossier-source-deck`, `lf-dossier-source-stage`, source scene data attributes).
- The earlier web light canvas was softened to `#FBFAF6`, which drifted away from the requested source beige family; the later flat `#EFEADF` canvas overcorrected and made the dashboard too muddy.
- The prior light-stage fix made dossier stages light blue/grey, but source expects a dark animated dossier stage.
- Web service worker is intentionally auth-safe and does not cache `/api/*`; dossier UI cache is `sessionStorage` in `HomeDossier`, not the prototype's broad offline-first service worker.

## Changes Made In This Pass

- Restored web light app background to the source warm-paper family:
  - `--background: 41.25 33.33% 90.59%`
- `--lf-app-bg: radial-gradient(ellipse 120% 80% at 50% -20%, #FFFFFF 0%, #F8F5EE 46%, #EFEADF 100%)`
- Kept web app chrome and dense dashboard panels white to avoid the muddy monochrome UI seen on staging.
- Restored light-mode dossier animated stages to the source dark stage background.
- Strengthened source-scene ground visibility inside dark stages in light mode.
- Increased the source-style dossier deck stage from 82px to 92px so the animated scene has enough vertical room on web.
- Made the source-style dossier deck the primary web presentation by hiding the legacy row grid until `View full` is selected; if there are no source cards, the legacy grid still shows as fallback.
- Updated the dossier CSS regression test to pin both the source beige app canvas and dark animated dossier stage.
- Added a follow-up regression check in the pricing/free-tier contract test so the light app canvas stays in the source warm-paper family without returning to the muddy outer-page radial or a flat beige wash.

## Current Mobile Findings

- Mobile theme tokens already consume `surfaceLight.background = #EFEADF` from shared tokens.
- Mobile `ThemeProvider` still defaults first launch to `"dark"` when no saved preference is provided, despite its comment describing a system/default flow.
- Mobile Home Dossier remains a row/list presentation, not the source deck/full-swipe dossier treatment.
- Mobile Home Dossier comments and gating still describe paid-plan unlock behavior (`entitled:false`, `upgradeRequired`, teaser), which conflicts with the affiliate/free-for-all direction unless server-side consumer-free always resolves the user to an entitled plan.
- Mobile dossier cache is device-side memory + AsyncStorage with a 30-minute fresh TTL and a gate-boundary epoch to avoid stale gated payloads after consumer-free flips.

## Current Admin Findings

- Source `Admin.dc.html` is dark-only.
- Current admin app has both light and dark token scopes; its default `:root` light token set is not a direct source match.
- No admin code was changed in this pass because changing admin theming is a broader surface than the active web dossier/theme fix.

## Verification

- `pnpm --filter @locateflow/web test -- dossier-ambient route-map-card home-dossier`
  - 4 files passed, 125 tests passed.
- `git diff --check`
  - passed with the existing line-ending warning for `apps/web/src/styles/globals.css`.
- `pnpm --filter @locateflow/web lint`
  - passed.
- `pnpm --filter @locateflow/web build`
  - passed with existing warnings: local Node v24.13.0 does not match the repo's expected Node 22.x, Next middleware convention warning, Prisma CommonJS re-export warning, and Edge runtime static-generation warnings.
- Follow-up color hotfix:
  - `pnpm --filter @locateflow/web test -- dossier-ambient pricing-free-tier-contract`
    - 2 files passed, 40 tests passed.
  - `pnpm --filter @locateflow/web lint`
    - passed.
  - `git diff --check`
    - passed with the existing line-ending warning for `apps/web/src/styles/globals.css`.

## Remaining Work

- Visually verify staging after deploy against the source screenshots/current browser state.
- Visually verify that the source deck is now primary and that `View full` reveals the legacy detail grid without overwhelming the first view.
- Before any mobile edits, confirm with the user whether to implement the source deck treatment and free/entitlement copy cleanup on mobile.
- Admin needs a separate decision: keep current light-capable admin or align closer to source dark-only admin.

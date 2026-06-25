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
- Source prototype light theme uses `bg #EFEADF` as the warm paper family and `surface #FFFFFF` for cards/panels. Follow-up staging screenshots showed that both a flat full-screen `#EFEADF` canvas and the earlier warm radial wash made the dense web dashboard look muddy. Web now keeps the source beige token in the shared theme model but uses a cleaner white-led warm-paper derivative for the app shell canvas.
- Dossier card stage: 82px dark animated stage `linear-gradient(180deg,#101b30,#0a1322)` even when the app theme is light.
- Dossier layout: source deck with `View full` / `Swipe view`, horizontal swipe mode at `76%`, expanded wrap mode at `calc(50% - 6px)`.

## Current Web Findings

- Web had the source deck code and tests already (`lf-dossier-source-deck`, `lf-dossier-source-stage`, source scene data attributes).
- The earlier web light canvas was softened to `#FBFAF6`, which drifted away from the requested source beige family; the later warm radial/flat `#EFEADF` attempts overcorrected and made the dashboard too muddy.
- The prior light-stage fix made dossier stages light blue/grey, but source expects a dark animated dossier stage.
- Web service worker is intentionally auth-safe and does not cache `/api/*`; dossier UI cache is `sessionStorage` in `HomeDossier`, not the prototype's broad offline-first service worker.
- Home Dossier web cache is browser-side per tab/session: key `lf:home-dossier:v1:{addressId}`, freshness from the dossier route's private `max-age` header or the client fallback.
- Route map light labels already have a light-mode CSS override; if staging still shows dark labels, the browser/server is serving an older deployed asset or cached CSS.
- The PDF route has a real-generator regression test for the current dossier payload, so a continuing staging 500 should be checked in server runtime logs for the concrete logged `Failed to build dossier PDF` error shape.
- The household activation modal can open for an already-existing household where the user's next action is invite email, but the prior focus decision could still land on the household name input.
- The source `Move.dc.html` mobile app uses a source deck/swipe dossier pattern, while the user-provided web reference image shows the desktop dashboard dossier as a full row/list. Treating the source deck as the only primary web view hid the desktop row/list target.

## Changes Made In This Pass

- Restored web light app tokens to the source warm-paper family:
  - `--background: 41.25 33.33% 90.59%`
- Changed the actual web app shell background to `linear-gradient(180deg, #FFFFFF 0%, #FBFAF7 58%, #F6F2EA 100%)` so the full dashboard no longer gets a beige/grey veil.
- Kept web app chrome and dense dashboard panels white to avoid the muddy monochrome UI seen on staging.
- Restored light-mode dossier animated stages to the source dark stage background.
- Strengthened source-scene ground visibility inside dark stages in light mode.
- Increased the source-style dossier deck stage from 82px to 92px so the animated scene has enough vertical room on web.
- Made the source-style dossier deck the compact/mobile web presentation while restoring the desktop row/list dossier view from the provided web reference image.
- Updated the dossier CSS regression test to pin both the clean warm app canvas derivative and dark animated dossier stage.
- Added a follow-up regression check in the pricing/free-tier contract test so the light app canvas stays in a clean warm-paper derivative without returning to the muddy outer-page radial or a flat beige wash.
- Added a `showTag` switch to `DossierAmbient` and used it in the source deck so the deck renders one `GOOD/CHECK/ALERT` label instead of stacking the ambient scene's internal label under the deck label.
- Changed household activation modal initial focus so an existing household opens on the first invite email field; only the no-workspace create flow starts on household name.
- Added focused tests for both the suppressed dossier internal tag and household setup focus target.
- Adjusted web Home Dossier responsive behavior:
  - Compact/mobile keeps the source deck/swipe presentation.
  - Desktop (`min-width: 900px`) hides the source deck controls/cards and shows the row/list dossier by default, matching the provided web reference image.
  - Added a regression test that pins this desktop row/list + compact source deck split.

## Current Mobile Findings

- Mobile theme tokens already consume `surfaceLight.background = #EFEADF` from shared tokens.
- Mobile `ThemeProvider` still defaults first launch to `"dark"` when no saved preference is provided, despite its comment describing a system/default flow.
- Mobile Home Dossier remains a row/list presentation, not the source deck/full-swipe dossier treatment.
- Mobile Home Dossier comments and gating still describe paid-plan unlock behavior (`entitled:false`, `upgradeRequired`, teaser), which conflicts with the affiliate/free-for-all direction unless server-side consumer-free always resolves the user to an entitled plan.
- Mobile dossier cache is device-side memory + AsyncStorage with a 30-minute fresh TTL and a gate-boundary epoch to avoid stale gated payloads after consumer-free flips.
- Mobile was inspected only; no mobile files were modified because the user explicitly asked to be told before any mobile changes.

## Current Admin Findings

- Source `Admin.dc.html` is dark-only.
- Current admin app has both light and dark token scopes; its default `:root` light token set is not a direct source match.
- No admin code was changed in this pass because changing admin theming is a broader surface than the active web dossier/theme fix.
- Admin was inspected only; aligning it to the source dark-only operations console would be a separate UI decision.

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
- Follow-up source-deck/invite-focus patch:
  - `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier household-activation-card route-map-card pricing-free-tier-contract`
    - 6 files passed, 152 tests passed.
    - Local warning: Node v24.13.0 does not match repo expected Node 22.x.
- Follow-up desktop row/list dossier patch:
  - `pnpm --filter @locateflow/web test -- home-dossier dossier-ambient route-map-card household-activation-card pricing-free-tier-contract`
    - 6 files passed, 153 tests passed.
    - Local warning: Node v24.13.0 does not match repo expected Node 22.x.
  - `pnpm --filter @locateflow/web lint`
    - passed with the same local Node engine warning.
  - `git diff --check`
    - passed with the existing CRLF warning for `apps/web/src/styles/globals.css`.
- Follow-up light-canvas cleanup after staging feedback:
  - `pnpm --filter @locateflow/web test -- dossier-ambient pricing-free-tier-contract`
    - 2 files passed, 41 tests passed.
    - Local warning: Node v24.13.0 does not match repo expected Node 22.x.
  - `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card household-activation-card pricing-free-tier-contract`
    - 6 files passed, 153 tests passed.
    - Local warning: Node v24.13.0 does not match repo expected Node 22.x.
  - `pnpm --filter @locateflow/web lint`
    - passed with the same local Node engine warning.
  - `git diff --check`
    - passed with the existing CRLF warning for `apps/web/src/styles/globals.css`.
  - `pnpm --filter @locateflow/web build`
    - passed with the same local Node engine warning and existing Next/Prisma/Edge-runtime warnings.

## Remaining Work

- Visually verify staging after deploy against the source screenshots/current browser state.
- Visually verify that desktop shows the row/list dossier by default and compact/mobile widths keep the source deck/swipe presentation.
- Open Dokploy/staging logs for the exact PDF 500 cause if staging still returns `{"error":"Failed to build dossier PDF"}` after the newest image is active.
- Hard-refresh or unregister the staging service worker before judging route-map/dossier CSS, because the web app intentionally does not service-worker-cache `/api/*` but stale static assets can still make old UI appear.
- Before any mobile edits, confirm with the user whether to implement the source deck treatment and free/entitlement copy cleanup on mobile.
- Admin needs a separate decision: keep current light-capable admin or align closer to source dark-only admin.

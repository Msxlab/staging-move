# 2026-06-25 Source Bundle UI QA Follow-up

## Scope
- Source bundle inspected from `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`.
- Repo memory/docs were not used as audit evidence. Source evidence came from the bundle README, `.dc.html`, `support.js`, `sw.js`, screenshots, and current source code.
- Mobile and admin were inspected read-only; no mobile/admin files were changed.

## Source Bundle Findings
- Primary handoff file is `project/Move.dc.html`; README says to read it first and follow its imports.
- `Move.dc.html` imports `DossierScene`, `Raccoon`, `Reminders`, `Help`, `Search`, `Providers`, `CustomProviders`, and `Invitations`.
- Light theme in `Move.dc.html` sets `bg: #EFEADF`, `bg2: #E7E1D4`, `surface: #FFFFFF`, `surface2: #F5F0E7`, `surface3: #ECE6DA`.
- Dossier in `Move.dc.html` is a source swipe/full deck: `DossierScene` cards with priority sorting, dots, bars, and a view-full toggle.
- `DossierScene.dc.html` defines 37 `ds-*` animation keyframes and source types `weather`, `air`, `water`, `area`, `transit`, `cost`, and `housing`.
- Source `sw.js` uses broad cache/fetch handling and should not be copied directly into production because authenticated/API traffic needs stricter handling.

## Current Web Findings
- Current web includes all 37 source `ds-*` keyframes in `apps/web/src/styles/source-dossier-scene.css`; no source dossier keyframe is missing.
- Current web adds extra production sections beyond the source deck: flood, school, hazard, radon, EV, and neighborhood.
- The source deck exists in `apps/web/src/components/dashboard/home-dossier.tsx`, but staging screenshots that show only detail rows indicate either an older deploy or a branch/main mismatch.
- The row animations existed, but their layer was strongly masked and visually secondary, which can make them feel absent.
- Light app background had drifted away from the source beige in the previous correction. This follow-up restores `--lf-app-bg: var(--bg)` while keeping card surfaces crisp.

## Changes Made
- Restored source beige light app canvas through `--lf-app-bg: var(--bg)`.
- Increased source dossier deck stage height from `82px` to `96px`.
- Increased source deck gap and minimum desktop card width so the animated deck reads as a primary section.
- Increased light deck shadow and row ambient opacity/contrast.
- Relaxed the row ambient mask so right-side motion is less hidden while the left text zone stays clean.
- Updated the web tests that lock the dossier source deck contract and light theme contract.

## Mobile Read-only Findings
- `apps/mobile/src/lib/theme.ts` uses `surfaceLight.background`, so the light token can resolve to the same beige source background.
- `apps/mobile/src/components/ui/HomeDossierCard.tsx` renders compact rows, not the source swipe/full dossier deck.
- `apps/mobile/src/components/ui/DossierAmbient.tsx` ports row-level ambient motion with Reanimated, but it is not a direct `DossierScene` deck parity port.
- Mobile cache is device-side memory + AsyncStorage through `apps/mobile/src/lib/home-dossier-cache.ts`; this matches the requirement that mobile should not continuously fetch when fresh cached data exists.
- No mobile code was changed.

## Admin Read-only Findings
- Source admin is a dark navy/gold `Move Operations` dashboard.
- Current admin uses the Aurora admin theme and dark/light enterprise surfaces in `apps/admin/src/app/aurora.css`.
- Admin is directionally related but not a direct source-pixel port.
- No admin code was changed.

## QA Limits
- Product Design preflight found no saved user context.
- Browser/Chrome capture tools were not available in this session. Per Product Design rules, Playwright fallback needs explicit user approval before use.
- Therefore this pass is code/source/screenshot-inspection based, not a live visual capture audit.

## Validation
- `git diff --check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/home-dossier.test.tsx src/components/dashboard/dossier-ambient.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/web lint`
- `pnpm tokens:check`

## Remaining Risks
- If staging still shows no source deck after deploying this branch, the deployment is not running the current PR head or the merged branch is stale.
- Live visual QA still needs Browser/Chrome access or explicit Playwright approval.
- Mobile source deck parity is not implemented; that requires approval before editing mobile.
- Admin direct source parity is not implemented; the current admin is a separate Aurora system.

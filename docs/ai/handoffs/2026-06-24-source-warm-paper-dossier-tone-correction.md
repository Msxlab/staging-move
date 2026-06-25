# 2026-06-24 Source Warm Paper + Dossier Tone Correction

## Scope

- User reported the latest light dashboard canvas looked worse and should use the source dossier beige as the light theme background.
- Source bundle reviewed from:
  `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`
- Application source modified: yes, web only.
- Mobile source reviewed read-only. No mobile files were changed.

## Source Findings

- `project/Move.dc.html` defines the light app interior token as `bg: #EFEADF`.
- The darker greige radial in `lightPage()` is an outer prototype page background, not the full app shell surface.
- The source home dossier uses a horizontal scene-card deck with `DossierScene` stages and per-scene tone variables.
- `project/DossierScene.dc.html` contains the richer animated scenes for weather, air, water, area, transit, cost, housing, and related states.

## Web Fixes

- Set the web light app shell background to the source warm paper `#EFEADF`.
- Disabled the light-mode app-shell backdrop/grid overlay so it does not muddy the warm paper background.
- Updated browser light `theme-color` to `#EFEADF`.
- Exported source dossier scene CSS variables and applied them to each source-style dossier card parent.
- Added a regression assertion that source dossier cards carry `--ds-tone`, so their top accents and bar segments use the actual scene tone.
- Updated the free-tier contract test so it rejects the muddy outer-page radial values in the app shell.

## Mobile Read-Only Notes

- Shared tokens already define `surfaceLight.background` as `#EFEADF`.
- Mobile theme consumes that token for the light background.
- Mobile dossier cache is device-side: memory cache plus offline disk cache with a 30-minute fresh TTL by default; fresh cache avoids repeated API calls.
- Mobile `HomeDossierCard` still renders row-based ambient layers, not the source horizontal scene-card deck.
- Mobile comments/copy still contain paid-plan wording in the dossier area. This was not edited because the user asked to be notified before mobile changes.

## Verification

- `pnpm --filter @locateflow/web test -- home-dossier` passed: 2 files, 73 tests.
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract` passed: 1 file, 8 tests.
- `pnpm --filter @locateflow/web lint` passed.
- `pnpm --filter @locateflow/web build` passed.

## Build Warnings Observed

- Local Node is `v24.13.0`; repo engine asks for Node `22.x`.
- Next build reports the existing `middleware` convention deprecation.
- Next build reports a Prisma CommonJS external warning from `apps/web/src/app/api/workspaces/[id]/invitations/route.ts`.

## Design QA Status

- Result: blocked for final visual QA.
- Reason: code/tests/build are verified, but no fresh browser screenshot was captured after this local change and compared side-by-side with the source. Product Design browser fallback requires user approval before using Playwright/CLI browser capture.

## Recommended Next Action

- Push this web-only fix to the existing PR branch and let staging deploy.
- After deployment, manually verify `/dashboard` and an address dossier in light mode.
- If approved, follow with a separate mobile dossier parity pass to add the source-style scene-card deck and remove stale paid-plan dossier copy.

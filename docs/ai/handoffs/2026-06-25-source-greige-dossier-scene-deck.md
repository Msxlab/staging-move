# 2026-06-25 Source Greige + Dossier Scene Deck Handoff

## Scope

User rejected the previous light dashboard color as visually worse and reiterated that the source bundle's light theme should drive the app. This pass focused on web only:

- Source bundle inspected: `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`
- Primary source files: `project/Move.dc.html`, `project/DossierScene.dc.html`
- Application source modified: yes, web only
- Mobile source modified: no

## Source Findings

- `Move.dc.html` uses a greige radial page background for light mode, not a flat beige page wash.
- Source surfaces/cards remain white against that page background.
- Source Home Dossier uses scene-first cards with an 82px animated scene band.
- `DossierScene.dc.html` contains the animated scene matrix for weather/air/water/area/transit/cost/housing plus weather state variants.

## Changes Made

- `apps/web/src/styles/globals.css`
  - Set `.light --lf-app-bg` to the source-style radial greige gradient: `#EFEEEA -> #DEDCD3 -> #D4D2C8`.
  - Kept light dossier/dashboard surfaces white and reduced backdrop/grid wash.
  - Added `lf-dossier-source-deck` / `lf-dossier-source-card` styling for visible scene-first cards.
- `apps/web/src/components/dashboard/home-dossier.tsx`
  - Added a visual Home Dossier scene deck above detailed rows.
  - Deck cards are built from the existing `deriveDossierView` data and existing `DossierAmbient` mapper, so this does not add API calls or fabricated data.
- `apps/web/src/components/dashboard/home-dossier.test.tsx`
  - Added render guards for the scene deck/stage/bars.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Updated the theme guard to require the source radial greige shell and reject previous incorrect flat backgrounds.
- `design-qa.md`
  - Updated status and findings. Final result remains blocked until fresh browser screenshot comparison is available.
- `docs/ai/2026-06-25-source-theme-dossier-audit.md`
  - Updated source/theme/dossier audit notes.

## Verification

Passed:

- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- home-dossier`
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract`
- `pnpm --filter @locateflow/web test -- dossier-ambient route-map-card standard-font-data`
- `pnpm --filter @locateflow/web test -- "src/app/api/addresses/[id]/dossier/pdf/route.test.ts"`
- `pnpm --filter @locateflow/web test -- workspace-routes`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`

All pnpm commands warn that local Node is `v24.13.0` while the repo requests Node `22.x`.

## Remaining Risks

- Fresh staging screenshot QA is still required after deploy; this environment could not capture the current authenticated staging state.
- If dossier PDF still returns 500 on staging, the next evidence is the Dokploy runtime log for `Failed to build dossier PDF` with `code`, `message`, and `stack`.
- Mobile source-layout parity remains open. Mobile code was not changed because the user asked to be notified before any mobile edits.

## Recommended Next Action

- Commit and push this web-only fix branch, let Dokploy deploy, then verify the dashboard and Home Dossier visually on staging with a fresh hard refresh.

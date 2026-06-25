# 2026-06-24 Source Dossier Card Fidelity Pass

## Summary

Continued the source bundle integration pass against:

- `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project\Move.dc.html`
- `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project\DossierScene.dc.html`
- `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project\Raccoon.dc.html`

The source Home Dossier is a source-card system: 82px dark animated scene band, top-right tag, small uppercase label, large serif value, and full/swipe card behavior. The web implementation already has real dossier data and source scene classes, but it was still visually closer to a row list. This pass moves it closer to the source card model without changing the data contract.

## Changes

- `apps/web/src/components/dashboard/dossier-ambient.tsx`
  - Added a dedicated source `flood` scene type so FEMA flood rows are no longer represented by the drinking-water scene.
  - Added flood source scene rendering with animated water bands and risk-aware alert behavior.
  - Added a small source-style scene tag (`GOOD`, `CHECK`, `ALERT`, `AREA`) inside the scene stage.
- `apps/web/src/styles/source-dossier-scene.css`
  - Added CSS for the flood parallax water bands and bad-risk raised water state.
- `apps/web/src/styles/globals.css`
  - Added source-style top-right tag styling.
  - Tuned dossier card content hierarchy: uppercase micro label and serif, two-line-safe main value.
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
  - Updated assertions so flood now maps to the dedicated flood scene and keeps the new tag/source CSS variables covered.

## Source Bundle Coverage Notes

- `Move.dc.html`: source of app theme variables, light beige canvas, Home Dossier card model, route/ops card, countdown, service/task modules.
- `DossierScene.dc.html`: source of animated scene matrix and keyframes. Web now has a React/CSS port for weather, air, water, area, transit, cost, housing, and now flood-specific rows.
- `Raccoon.dc.html`: source character colors/geometry. Web raccoon now consumes source `--rc-*` variables with token fallbacks.
- `Move Web.dc.html` and `Web*.dc.html`: marketing/landing source concepts; not changed in this pass.
- `Admin.dc.html`: admin concept source; not changed in this pass.
- Mobile: inspected but not modified. Mobile still uses its own React Native ambient system, not the source `DossierScene` matrix, and `HomeDossierCard` still has a fixed `rgba(255,255,255,0.025)` row background that is suspect in light mode.

## Verification

- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `git diff --check -- apps/web/src/components/dashboard/dossier-ambient.tsx apps/web/src/components/dashboard/dossier-ambient.test.tsx apps/web/src/styles/globals.css apps/web/src/styles/source-dossier-scene.css`
- `pnpm --filter @locateflow/web build`

All completed successfully. The environment still warns that the repo wants Node 22.x while this machine runs Node 24.13.0.

## Remaining Known Gaps

- Web Home Dossier still does not implement the source mobile `Swipe view` / `View full` toggle exactly; the dashboard version keeps a responsive grid to fit the existing desktop product surface.
- Mobile source parity is not complete and was intentionally not changed before user approval.
- Staging must redeploy this branch before any visual change appears on `staging.locateflow.com`.

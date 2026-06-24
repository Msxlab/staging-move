# 2026-06-24 Source Dossier Scene + Clean Light Canvas Follow-Up

## Scope
- Web Home Dossier ambient scenes were aligned to the source `DossierScene(type, level)` matrix from the user-provided handoff bundle.
- Web light-mode app canvas was corrected after the global greige background made dashboard screens look muddy.
- Mobile was inspected only for parity risk; no mobile source files were changed.

## Source Evidence Used
- `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\README.md`
- `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project\Move.dc.html`
- `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project\DossierScene.dc.html`

## Code Changes
- `apps/web/src/components/dashboard/dossier-ambient.tsx`
  - Added explicit source-scene rendering for source types: `weather`, `air`, `water`, `area`, `transit`, `cost`, and `housing`.
  - Preserved source weather variants: `sun`, `cloud`, `rain`, `snow`, `storm`, `fog`, `wind`, `heat`, and `cold`.
  - Re-mapped housing to the source `housing/mid` scene instead of forcing it into `cost`.
  - Re-mapped hazard lightning/winter/wind rows to source weather scenes.
- `apps/web/src/styles/source-dossier-scene.css`
  - Added source-inspired `.ds-*` scene styles and animation keyframes.
- `apps/web/src/styles/globals.css`
  - Imported `source-dossier-scene.css`.
  - Updated inline shadcn light tokens to match the generated token model.
- `packages/shared/src/design-tokens-css.ts`
  - Changed web light global canvas from heavy greige to clean paper: `#F7F8FB`.
  - Kept subtle warmth in secondary surfaces: `#F7F3EC`.
  - Updated web shadcn light `background`, `muted`, `accent`, `border`, and `input` tokens.
  - Updated web Aurora light base tokens to the cleaner canvas ramp.
- `packages/shared/src/design-tokens.ts`
  - Updated runtime light surface tokens to match the cleaner canvas.
- `apps/web/src/app/layout.tsx`
  - Updated light `theme-color` metadata from `#EFEADF` to `#F7F8FB`.
- Generated CSS refreshed with `pnpm tokens:emit`.

## Tests Run
- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier-fetch.test.tsx src/components/ui/dialog.test.tsx src/lib/design-tokens-contrast.test.ts`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/shared test -- src/__tests__/design-tokens-emit.test.ts`
- `git diff --check`

All final runs passed. Local toolchain still warns that this machine uses Node `v24.13.0` while the repo requests Node `22.x`.

## Risks / Not Verified
- Staging browser visual QA was not performed in this pass; the corrected canvas should be verified after deploy on `/dashboard` and Home Dossier pages.
- Mobile still uses the older ambient scene contract in `apps/mobile/src/lib/home-dossier.ts` and `apps/mobile/src/components/ui/DossierAmbient.tsx`; it does not yet render the new web source-scene matrix.
- PDF export 500 was not addressed in this follow-up.
- No production deploy or merge was performed.

## Next QA
- Verify staging `/dashboard` light mode no longer has the muddy full-page greige wash.
- Verify Home Dossier rows show animated source scenes for hazard, weather, air, water, transit, area, and housing.
- Verify route-map labels in light mode remain readable.
- Re-test PDF export endpoint separately with server logs.

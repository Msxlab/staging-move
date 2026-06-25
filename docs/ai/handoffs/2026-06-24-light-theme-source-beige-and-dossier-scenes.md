# 2026-06-24 Light Theme Source Beige and Dossier Scenes

## Summary

Adjusted the web light theme back to the source prototype beige canvas and reduced the light backdrop wash that was making the dashboard look gray. Also tightened the dossier scene cards toward the source `DossierScene.dc.html` treatment: fixed 82px scene stage, 20px radius, top tone line, and source raccoon palette variables.

## Changed Source Files

- `apps/web/src/styles/globals.css`
  - Set light `--background` to source beige `#EFEADF` via HSL `41.25 33.33% 90.59%`.
  - Set light muted/accent surfaces to source warm paper values.
  - Set `--lf-app-bg` to `#EFEADF`.
  - Reduced the light app backdrop's white/blue wash so the source beige remains visible.
  - Aligned dossier scene card stage height/radius and added the source tone strip.
- `apps/web/src/components/dashboard/dossier-raccoon.tsx`
  - Made the SVG raccoon consume `--rc-head`, `--rc-mask`, `--rc-ear`, `--rc-eye`, and `--rc-pupil` with token fallbacks.
- `apps/web/src/components/dashboard/dossier-ambient.tsx`
  - Hoisted source scene CSS variables onto the ambient layer so the card-level tone strip can read the same source-derived tone.

## Verification

- `pnpm --filter @locateflow/web test -- home-dossier dossier-ambient route-map-card`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `git diff --check -- apps/web/src/styles/globals.css apps/web/src/components/dashboard/dossier-raccoon.tsx apps/web/src/components/dashboard/dossier-ambient.tsx`
- `pnpm --filter @locateflow/web build`

All commands completed successfully. The local environment still reports the existing Node engine warning because the repo wants Node 22.x and the machine is running Node 24.13.0.

## Not Changed

- Mobile source files were not modified.
- Existing unrelated local changes were not staged or altered:
  - `apps/web/src/components/marketing/landing-theme-toggle.tsx`
  - `docs/design-system/colors_and_type.css`
  - `docs/ui-renewal/30_UIUX_REMEDIATION_PLAN_2026-06-24.md`

## Manual QA

- After staging deploys this branch, verify `/dashboard` in light mode uses the warm beige page canvas, not a gray wash.
- Verify home dossier cards show a dark animated scene band at the top with the raccoon using the source palette.
- Verify route map labels still remain legible in light mode.

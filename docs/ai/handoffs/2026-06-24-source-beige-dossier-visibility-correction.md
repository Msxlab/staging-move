# 2026-06-24 Source Beige + Dossier Visibility Correction

## Scope
- Corrected the prior clean/light canvas follow-up after owner feedback that the source light theme should remain warm beige/greige.
- Kept the fix focused on web light theme, route-map label polish, and Home Dossier scene visibility.
- Mobile was inspected and tested for shared-token impact; no mobile source files were edited.

## Source Basis
- User-provided source bundle confirms light theme canvas values in `Move.dc.html`: `#EFEADF`, `#E7E1D4`, `#F5F0E7`, `#ECE6DA`.
- User feedback on 2026-06-24 rejected the prior `#F7F8FB` clean canvas direction.
- Web source code showed the prior follow-up still had `#F7F8FB` in shared/web token sources and generated CSS.

## Code Changes
- `packages/shared/src/design-tokens.ts`
  - Restored shared light surface values to the source warm beige/greige palette.
- `packages/shared/src/design-tokens-css.ts`
  - Restored web light CSS token model to the source palette.
  - Updated web Aurora light base tokens to the same palette.
- `apps/web/src/styles/_tokens.generated.css`
- `apps/web/src/styles/_aurora-tokens.generated.css`
- `apps/web/src/styles/_tokens-shadcn.generated.css`
  - Regenerated from the token model with `pnpm tokens:emit`.
- `apps/web/src/app/layout.tsx`
  - Restored light browser `theme-color` to `#EFEADF`.
- `apps/web/src/styles/globals.css`
  - Replaced the cool white/blue light app-shell backdrop with the source greige page gradient.
  - Softened route-map labels in light mode so they read as paper chips, not dark tags.
- `apps/web/src/components/dashboard/dossier-ambient.tsx`
  - Increased source-scene character ink opacity so scene states are visible in light rows.
- `apps/web/src/styles/source-dossier-scene.css`
  - Reduced scene minimum height to fit row geometry better.
  - Increased light-mode scene ground/road/background opacity so small animated elements do not disappear.

## Tests / Checks Run
- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- dossier-ambient route-map-card design-tokens-contrast`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/shared test`
- `git diff --check`
- `pnpm --filter @locateflow/mobile test -- src/lib/home-dossier.test.ts src/lib/home-dossier-cache.test.ts src/lib/dossier-raccoon.test.ts`
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- `pnpm --filter @locateflow/web build`

All passed. The local toolchain still warns that this machine runs Node `v24.13.0` while the repo requests Node `22.x`. The web build also reports existing Next middleware deprecation and Prisma CJS export warnings.

## Not Changed
- No PDF export/server-side PDF fix in this pass.
- No mobile DossierAmbient source-scene port in this pass.
- No staging deploy was performed locally.
- The existing untracked `docs/ui-renewal/30_UIUX_REMEDIATION_PLAN_2026-06-24.md` file was not staged or modified.

## Risks / Follow-Up
- Staging must be redeployed from the updated PR branch before visual feedback can change live.
- After deploy, verify `/api/build-info` or Dokploy commit matches the new commit.
- Re-test authenticated `/dashboard` light mode, Home Dossier animation states, and Route Map labels in staging.
- PDF export 500 remains a separate backend/deployment issue and should be debugged with server logs.
- Mobile still uses the older ambient implementation; shared light tokens compile/test, but source-scene parity on mobile remains a follow-up.

# 2026-06-25 Web Light Theme Correction

## Scope

- Corrected the web light-mode color regression reported from the staging dashboard screenshot.
- Kept the change focused to web theme tokens, generated CSS, browser chrome color, and regression tests.
- Mobile source was not modified.

## What Changed

- Reverted the over-applied beige app canvas by setting the web light app background to `#FBFAF6`.
- Kept the source paper accent token as `#EFEADF` for dossier/source-specific surfaces.
- Kept app chrome and panels white so large dashboard cards do not read as muddy beige.
- Updated generated web token files from `packages/shared/src/design-tokens-css.ts`.
- Updated web regression tests to lock the corrected contract:
  - app canvas: `#FBFAF6`
  - source paper accent: `#EFEADF`
  - panel/chrome surfaces: `#FFFFFF`

## Verification

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `git diff --check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/web lint`

All listed checks passed locally. The local runtime printed the existing Node engine warning because this machine uses Node `v24.13.0` while the repo requests Node `22.x`.

## Not Changed

- No mobile app files changed.
- No admin app source changed.
- No deployment configuration changed.
- No dependency files changed.

## Follow-Up

- After this branch deploys, verify the staging dashboard light-mode screenshot against the corrected `#FBFAF6` canvas.
- Continue the separate dossier animation/PDF/mobile audit work from source files; this handoff only covers the color regression correction.

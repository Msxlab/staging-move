# 2026-06-25 Web Source Beige Canvas Correction

## Summary

Corrected the prior light-canvas hotfix direction. The external source bundle sets the light theme paper/canvas to `#EFEADF`, and the web app shell should use that beige background in light mode. The app now keeps `--lf-app-bg: #EFEADF` while preserving the cleaner white/chrome panel opacity that prevents dashboard cards from looking muddy.

## Code Changes

- `apps/web/src/styles/globals.css`
  - Restored light `--lf-app-bg` to `#EFEADF`.
  - Kept higher white panel opacity from the prior pass.
- `apps/web/src/styles/aurora.css`
  - Clarified comments: full source beige canvas remains; app panels stay clean paper.
- `apps/web/src/app/layout.tsx`
  - Restored light browser `theme-color` to `#EFEADF`.
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
  - Re-pinned the source light paper canvas contract.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Re-pinned consumer-free/theme contract to require the source beige app canvas.

## Verification

- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`

All passed. Local Node still emits the existing engine warning: repo wants Node 22.x, local Node is v24.13.0.

## Notes

- This only corrects the web light canvas direction.
- Source-bundle parity audit for dossier animations, mobile, admin, PDF, workspace, and broader UI/UX remains active.

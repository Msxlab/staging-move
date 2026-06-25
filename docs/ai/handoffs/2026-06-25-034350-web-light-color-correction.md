# 2026-06-25 Web Light Color Correction

## Context
- User reported the latest light-mode dashboard color pass looked significantly worse.
- The bad change was the desktop app shell being forced to a flat `#EFEADF` canvas and broad app-shell gradient utility overrides that made the page feel muddy.

## Changes Made
- Restored the web app shell to the previous lifted warm gradient:
  `#FFFFFF -> #FAF8F3 -> #F3EFE6 -> #EFEADF`.
- Kept `#EFEADF` as the source warm-paper token instead of using it as the entire desktop canvas.
- Restored the subtle light shell backdrop grid/highlight at low opacity.
- Removed the broad app-shell `bg-gradient-to-br` background-color override.
- Kept source dossier and route animation fixes intact.
- Updated the web visual contract tests to prevent the flat muddy shell regression from returning.

## Files Changed
- `apps/web/src/styles/globals.css`
- `apps/web/src/styles/aurora.css`
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`

## Verification
- `pnpm --filter @locateflow/web test -- dossier-ambient pricing-free-tier-contract`
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card move-briefing-card move-command-center pricing-free-tier-contract`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`

## Notes
- Local Node still warns that the project wants Node `22.x`; this workstation is using Node `v24.13.0`.
- No mobile files, deployment config, environment files, production data, or dependencies were changed.

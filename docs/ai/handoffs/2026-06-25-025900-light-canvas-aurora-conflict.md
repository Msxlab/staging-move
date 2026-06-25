# 2026-06-25 02:59 - Light Canvas / Aurora Conflict Handoff

## Summary

Corrected the web light theme after the temporary `#F8F5EE` app canvas made staging look worse. The source prototype uses `#EFEADF` as the light app paper, so the app shell now uses `#EFEADF` again while dashboard/chrome panels stay crisp white.

## Root Cause

`globals.css` set cleaner app-shell panel tokens, but `aurora.css` is imported after `globals.css` in `apps/web/src/app/layout.tsx`. Its `.light .lf-aurora .bg-*` utility overrides had equal/later cascade strength and reintroduced muddy translucent panels over the warm paper.

## Changed Source Files

- `apps/web/src/styles/globals.css`
  - Restored light app canvas to source `#EFEADF` / `41.25 33.33% 90.59%`.
  - Tightened chrome/panel tokens to white/near-white so beige stays in the page background, not in card interiors.
- `apps/web/src/styles/aurora.css`
  - Aligned `.light .lf-aurora` HSL tokens with source `#EFEADF`.
  - Added higher-specificity `.light .lf-aurora .lf-app-shell ...` overrides so Aurora cannot override app-shell panel decisions.
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
  - Updated regression expectations for source `#EFEADF` app canvas and Aurora/app-shell cascade guard.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Updated the consumer-free/theme contract so `#EFEADF` is the light web app canvas and `#F8F5EE` cannot come back as `--lf-app-bg`.

## Checks Run

- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract dossier-ambient`
- `pnpm --filter @locateflow/web test -- route-map-card household-activation-card`
- `pnpm --filter @locateflow/web test -- home-dossier-fetch service-worker-cache service-worker-shutoff address-data-cache`
- `pnpm --filter @locateflow/web test -- "src/app/api/addresses/[id]/dossier/pdf/route.test.ts" "src/lib/pdf/standard-font-data.test.ts"`

All passed locally. Local Node is `v24.13.0`; package warning still says repo wants Node `22.x`.

## Remaining Notes

- No mobile source files were changed.
- Staging PDF 500 still needs deployed-runtime/log verification; local PDF regression tests were already passing in the current codebase before this handoff.
- Visual confirmation still needs a staging/local browser screenshot after deployment because the user is judging exact color quality from the running page.

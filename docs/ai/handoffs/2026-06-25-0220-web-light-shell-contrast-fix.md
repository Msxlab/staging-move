# Web Light Shell Contrast Fix Handoff

Date: 2026-06-25
Branch: `fix/ui-ux-remediation`
Commit: `65722ab7 fix(web): restore light shell surface contrast`

## Context

The previous web light-theme change rendered the raw source paper color `#EFEADF` across the full app shell. On the dense web dashboard this made the viewport and cards read as one muddy beige layer. The intended source model is paper canvas plus clean white surfaces, not a full-screen beige wash.

## Changed

- Restored the app shell to a white-led warm paper gradient.
- Kept the raw source paper color as `--lf-source-paper-bg: #EFEADF`.
- Kept chrome and panel surfaces white through `--lf-app-chrome-bg-strong` and `--lf-app-panel-bg-strong`.
- Added light-mode overrides for app-shell `bg-background/*` utilities so dashboard cards do not inherit the raw paper tone.
- Updated existing web tests to enforce the source-token vs. web-surface separation.

## Files

- `apps/web/src/styles/globals.css`
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`

## Verification

- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract dossier-ambient`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`
- `pnpm --filter @locateflow/web build`

## Notes

- Build passed with existing non-blocking warnings: local Node is `v24.13.0` while package asks for `22.x`, Next middleware convention warning, Prisma CommonJS external export warning, and edge runtime static-generation warning.
- No mobile source was modified in this fix.
- Live browser visual QA was not completed in this turn because no direct Chrome-control tool was available in the session.

# 2026-06-25 Light Canvas Regression Fix

## Summary

The prior light theme change bound the full authenticated app shell directly to the source Greige token (`#EFEADF`). On the dashboard this made the entire page read muddy, especially under translucent cards. This fix keeps the source Greige token available for product surfaces while moving the full app canvas back to a cleaner pearl background.

## Source Changes

- `apps/web/src/styles/globals.css`
  - Light app shell background now uses `#FBFAF7` instead of raw `var(--bg)`.
  - Light shell backdrop no longer uses grid line overlays; it now adds only a subtle warm top wash and faint blue balance.
- `apps/web/src/components/layout/app-shell.tsx`
  - Embed/mobile-browser app shell now uses the same `--lf-app-bg` fallback chain.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Updated the contract so `#EFEADF` remains the generated source token but is not allowed to flood the full light app canvas.

## Verification

- `pnpm --filter @locateflow/web test -- src/lib/pricing-free-tier-contract.test.ts src/components/dashboard/home-dossier.test.tsx`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`

All checks passed. Local pnpm still reports the repo wants Node 22.x while this machine is running Node v24.13.0.

## Notes

No mobile source changes were made in this fix.

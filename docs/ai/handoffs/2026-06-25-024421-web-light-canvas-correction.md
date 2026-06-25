# 2026-06-25 Web Light Canvas Correction

## Summary
- Corrected the light-mode web app canvas after staging showed the dashboard as too muddy/grey-beige.
- Kept the source dossier/mobile paper token `#EFEADF` available as `--lf-source-paper-bg`.
- Changed the broader authenticated web app shell to a cleaner warm wash `#F8F5EE` so transparent dashboard panes stay bright.

## Changed Files
- `apps/web/src/styles/globals.css`
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`

## Tests Run
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract dossier-ambient`

## Notes
- Application source code was modified.
- Mobile source was not modified.
- Deployment was not performed from this workspace.

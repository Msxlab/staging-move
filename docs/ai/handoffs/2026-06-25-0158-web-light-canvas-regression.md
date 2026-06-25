# 2026-06-25 Web Light Canvas Regression Follow-up

## Scope
- Responded to staging visual regression feedback where the light dashboard canvas became too beige/muddy after mapping the source `#EFEADF` token to the full web app shell.
- Source bundle comparison remains in progress; this handoff only records the quick color correction and current verified notes.

## Changed
- Restored the web app shell light canvas to a white-led warm-paper derivative:
  - `--lf-app-bg: linear-gradient(180deg, #FFFFFF 0%, #FBFAF7 58%, #F6F2EA 100%)`
- Kept the source `#EFEADF` token available in generated/shared tokens; it is no longer applied as the full dashboard shell background.
- Updated tests so the bad full-screen beige mapping cannot return unnoticed.

## Files changed
- `apps/web/src/styles/globals.css`
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`

## Verification
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract dossier-ambient`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`

## Notes
- Branch pushed: `fix/ui-ux-remediation`
- Latest commit pushed: `780f77ed fix(web): restore clean light app canvas`
- GitHub combined status for the latest commit returned no statuses.
- The staging deployment will still look wrong until Dokploy deploys a branch/merge that contains `780f77ed`.

## Open Follow-ups
- Continue source bundle parity review for dossier scene visibility and theme scoping.
- Confirm PDF 500 from staging logs; local route/generator tests already cover the previously known shape-mismatch failure, so staging runtime logs are needed if it still fails after the latest deploy.
- Mobile cache/theme parity was read-only inspected; no mobile source changes were made in this follow-up.

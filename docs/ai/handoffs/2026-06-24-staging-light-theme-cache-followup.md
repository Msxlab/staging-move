# 2026-06-24 Staging Light Theme + Dossier Cache Follow-Up

## Scope
- Continued PR #51 on `codex/staging-dialog-workspace-followup`.
- Focused on the staging dashboard light-mode regression, dossier scene visibility, web dossier cache behavior, and PDF regression verification.
- Application source code was modified.

## Changes
- Restored light-mode card surfaces to white while keeping the page canvas warm beige.
- Replaced the muddy light dashboard backdrop gradient with a cleaner warm paper background and lighter grid.
- Increased dossier ambient scene visibility in web rows without changing mobile.
- Added short-lived `sessionStorage` caching for the web Home Dossier widget using the server `Cache-Control: max-age` TTL.
- Added a browser-environment regression test for the Home Dossier fetch cache.

## Verification
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/home-dossier-fetch.test.tsx src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx "src/app/api/addresses/[id]/dossier/pdf/route.test.ts" src/lib/pdf/standard-font-data.test.ts`
- `pnpm --filter @locateflow/web exec tsc --noEmit`

## Notes
- Local commands still warn that this machine is running Node `v24.13.0`; repo target is Node `22.x`.
- Live authenticated PDF 500 still needs Dokploy route logs to identify the exact staging runtime error if it persists after this PR deploys.
- Mobile was inspected earlier but not changed in this follow-up.

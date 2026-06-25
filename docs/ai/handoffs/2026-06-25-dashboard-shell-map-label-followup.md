# Handoff - Dashboard shell/map label follow-up

Date: 2026-06-25
Branch: `fix/ui-ux-remediation`

## What Changed

- Corrected the authenticated light dashboard shell after the beige wash made staging look muddy.
- Kept the source `#EFEADF` token intact but stopped using beige as the full app shell background.
- Increased route-map label contrast in light mode.
- Updated the pricing/free-tier contract test to guard against reintroducing a beige-flooded authenticated shell.
- Added a source/theme/dossier audit note under `docs/ai/2026-06-25-source-theme-dossier-audit.md`.
- Updated `design-qa.md` with `final result: blocked` because a fresh staging screenshot could not be captured in this environment.

## Files Changed

- `apps/web/src/styles/globals.css`
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
- `design-qa.md`
- `docs/ai/2026-06-25-source-theme-dossier-audit.md`
- `docs/ai/handoffs/2026-06-25-dashboard-shell-map-label-followup.md`

## Verified From Code

- Web Home Dossier cache uses browser `sessionStorage` plus server in-process cache; service worker does not cache `/api/*`.
- Mobile Home Dossier cache uses memory + disk/offline cache and falls back to cached data on network error.
- Dossier source scene code is wired into web rows, but source-vs-staging visual parity is not proven without a fresh screenshot.
- PDF generator route and real generator tests pass locally; staging 500 now requires Dokploy runtime log details.
- Workspace creation/invites remain gated by `WORKSPACE_MODEL_ENABLED`, independent of `CONSUMER_FREE`.

## Tests Run

- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract`
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract home-dossier dossier-ambient route-map-card standard-font-data`
- `pnpm --filter @locateflow/web test -- "src/app/api/addresses/[id]/dossier/pdf/route.test.ts"`
- `pnpm --filter @locateflow/web test -- workspace-routes`
- `pnpm --filter @locateflow/mobile test -- HomeDossier home-dossier`

## Known Test Noise

- A broad test glob also matched unrelated partner OAuth route tests and hit two 5s timeouts. The targeted tests above passed.
- Every `pnpm` command warned that local Node is `v24.13.0`; repo engine requests Node `22.x`.

## Remaining Work

- Push/deploy this branch and capture a fresh staging dashboard screenshot.
- Check Dokploy runtime logs for `Failed to build dossier PDF` with `code/message/stack`.
- Confirm deployment runtime config has `WORKSPACE_MODEL_ENABLED=true` if shared workspaces should be active on staging.
- Decide whether web Home Dossier should remain data-row based or be rebuilt into the source bundle's scene-card rail.

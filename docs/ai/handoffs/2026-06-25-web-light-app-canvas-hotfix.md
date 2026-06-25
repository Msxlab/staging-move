# 2026-06-25 Web Light App Canvas Hotfix

## Summary

Responded to visual QA feedback that the latest light-mode dashboard looked overly muddy/beige. The hotfix keeps the source bundle's warm paper token available for dossier/source-specific surfaces, but stops using that same beige as the entire web app shell background.

## Code Changes

- `apps/web/src/styles/globals.css`
  - Changed light `--lf-app-bg` from solid `#EFEADF` to a cleaner pearl-to-warm gradient.
  - Raised light panel opacity so dashboard cards read as white/clean rather than translucent beige.
  - Updated navigation comment to reflect the source-paper opt-in split.
- `apps/web/src/styles/aurora.css`
  - Increased light Aurora card/panel opacity for cleaner web surfaces.
  - Updated comments to document that source beige is no longer the full app canvas.
- `apps/web/src/app/layout.tsx`
  - Updated light `theme-color` from `#EFEADF` to `#F7F9FC`.
- `apps/web/src/components/dashboard/dossier-ambient.test.tsx`
  - Updated the dossier/theme contract test so source paper remains opt-in while app shell stays clean.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Updated the consumer-free/theme contract to reject solid beige app shell regression.

## Verification

- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`

All commands passed. Local Node still reports the existing engine mismatch warning: repo wants Node 22.x, local machine has Node v24.13.0.

## Git

- Branch: `fix/ui-ux-remediation`
- Commit: `94fd57d7 fix(web): clean up light app canvas`
- Remote branch confirmed at `94fd57d7f5c278d802ca3d2007f82fdff8b6cb66`.

## Notes

- Existing PR #59 should update from the branch push.
- Staging will not show this hotfix until the PR branch is merged and Dokploy deploys the new commit.
- This did not address remaining PDF export, mobile parity, admin parity, or deeper source-bundle audit items.

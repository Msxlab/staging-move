# 2026-06-25 Light Theme Color Correction

## Summary
- Corrected the web light app canvas after the previous full-beige shell made dashboard surfaces look muddy.
- Kept the source bundle's warm beige direction as a subtle undertone, but moved the main web shell to a cleaner warm pearl background.
- Increased light-mode dashboard/card utility opacity so `bg-foreground/*` and top dashboard gradients render closer to crisp white surfaces instead of blending into the beige page.

## Changed Files
- `apps/web/src/styles/globals.css`

## Validation
- `git diff --check`
- `pnpm --filter @locateflow/web lint`

## Notes
- `pnpm` warned that the repo wants Node `22.x`; this workstation is running Node `v24.13.0`.
- No mobile, admin, PDF, cache, entitlement, or deployment config files were changed in this correction.

## Manual QA
- Re-open staging dashboard in light mode after Dokploy deploys this PR head.
- Confirm the page background reads warm/clean rather than grey-brown.
- Confirm dashboard cards, briefing, command center, and up-next panels keep visible separation from the page canvas.

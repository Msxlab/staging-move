# 2026-06-24 Light Shell Color Regression Follow-up

## Context

Staging dashboard light mode looked muddier after restoring source warm-paper colors. Code comparison against `Move.dc.html` showed the source light model separates:

- App paper: `#EFEADF`
- Cards/surfaces: `#FFFFFF`
- Secondary warm surface: `#F5F0E7`
- Light hero gradient: `linear-gradient(135deg,#FFFFFF,#F4EFE5)`

The web authenticated shell had moved the whole app canvas to `#F5F0E7` and retained dark-first blue/ink gradient utilities on top cards. That made the dashboard read as gray-beige instead of warm paper with clean white surfaces.

## Changes

- `apps/web/src/styles/globals.css`
  - Set authenticated light shell background to source app paper `#EFEADF`.
  - Removed the faint grid/blue backdrop from light mode and replaced it with a soft white top sheen.
  - Scoped light-mode `from-primary/5`, `from-primary/10`, `from-primary/15`, `via-primary/5`, and `via-foreground/[0.03]` overrides to `.lf-app-shell`, so authenticated dashboard hero/cards use source-like warm white gradients without changing solid primary buttons.

## Verification

- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card pricing-free-tier-contract marketing-header pricing-section plan-compare-table`
- `pnpm --filter @locateflow/web exec tsc --noEmit`

All passed locally. Local Node warning remains: repo wants Node `22.x`; machine is `v24.13.0`.

## Remaining QA

Browser/Chrome capture tools are not exposed in this Codex session, so Product Design visual QA cannot honestly be marked passed from screenshots here. After Dokploy deploys the pushed branch, verify `/dashboard`, dossier rows, route map labels, and `/settings/workspace` in staging light mode.

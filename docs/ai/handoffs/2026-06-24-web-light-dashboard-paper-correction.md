# Web Light Dashboard Paper Correction

Date: 2026-06-24

## Scope

- Responded to staging dashboard feedback that the light theme looked too grey and washed out after the warm-paper change.
- Web only. Mobile/shared tokens were intentionally not changed.

## Source Basis

- `Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html` defines the light source family:
  - app canvas `#EFEADF`
  - secondary paper `#F5F0E7`
  - white surface `#FFFFFF`
- On the production web dashboard, the phone-sized canvas tone was reading too flat on a wide layout because translucent cards and gradients let the canvas show through.

## Changes

- Updated the web light app shell canvas from `#EFEADF` to source secondary paper `#F5F0E7`.
- Increased light dashboard gradient opacity so top cards read as clean white surfaces instead of grey haze.
- Increased light app-shell `bg-foreground/*` utility remaps for dashboard cards and controls.
- Left route-map label light overrides in place; current branch already maps those pills to light surfaces.

## Files Changed

- `apps/web/src/styles/globals.css`

## Validation

- `pnpm --filter @locateflow/web test -- route-map-card`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`

## Notes

- Local build still warns that the machine is on Node `v24.13.0` while the repo wants Node `22.x`.
- Next build also still emits the existing middleware/proxy deprecation and Prisma CommonJS warning from the workspace invitations route.
- `apps/web/next-env.d.ts` was touched by Next build and restored before commit.

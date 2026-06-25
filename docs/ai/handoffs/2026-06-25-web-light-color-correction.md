# Web light color correction handoff

Date: 2026-06-25
Branch: `fix/ui-ux-remediation`
PR: https://github.com/Msxlab/staging-move/pull/59

## Context

Staging feedback reported that the light dashboard became too muddy and grey-beige after the warm paper pass. The screenshot showed the dashboard background and large cards blending together with poor layer separation.

## Changes made

- Tuned the web light app shell in `apps/web/src/styles/globals.css`.
- Reduced the full-page warm paper weight from the heavy source-paper tone to a cleaner warm ivory app background.
- Restored crisp white app chrome for the sidebar/header.
- Added app-shell scoped light panel variables so dashboard `bg-foreground/*`, `bg-white/*`, and gradient utilities resolve to white or warm-white panels instead of a grey translucent veil.
- Added light-only dossier shell/row/stat overrides so the source dossier scene remains animated while the surrounding surfaces read cleaner.

## Verification

- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web test -- route-map-card home-dossier dossier-ambient`
- `pnpm --filter @locateflow/web build`
- `git diff --check`

All checks passed. Local Node is still `v24.13.0` while the repo expects Node `22.x`; this warning also appeared in previous checks.

## Not changed

- No mobile source was edited.
- No production configuration, environment files, dependencies, database logic, or deployment configuration was changed.
- Staging visual QA is not verified until PR #59 is merged and Dokploy deploys this head commit.


# Web Dashboard Light Canvas Hotfix - 2026-06-25

## Scope
- User reported the staging dashboard light-mode canvas became too muddy/beige after the dossier theme pass.
- This handoff covers the web-only color hotfix. Mobile, admin, PDF runtime, and deployment operations were not changed.

## Verified From Source
- `apps/web/src/components/layout/app-shell.tsx` paints the authenticated app shell with `var(--lf-app-bg, var(--bg))`.
- `apps/web/src/styles/_tokens.generated.css` still exposes the source warm-paper token `--bg: #EFEADF`.
- `apps/web/src/styles/globals.css` light-mode shell override had been changed to flat `--lf-app-bg: #EFEADF`, which washed the dense dashboard canvas.

## Changes
- Restored the web authenticated app shell to a white-led warm-paper derivative:
  `linear-gradient(180deg, #FFFFFF 0%, #FBFAF7 58%, #F6F2EA 100%)`.
- Kept the source token in generated design tokens untouched.
- Updated dossier/theme contract tests so the flat beige app shell cannot come back accidentally.

## Validation
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract dossier-ambient home-dossier`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`
- `git diff --check`

## Notes
- Local Node is `v24.13.0`; repo requests Node `22.x`, so pnpm prints an engine warning during checks.
- Next build still prints existing warnings for middleware/proxy deprecation, Prisma CJS export, and Edge runtime static generation.
- No source changes were made to mobile, admin, PDF generation, pricing/billing, environment, or deployment configuration.

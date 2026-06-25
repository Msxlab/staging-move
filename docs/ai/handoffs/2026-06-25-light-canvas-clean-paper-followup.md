# 2026-06-25 Light Canvas Clean Paper Follow-up

## Scope

- Web light-mode canvas follow-up after staging visual feedback showed the raw source beige token looked too heavy on the wide dashboard surface.
- No mobile, admin, deployment, environment, dependency, or production configuration changes.

## Changed

- `apps/web/src/styles/globals.css`
  - Replaced the raw `--lf-app-bg: var(--bg)` canvas with a cleaner source-paper mix:
    `color-mix(in srgb, var(--bg) 56%, #FFFFFF 44%)`.
  - Reduced the light app-shell backdrop weight:
    - warmer highlight opacity lowered,
    - white veil made cleaner,
    - grid opacity lowered,
    - overall backdrop opacity reduced from `0.34` to `0.28`.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Updated the contract so the app keeps a warm paper canvas without reverting to raw heavy beige, old white-heavy mixes, or radial page backgrounds.

## Verification

- `git diff --check`
- `pnpm --filter @locateflow/web test -- src/lib/pricing-free-tier-contract.test.ts src/components/dashboard/route-map-card.test.tsx src/components/dashboard/home-dossier.test.tsx src/components/dashboard/dossier-ambient.test.tsx`
- `pnpm --filter @locateflow/web lint`

## Notes

- Local Node warning remained: repo expects Node `22.x`; local runtime is Node `v24.13.0`.
- The source bundle still verifies `#EFEADF` as the light source token, but applying it directly to the full desktop app shell made the dashboard read muddy. The new mix keeps the source warmth while preserving clean desktop readability.

# WCAG Light Contrast Handoff

## Task

Owner-approved light-mode WCAG AA contrast hardening for home, sign-in, sign-up, and pricing. No deploy, no secrets, no production data access.

## Changed Files

- `packages/shared/src/design-tokens.ts`
- `apps/web/src/styles/globals.css`
- `apps/web/src/styles/aurora.css`
- `apps/mobile/src/lib/theme.ts`
- `apps/web/src/app/sign-in/page.tsx`
- `apps/web/src/app/sign-up/page.tsx`
- `apps/web/src/lib/design-tokens-contrast.test.ts`
- `apps/web/tests/e2e/accessibility.spec.ts`
- `docs/ai/handoffs/2026-06-17-172314-wcag-light-contrast.md`

## What Changed

- Darkened light-mode primary/info blue, warning/pro honey, success/family teal, free/coral, and destructive/coral text tokens so normal text clears 4.5:1 on light paper and tinted surfaces.
- Mirrored the light token changes across shared tokens, web global theme variables, web Aurora wrapper variables, and mobile theme variables.
- Updated light-mode primary button gradient stops so white text clears contrast.
- Added always-visible underlines to sign-in/sign-up inline account-switching links so links are not distinguished by color alone.
- Extended Playwright accessibility coverage to run home, sign-in, sign-up, and pricing in both light and dark modes.
- Added a Vitest contrast guard for shared light tonal, plan, and semantic tokens.

## Before / After Contrast Ratios

| Token / Surface | Before | After |
| --- | ---: | ---: |
| Primary/info blue on page paper | 4.02 | 5.95 |
| Primary/info blue on 10% blue tint | 3.32 | 4.91 |
| Warning/pro honey on tinted fill | 2.49 | 5.07 |
| Success/family teal on tinted fill | 2.58 | 4.84 |
| Free/coral on subtle plan fill | 2.90 | 5.20 |
| Destructive/coral on soft fill | 3.34 | 4.82 |
| White on light primary button gradient top | 3.42 | 6.56 |

## Verification

- `pnpm install --frozen-lockfile` passed; warning only: local Node `v24.13.0` vs repo engine `22.x`.
- `pnpm --filter @locateflow/web test -- src/lib/design-tokens-contrast.test.ts` passed: 1 file, 3 tests.
- `pnpm --filter @locateflow/web exec playwright test tests/e2e/accessibility.spec.ts --project=chromium --workers=1` passed: 8 tests, light + dark coverage for home/sign-in/sign-up/pricing.
- `pnpm verify:typecheck` passed.
- `pnpm --filter @locateflow/mobile test` passed: 30 files, 293 tests.

## Risks / Notes

- The light palette is intentionally darker but keeps the Aurora hue family and token names stable.
- Dark-mode tokens were not darkened; Playwright dark-mode a11y coverage passed after the test extension.
- No deploy, no production data access, no secrets, no flag or billing changes.

## Recommended Next Action

- Review the visual delta on the four covered surfaces in the PR preview, then merge when design/product accepts the slightly darker light-mode accent ink.

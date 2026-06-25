# Light Shell Desaturation Follow-up

Date: 2026-06-25

## Trigger

The user reported that the latest staging dashboard light-mode color became materially worse. The provided screenshot showed the dashboard canvas and grid reading as a muddy beige/grey wash.

## Verified From Code

- `apps/web/src/styles/_tokens.generated.css` still carries the source light token `--bg: #EFEADF`.
- `apps/web/src/styles/globals.css` was using the raw source token through `.light { --lf-app-bg: var(--bg); }`.
- `apps/web/src/components/layout/app-shell.tsx` applies `background: var(--lf-app-bg, var(--bg))`, so the raw token was being applied to the whole authenticated app shell.

## Change Made

- Kept `#EFEADF` as the source/theme token.
- Stopped flooding the full app shell with raw beige.
- Changed the light app shell to a white-to-warm-paper gradient using only 18% of `var(--bg)`.
- Reduced the light backdrop/grid opacity from `0.14` to `0.08`.
- Updated the guard test so it preserves the source beige token while rejecting raw shell flooding.

## Files Changed

- `apps/web/src/styles/globals.css`
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
- `design-qa.md`
- `docs/ai/handoffs/2026-06-25-light-shell-desaturation-followup.md`

## Checks Run

- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract home-dossier dossier-ambient`

Both passed. The shell reported the existing Node engine warning: repo expects Node 22.x, local shell has Node v24.13.0.

## Not Changed

- Did not touch mobile code.
- Did not touch unrelated working tree changes in `apps/web/src/app/(app)/dashboard/page.tsx` or `apps/web/src/lib/user-preferences.ts`.
- Did not attempt production deploy or merge.

## Remaining Risks

- Browser/Chrome control was not available in this session, so a fresh same-state staging screenshot comparison could not be completed.
- Home dossier visual parity is still not fully solved: the source prototype uses prominent scene-card bands, while the current web dossier remains a detailed data-row implementation with scene bands grafted onto rows.
- Staging must rebuild the latest pushed commit before the user can judge the corrected color.

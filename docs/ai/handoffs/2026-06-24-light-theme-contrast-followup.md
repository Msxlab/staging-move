# Light Theme Contrast Follow-up - 2026-06-24

## Summary

Follow-up to the light-theme dashboard feedback: the prior warm-paper canvas was reading too gray and low-contrast when applied across the full app shell. This update keeps a warm paper direction but lightens the canvas and raises card/glass opacity so dashboard panels separate from the background again.

## Source Code Modified

Yes.

## Changed Files

- `packages/shared/src/design-tokens-css.ts`
- `apps/web/src/styles/_tokens.generated.css`
- `apps/web/src/styles/_tokens-shadcn.generated.css`
- `apps/web/src/styles/globals.css`

## Changes

- Changed web light canvas from direct source beige `#EFEADF` to cleaner warm paper `#FAF7F0`.
- Lightened warm secondary surfaces to `#FFF9F0` and `#F6EFE4`.
- Raised light-mode glass/card opacity from `0.55` to `0.78`.
- Reduced the app shell backdrop opacity from `0.48` to `0.32` so the page no longer gets a gray wash.
- Raised light-mode `bg-foreground/*` utility overrides so dashboard cards render closer to white instead of blending into the page.

## Tests Run

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- move-briefing-card dossier-ambient home-dossier route-map-card`

## Risks

- This is a visual calibration change. It should be checked on staging after deploy against the dashboard screenshot that triggered the feedback.
- Local commands warned that Node `v24.13.0` is installed while the repo expects Node `22.x`.

## Manual QA

- Open `/dashboard` in light mode.
- Confirm the page still feels warm but no longer muddy/gray.
- Confirm briefing, command center, up next, and dashboard cards read as distinct surfaces.
- Confirm dark mode was not visually regressed.

## Recommended Next Action

Deploy the updated PR branch to staging, then capture the dashboard and dossier screens again for visual comparison.

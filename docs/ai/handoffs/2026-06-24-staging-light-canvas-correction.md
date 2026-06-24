# 2026-06-24 Staging Light Canvas Correction

## Context

The staging dashboard light theme looked muddy after the earlier beige-canvas pass. The broad page backdrop was applying too much warm greige across the full viewport, reducing contrast on dashboard cards and making the page look dirty.

## Source Changes

- Changed the web light canvas token from warm greige to a cleaner neutral canvas: `#F7F8FA`.
- Kept warm paper accents on secondary/elevated surfaces instead of using beige as the full-page wash.
- Updated web shadcn light background, muted, accent, border, and input HSL values to match the cleaner canvas.
- Updated the web Aurora light base/pane tokens so light-mode glass panels read whiter and clearer.
- Reworked `.light .app-shell-backdrop` to remove the full-page beige gradient and keep only a subtle grid/top sheen.
- Updated the light browser `theme-color` meta tag to `#F7F8FA`.

## Verification

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/home-dossier-fetch.test.tsx src/components/dashboard/dossier-ambient.test.tsx src/components/ui/dialog.test.tsx apps/web/src/lib/design-tokens-contrast.test.ts`
- `pnpm --filter @locateflow/web test -- src/lib/design-tokens-contrast.test.ts`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `git diff --check`

All checks passed. Local command output still shows the existing Node engine warning because the repo expects Node 22.x and this machine is running Node v24.13.0.

## Notes

- This change is web-only. Mobile shared runtime tokens were intentionally not changed in this pass.
- The earlier invite dialog focus fix and home dossier browser-session cache fix remain untouched.

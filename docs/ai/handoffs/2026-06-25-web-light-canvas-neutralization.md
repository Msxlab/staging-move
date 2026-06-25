# 2026-06-25 Web Light Canvas Neutralization

## Context

The staging dashboard light theme rendered too warm/muddy after the previous app-canvas change. The broad beige family was leaking into dashboard panels and utility backgrounds, making the UI look dirty and low contrast.

## Changes

- Changed the web light app canvas from warm off-white `#FBFAF6` to neutral `#F8FAFC`.
- Changed light muted/accent HSL tokens from warm beige values to neutral slate values.
- Changed general light `surface-2`, `surface-3`, `surface-secondary`, and Aurora base tokens away from beige.
- Kept `--lf-source-paper-bg: #EFEADF` only as an opt-in source/dossier paper accent.
- Forced light app-shell low-opacity foreground/background utility panels back to white surfaces.
- Updated AppShell and browser `theme-color` fallbacks to the neutral light canvas.
- Updated regression tests so beige cannot become the global app canvas again.

## Verification

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/web lint`

All checks passed. Commands emitted a local Node engine warning because this machine uses Node v24.13.0 while the repo requests Node 22.x.

## Notes

- Mobile source files were not changed.
- No deployment was performed from Codex.

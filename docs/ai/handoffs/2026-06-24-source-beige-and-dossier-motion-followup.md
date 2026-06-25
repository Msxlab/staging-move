# 2026-06-24 - Source beige and dossier motion follow-up

## Scope

- Restore the web light theme canvas to the source prototype beige values from `Move.dc.html`.
- Keep web generated tokens, inline shadcn tokens, and shared CSS token source in sync.
- Make the public marketing dossier demo show the dossier scene range instead of one frozen sample state.
- Analyze mobile theme/cache/dossier state without modifying mobile code.

## Source evidence used

- Source bundle file inspected: `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project\Move.dc.html`
- Source light token values in `Move.dc.html`:
  - `bg: "#EFEADF"`
  - `bg2: "#E7E1D4"`
  - `surface: "#FFFFFF"`
  - `surface2: "#F5F0E7"`
  - `surface3: "#ECE6DA"`
- Source `lightPage()` uses a greige gradient family based around the same warm-paper palette.

## Changes made

- `packages/shared/src/design-tokens-css.ts`
  - Restored web `.light` tokens to the source beige family.
  - Restored shadcn-compatible `--background`, `--muted`, `--accent`, and `--surface-secondary` to match the source palette.
- `apps/web/src/styles/_tokens.generated.css`
  - Regenerated from the shared token source.
- `apps/web/src/styles/_tokens-shadcn.generated.css`
  - Regenerated from the shared token source.
- `apps/web/src/styles/globals.css`
  - Updated the inline light block via `pnpm tokens:emit`.
  - Restored `--lf-app-bg` to `#EFEADF`.
  - Kept the row content above right-side dossier scenes so labels remain readable.
- `apps/web/src/components/marketing/dossier-showcase.tsx`
  - Replaced single sample-derived ambient states with a reduced-motion-safe demo cycle.
  - Rows now rotate through flood, weather, hazard, radon, air, and neighborhood scene states while the visible copy remains marked as demo/sample data.

## Mobile analysis

- No mobile files were modified.
- Mobile shared light tokens already use the source beige family through `packages/shared/src/design-tokens.ts` and `apps/mobile/src/lib/theme.ts`.
- Mobile dossier cache is user-device based:
  - `apps/mobile/src/lib/home-dossier-cache.ts` uses memory cache plus offline storage with a 30 minute default freshness window.
  - On request failure it can fall back to cached/stale data.
- Mobile likely visual risk found but not changed:
  - `apps/mobile/src/components/ui/HomeDossierCard.tsx` uses a very faint row background (`rgba(255,255,255,0.025)`) that is probably too weak on the light beige canvas.

## Tests run

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card pricing-free-tier-contract marketing-header pricing-section plan-compare-table`
- `pnpm --filter @locateflow/web exec tsc --noEmit`

All commands passed locally.

## Verification limits

- No deployment was performed.
- Browser/Chrome capture tools were not available in this Codex session, so Product Design visual QA cannot be marked as passed from same-state screenshots.
- Staging may still show stale deployed CSS until Dokploy builds and serves this branch/merge.

## Recommended next action

1. Let Dokploy deploy the pushed branch/PR merge, then re-check staging CSS for `#EFEADF` and absence of `#FAF7F0`.
2. Capture same-state light dashboard and dossier screenshots against the source target before calling visual QA passed.
3. Before changing mobile, review the light-mode `HomeDossierCard` row background and dossier scene contrast with device screenshots.

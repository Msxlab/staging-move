# 2026-06-25 Web Source Paper Canvas Restoration

Scope:
- Restore the source bundle light theme canvas to the web/shared light token system.
- Keep dashboard panels/chrome white enough to avoid the muddy low-contrast look from the user's screenshot.
- Do not edit mobile source files manually.

Source truth:
- `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html`
- Source light tokens:
  - `bg: #EFEADF`
  - `bg2: #E7E1D4`
  - `surface: #FFFFFF`
  - `surface2: #F5F0E7`
  - `surface3: #ECE6DA`

Changes made:
- `packages/shared/src/design-tokens.ts`
  - `surfaceLight.background` restored to `#EFEADF`.
  - Light card remains white.
  - Light hover/secondary surface uses source paper `#F5F0E7`.
- `packages/shared/src/design-tokens-css.ts`
  - Web light CSS token source now emits source paper canvas and source-family secondary surfaces.
  - Shadcn light `--background`, `--muted`, and `--accent` use exact HSL values derived from source paper tokens.
- Generated web CSS token partials refreshed with `pnpm tokens:emit`.
- `apps/web/src/styles/globals.css`
  - Light app shell background restored to `#EFEADF`.
  - Light operational panel/chrome overrides stay white/strong white.
  - Dossier light row/stat surfaces mix white with source paper instead of neutral blue-grey.
- `apps/web/src/styles/aurora.css`
  - Aurora light base restored to `#EFEADF`.
  - Comments updated to clarify source paper canvas plus white panels.
- `apps/web/src/app/layout.tsx`
  - Light browser `theme-color` restored to `#EFEADF`.
- `apps/web/src/components/layout/app-shell.tsx`
  - Light shell fallback restored to `#EFEADF`.
- Regression tests updated to pin source paper canvas plus white surfaces.

What was intentionally not changed:
- No manual mobile source file changes.
- No deploy or merge.
- No production/staging environment variables.
- No PDF route changes in this pass.

Mobile note:
- Mobile imports `surfaceLight` through `@locateflow/shared`, so this shared token restoration may affect native mobile light canvas on the next mobile build even though no mobile file was edited. Native mobile source deck parity remains incomplete and needs a separate approved pass.

Verification:
- `pnpm tokens:emit` passed.
- `pnpm tokens:check` passed.
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx src/lib/pricing-free-tier-contract.test.ts` passed, 113 tests.
- `pnpm --filter @locateflow/web lint` passed.
- `git diff --check` passed.

Remaining runtime blockers:
- `origin/staging` still needs to contain the fix branch before staging screenshots can prove the change.
- Browser/Chrome capture was not available in this run, so visual QA remains blocked until a fresh screenshot of the deployed latest branch is captured.
- Dossier PDF 500 still requires the Dokploy log line from `Failed to build dossier PDF`.

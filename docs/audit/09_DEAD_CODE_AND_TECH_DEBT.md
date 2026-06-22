# Dead Code And Tech Debt

This is not a completed dead-code scan. It records source-backed initial debt signals and the required next scan.

## Initial Signals

| ID | Severity | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| DEBT-THEME-001 | Low | `packages/shared/src/design-tokens.ts:22` documents manual sync for web/admin CSS copies. | Token drift and duplicated maintenance. | Generate outputs or add snapshot drift tests. |
| DEBT-MOBILE-THEME-001 | Medium | `apps/mobile/src/lib/theme.ts:35-48` documents static and dynamic theme split; source search found 100 static theme usage files. | Gradual migration can stall and cause inconsistent UI. | Track migration by screen and close static imports over time. |
| DEBT-ROUTE-MATRIX-001 | Medium | 171 web API route files and 125 admin API route files exist. | Authorization assumptions are hard to audit without a matrix. | Generate route auth matrix and keep it in CI/docs. |
| DEBT-AUDIT-COVERAGE-001 | Medium | Local `pnpm audit --prod --audit-level high` timed out after about 124 seconds. | Dependency vulnerability state is inconclusive locally. | Rerun with approved longer timeout or rely on latest CI artifact. |

## Dead-Code Scan Needed

Next pass should run safe static-only checks:

- `ts-prune` or equivalent, only if already available; do not install without approval.
- `rg` search for unused route helpers, duplicate auth helpers, stale feature flags, and unreachable migration scripts.
- TypeScript project references/typecheck to catch unused exports where compiler settings support it.
- Per-app import graph review for source folders with no route/component references.

## Not Verified In Code

- Actual unused exports.
- Bundle size regressions.
- Runtime code paths behind feature flags.
- Whether large `tmp-*` untracked files are intentional QA artifacts or removable scratch files.

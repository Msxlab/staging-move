# Provider Behavior / Stale Cleanup Report

Generated: 2026-05-07

## Scope

- No new providers added.
- No provider seed data edited.
- No provider rows deleted.
- `controlled-provider-import.ts` and `controlled-provider-import-data.ts` remain absent.
- Generated provider docs were not kept in the diff; the state-completeness audit produced timestamp-only churn, which was restored.

## Files Changed

- `apps/web/src/app/api/providers/route.ts`
- `apps/web/src/app/api/providers/route.test.ts`
- `apps/web/src/app/api/providers/recommendations/route.ts`
- `apps/web/src/app/api/providers/recommendations/route.test.ts`
- `packages/shared/src/move-transition-classifier.ts`
- `packages/shared/src/__tests__/move-transition-classifier.test.ts`
- `docs/audits/providers/provider_behavior_stale_cleanup_report.md`

## Behavior Fixed

- No-context provider recommendations now query only `FEDERAL` providers and explicitly exclude `TRANSPORTATION_TRANSIT`.
- No-context provider listing now defaults to `FEDERAL` providers instead of returning all state-scoped providers.
- State-scoped provider listing/search without a state or ZIP now returns an empty result instead of dumping all state providers.
- Service-add candidate surfaces use provider recommendations, so transit resources are no longer offered as service-add candidates by the normal recommendation path.
- `TRANSPORTATION_TRANSIT` services now classify to `NO_ACTION` with `NO_LOCAL_STATE_CHANGE`; they do not create provider start/stop tasks.

## Stale / Alias Candidates Found

- `alagasco`: Current seed row is active as Alabama gas utility. Coverage override already describes "Alabama Gas (Alagasco/Spire Alabama)", which suggests the row should be reviewed for a future canonical Spire Alabama rename/alias. No seed change made.
- `centerpoint-ar`: Current seed row is active as CenterPoint Energy Arkansas. This appears stale/brand-risky and should be reviewed against current Arkansas gas ownership before any rename or alias migration. No seed change made.
- `dc-streetcar`: Current catalog row is `TRANSPORTATION_TRANSIT` and route/corridor oriented. New behavior prevents normal recommendation/task creation, but future cleanup should consider moving it to catalog-only/backlog if it has no trackable account action. No seed change made.
- Generic `ezpass` vs state-specific toll providers: Generic federal E-ZPass remains alongside state-specific toll providers such as NJ/NY/PA/DE E-ZPass. Future cleanup should prefer state-specific toll accounts when state/ZIP context exists and use generic E-ZPass only as fallback or alias guidance. No seed change made.
- Duplicate T-Mobile Home Internet rows: Raw seed contains both `t-mobile-home` and `tmobile-home-internet`; sanitizer dedupes them to one sanitized provider. Future cleanup should choose one canonical slug and preserve the other as an alias/migration reference before removing any raw duplicate. No seed change made.

## Verification

- `pnpm --filter @locateflow/web test -- src/app/api/providers/route.test.ts src/app/api/providers/recommendations/route.test.ts src/lib/provider-matching.test.ts src/lib/provider-matching.integration.test.ts src/lib/recommendation-engine.test.ts src/app/api/services/route.test.ts src/lib/move-task-generation.test.ts ../../packages/shared/src/__tests__/move-transition-classifier.test.ts ../../packages/shared/src/__tests__/provider-move-domain.test.ts ../../packages/shared/src/__tests__/provider-coverage.test.ts`
  - Passed: 10 files, 82 tests.
- `pnpm --filter @locateflow/web exec tsc --noEmit`
  - Passed.
- `pnpm --filter @locateflow/admin exec tsc --noEmit`
  - Passed.
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`
  - Passed.
- `pnpm --filter @locateflow/db exec tsc --noEmit`
  - Passed.
- `pnpm audit:providers`
  - Passed. Raw provider records: 843. Sanitized provider records: 842. Dedupe removals: 1.
- `pnpm audit:providers:coverage`
  - Passed. No coverage gaps found.
- `pnpm audit:providers:state-completeness`
  - Passed with `--skip-fetch`; generated docs only changed timestamps and were restored.

All commands emitted the expected engine warning because this machine is running Node v24.12.0 while the repo declares Node 22.x.

## Commit Recommendation

Safe to commit as a small behavior cleanup PR if staging includes only the files listed above. Do not stage unrelated dirty mobile/logo/nav/admin/internal-secret files, `New folder/`, root app config files, or generated timestamp-only docs.

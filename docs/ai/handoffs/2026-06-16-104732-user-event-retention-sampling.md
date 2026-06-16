# UserEvent Retention And Sampling Handoff - 2026-06-16

Backlinks: [[../analytics/DATA_RETENTION_POLICY]], [[../analytics/EVENT_TAXONOMY]], [[../00_PRODUCT_BRAIN_DASHBOARD]]

## Scope

- Task: bound `UserEvent` growth created by consented Phase-1 telemetry and broader `trackEvent` persistence.
- Repo: `C:\Users\Windows\Documents\move-main\move-main`.
- Guardrails followed: no deploy, push, migration, package install, production data access, `.env` read, or manual destructive delete run.

## Changed files

- `apps/web/src/app/api/cron/data-retention/route.ts`
- `apps/web/src/app/api/cron/data-retention/route.test.ts`
- `apps/web/src/app/api/tracking/event/route.ts`
- `apps/web/src/app/api/tracking/event/route.test.ts`
- `apps/web/src/lib/user-event-retention.ts`
- `apps/web/src/lib/user-event-retention.test.ts`
- `apps/web/src/lib/user-event-sampling.ts`
- `packages/shared/src/runtime-config.ts`
- `docs/ai/analytics/DATA_RETENTION_POLICY.md`
- `docs/ai/analytics/EVENT_TAXONOMY.md`
- `docs/ai/analytics/POSTHOG_MEASUREMENT_PLAN.md`
- `docs/ai/00_PRODUCT_BRAIN_DASHBOARD.md`
- `docs/ai/handoffs/2026-06-16-104732-user-event-retention-sampling.md`

## Implementation summary

- Extended the existing CRON_SECRET-guarded `data-retention` cron for `UserEvent` retention instead of adding a new mechanism.
- Changed `UserEvent` cleanup to safe dry-run by default.
- Added config keys:
  - `USER_EVENT_RETENTION_DAYS`, default 180.
  - `USER_EVENT_RETENTION_ENABLED`, default false.
  - `USER_EVENT_RETENTION_BATCH_SIZE`, default 1000.
  - `USER_EVENT_SAMPLING_ENABLED`, default false.
  - `USER_EVENT_SAMPLING_RATE`, default 1.
- Added batched oldest-first deletion when retention is explicitly enabled.
- Added dry-run logging with age buckets and eligible row count.
- Added optional write-time sampling for non-experiment events.
- Kept the five Phase-1 events at 100% persistence: `ai_briefing_viewed`, `ai_briefing_action_clicked`, `trust_copy_shown`, `onboarding_teaser_viewed`, `upgrade_clicked`.

## Tests run

- `pnpm --filter @locateflow/web test -- src/lib/user-event-retention.test.ts src/app/api/cron/data-retention/route.test.ts src/app/api/tracking/event/route.test.ts`
  - Result: PASS, 3 files, 9 tests.
- `pnpm --filter @locateflow/web test -- ../../packages/shared/src/__tests__/runtime-config.test.ts`
  - Result: PASS, 1 file, 38 tests.
- `pnpm --filter @locateflow/web lint`
  - Result: FAIL on existing unrelated TypeScript error: `src/components/dashboard/move-briefing-card.tsx(514,55)` passes `BriefingFetchState | null` where `BriefingFetchState` is required. Not fixed under this approval.

Environment warning: Node `v24.13.0` / pnpm `9.15.0`; repo expects Node `22.x`.

## Index check

`packages/db/prisma/schema.prisma` already has `@@index([createdAt])` on `UserEvent`.

No index migration was created or applied. If deployed database drift shows the live database lacks this index, request explicit migration approval before changing schema.

## Safety confirmation

- No deletion runs by default for `UserEvent`; default mode logs dry-run counts only.
- No manual delete command was run.
- When enabled, deletion is batched and constrained to old `UserEvent` ids that still match the age cutoff and retained-event exclusion.
- Existing non-UserEvent retention behavior in the cron was left unchanged.
- Sampling is off by default and never drops Phase-1 experiment events.
- Privacy behavior was not broadened; existing consent gate and metadata sanitization remain the write path.

## Recommendation

Keep `USER_EVENT_RETENTION_ENABLED=false` until an operator reviews dry-run `USER_EVENT_RETENTION` logs. Default to 180 days, then enable in staging before production. Leave sampling off until storage pressure is measured on non-experiment events.

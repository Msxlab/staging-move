# Onboarding Teaser Experiment Running

Backlinks: [[02_ACTIVE_EXPERIMENTS]], [[analytics/EVENT_TAXONOMY]], [[00_PRODUCT_BRAIN_DASHBOARD]]

## Scope

- Experiment: Widen personalized onboarding teaser to all cohorts.
- Feature flag: `ux_onboarding_teaser_v1`.
- Default behavior: `control`.
- New behavior: `variant`.
- Rollback: disable the flag; no schema, route, dependency, migration, data backfill, deploy, push, or telemetry rollback is required.

## Changed files

- `packages/shared/src/ux-experiments.ts`
- `packages/shared/src/ux-experiments.test.ts`
- `apps/web/src/app/onboarding/page.tsx`
- `apps/web/src/app/onboarding/onboarding-client.tsx`
- `apps/web/src/app/auth-page-regression.test.ts`
- `apps/mobile/app/onboarding.tsx`
- `apps/mobile/src/components/ui/MoveTeaserCard.tsx`
- `docs/ai/02_ACTIVE_EXPERIMENTS.md`
- `docs/ai/analytics/EVENT_TAXONOMY.md`
- `docs/ai/handoffs/2026-06-16-095549-onboarding-teaser-running.md`

## Behavior implemented

- Web `control` keeps the current behavior: paid users create the moving plan directly; free users with move details see the non-persisted teaser.
- Web `variant` shows the engine-computed teaser to paid and free users who entered destination plus move date.
- Web paid teaser users continue in one tap to the existing moving-plan creation flow and then route to `/moving/plan/[id]`.
- Web free teaser users keep the existing upgrade/free CTAs and still do not POST `/api/moving`.
- Web users without destination plus move date do not see the teaser.
- Mobile had the same free-only teaser gate, so parity was applied behind the same experiment flag resolver using `EXPO_PUBLIC_UX_ONBOARDING_TEASER_V1`.
- Mobile paid teaser users get a "Continue to your plan" CTA; free users keep the existing unlock/free CTA behavior.

## Tests run

- `pnpm --filter @locateflow/web test -- src/app/auth-page-regression.test.ts ../../packages/shared/src/ux-experiments.test.ts`
  - Passed: 2 test files, 20 tests.
  - Note: pnpm reported the existing Node engine warning: wanted Node `22.x`, current `v24.13.0`.

## Guardrail confirmations

- No new route, schema, migration, dependency, deploy, push, or infrastructure change was made.
- No AI key, AI runtime, or AI cohort behavior was changed.
- No billing/paywall copy, entitlement gate, or `/pricing` CTA was changed.
- Free users still do not create a MovingPlan from the teaser path.
- The teaser remains ephemeral and is not persisted as a MovingPlan.
- No new telemetry persistence was added.
- TODO comments name the future `onboarding_teaser_viewed` event for separate telemetry-persistence approval.

## Post-ship watch

- Watch onboarding completion rate.
- Watch onboarding time-to-complete, especially 75th percentile for paid users who now see one extra screen under the variant.

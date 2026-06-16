# Point-of-Action Trust Confirmation Running

Backlinks: [[02_ACTIVE_EXPERIMENTS]], [[analytics/EVENT_TAXONOMY]], [[00_PRODUCT_BRAIN_DASHBOARD]]

## Scope

- Experiment: Point-of-action trust confirmation.
- Feature flag: `ux_trust_copy_v1`.
- Default behavior: `control`.
- New behavior: `variant`.
- Rollback: disable the flag; no schema, route, dependency, migration, data backfill, deploy, or telemetry rollback is required.

## Changed files

- `packages/shared/src/legal.ts`
- `packages/shared/src/ux-experiments.ts`
- `packages/shared/src/ux-experiments.test.ts`
- `apps/web/src/app/(app)/moving/plan/[id]/page.tsx`
- `apps/web/src/app/(app)/moving/plan/[id]/moving-plan-detail-client.tsx`
- `apps/web/src/app/(app)/moving/plan/trust-copy.tsx`
- `apps/web/src/app/(app)/moving/plan/trust-copy.test.tsx`
- `apps/web/src/app/(app)/dashboard/page.tsx`
- `apps/web/src/app/(app)/dashboard/dashboard-client.tsx`
- `apps/web/src/components/dashboard/move-briefing-card.tsx`
- `apps/web/src/components/dashboard/move-briefing-card.test.tsx`
- `apps/web/src/i18n/messages/en.json`
- `apps/web/src/i18n/messages/es.json`
- `docs/ai/02_ACTIVE_EXPERIMENTS.md`
- `docs/ai/analytics/EVENT_TAXONOMY.md`
- `docs/ai/handoffs/2026-06-15-182942-point-of-action-trust-confirmation-running.md`

## Behavior implemented

- Plan page `control` preserves the existing `localEffect.localOnly && !isDone && !isDismissed` badge behavior.
- Plan page `variant` shows the "LocateFlow only — your provider account is unchanged" badge for stop/start/transfer/cancel/update task action types, including completed and dismissed tasks.
- Plan page `variant` suppresses the unchanged guarantee when `localEffect` marks a verified live-integration task with non-local automation semantics.
- Plan page `variant` renders the canonical legal line from `packages/shared/src/legal.ts` verbatim.
- Briefing card `control` preserves existing provenance behavior: AI tag only when `aiGenerated === true`, no persistent footer.
- Briefing card `variant` always renders provenance (`AI-generated` or `Rule-based`) and the not-advice footer.
- Connector subtitle copy now leads with guided action and bounds any on-user-behalf submission to a supported authorized connector.

## Tests run

- `pnpm --filter @locateflow/web test -- "src/app/(app)/moving/plan/trust-copy.test.tsx" src/components/dashboard/move-briefing-card.test.tsx ../../packages/shared/src/ux-experiments.test.ts`
  - Passed: 3 test files, 40 tests.
  - Note: pnpm reported the existing Node engine warning: wanted Node `22.x`, current `v24.13.0`.

## Guardrail confirmations

- No AI key, AI runtime, or AI cohort behavior was changed.
- No telemetry was persisted, and no UserEvent/PostHog writes were added.
- TODO comments name the future `trust_copy_shown` event for separate telemetry-persistence approval.
- No billing/upgrade copy, prices, entitlement gates, or `/pricing` CTA were changed.
- No new route, schema, migration, dependency, deploy, push, or infrastructure change was made.
- No blocked phrases were added to rendered trust copy.

## Follow-up

- Human review should verify `ux_trust_copy_v1=variant` in local/staging QA before rolling the trust/safety copy broadly.

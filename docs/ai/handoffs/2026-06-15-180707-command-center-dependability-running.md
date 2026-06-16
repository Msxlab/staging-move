# Command Center Dependability Experiment Running

Backlinks: [[02_ACTIVE_EXPERIMENTS]], [[01_ACTIVE_STRATEGY]], [[00_PRODUCT_BRAIN_DASHBOARD]]

## Scope

- Experiment: Command Center dependability + de-noise.
- Feature flag: `ux_ai_briefing_experience_v1`.
- Default behavior: `control`.
- New behavior: `variant`.
- Rollback: disable the flag; no schema, migration, route, dependency, deploy, or persisted data change is required.

## Changed files

- `apps/web/src/components/dashboard/move-briefing-card.tsx`
- `apps/web/src/components/dashboard/move-briefing-card.test.tsx`
- `apps/web/src/app/(app)/dashboard/page.tsx`
- `apps/web/src/app/(app)/dashboard/dashboard-client.tsx`
- `apps/web/src/app/(app)/dashboard/dashboard-ux-experiment.ts`
- `apps/web/src/app/(app)/dashboard/dashboard-ux-experiment.test.ts`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/src/lib/ai-briefing-experience.ts`
- `apps/mobile/src/lib/ai-briefing-experience.test.ts`
- `packages/shared/src/ux-experiments.ts`
- `packages/shared/src/ux-experiments.test.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/index.mobile.ts`
- `docs/ai/02_ACTIVE_EXPERIMENTS.md`
- `docs/ai/handoffs/2026-06-15-180707-command-center-dependability-running.md`

## Behavior implemented

- Web briefing card keeps control behavior unchanged when the flag is off.
- Web variant renders a deterministic rule-based fallback instead of an empty/hidden slot when AI content is unavailable, malformed, keyless, or fetch-failed.
- Web gated free/Individual users continue to receive the existing blurred teaser and `/pricing` CTA.
- Web dismiss remains available; in the variant, dismissal is scoped to the current move stage so a stage change re-shows the briefing.
- Web first-session variant pins Move Command Center, Next Critical Actions, and Briefing above reference widgets.
- Web returning-user widget customization is preserved by only using the details section when no saved dashboard widget preferences exist.
- Mobile control behavior keeps the existing one-time install dismissal.
- Mobile variant ignores the one-time install hide, renders fallback/teaser instead of vanishing, and relies on the existing stage-scoped briefing dismissal behavior.
- `FreeMoveUpsellCard` remains the free hero.

## Tests run

- `pnpm --filter @locateflow/web test -- src/components/dashboard/move-briefing-card.test.tsx "src/app/(app)/dashboard/dashboard-ux-experiment.test.ts" ../../packages/shared/src/ux-experiments.test.ts`
  - Passed: 3 test files, 34 tests.
- `pnpm --filter @locateflow/mobile test -- src/lib/ai-briefing-experience.test.ts`
  - Passed: 1 test file, 4 tests.

## Guardrail confirmations

- No `ANTHROPIC_API_KEY` or AI runtime/cohort behavior was changed.
- No new telemetry was persisted and no UserEvent/PostHog writes were added.
- TODO comments name the future `briefing_state` event for the separate telemetry-persistence approval.
- No billing or upgrade copy was changed; existing teaser and `/pricing` CTA are reused.
- No route, schema, migration, dependency, deployment, push, or infrastructure change was made.
- Application source changes are limited to the approved Experiment 1 feature-flagged implementation.

## Follow-up

- Human review should verify the `variant` UI manually on web and mobile before enabling the flag outside local/staging QA.

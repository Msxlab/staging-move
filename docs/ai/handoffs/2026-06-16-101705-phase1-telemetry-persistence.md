# Phase-1 Telemetry Persistence Handoff

Updated: 2026-06-16 10:17 ET

## Completed

- Instrumented the three running Phase-1 UX experiments through the existing consent-gated `trackEvent` -> `/api/tracking/event` -> `UserEvent` pipeline.
- Added a shared closed-enum Phase-1 analytics metadata adapter under `packages/shared`.
- Added route-level allowlisting for Phase-1 event metadata before the existing API metadata sanitizer runs.
- Replaced source telemetry TODOs for:
  - `ai_briefing_viewed`
  - `trust_copy_shown`
  - `onboarding_teaser_viewed`
- Added minimal funnel context:
  - `ai_briefing_action_clicked`
  - `upgrade_clicked` for AI briefing and onboarding teaser upgrade CTAs.
- Updated analytics docs to mark the Phase-1 events live through `UserEvent`, not PostHog.

## Changed Files

- `packages/shared/src/phase1-experiment-analytics.ts`
- `packages/shared/src/phase1-experiment-analytics.test.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/index.mobile.ts`
- `apps/web/src/lib/analytics.ts`
- `apps/web/src/lib/analytics.test.ts`
- `apps/web/src/app/api/tracking/event/route.ts`
- `apps/web/src/app/api/tracking/event/route.test.ts`
- `apps/web/src/components/dashboard/move-briefing-card.tsx`
- `apps/web/src/components/dashboard/move-briefing-card.test.tsx`
- `apps/web/src/app/(app)/moving/plan/[id]/moving-plan-detail-client.tsx`
- `apps/web/src/app/(app)/moving/plan/trust-copy.tsx`
- `apps/web/src/app/onboarding/onboarding-client.tsx`
- `apps/mobile/src/components/ui/MoveBriefingCard.tsx`
- `apps/mobile/src/lib/ai-briefing-experience.ts`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/onboarding.tsx`
- `docs/ai/analytics/EVENT_TAXONOMY.md`
- `docs/ai/analytics/EXPERIMENT_METRICS.md`
- `docs/ai/handoffs/2026-06-16-101705-phase1-telemetry-persistence.md`

## Events Now Live

- `ai_briefing_viewed`
- `ai_briefing_action_clicked`
- `trust_copy_shown`
- `onboarding_teaser_viewed`
- `upgrade_clicked` for the Phase-1 AI briefing and onboarding teaser upgrade surfaces.

## Privacy Guardrails Confirmed

- No PostHog package or dependency was installed.
- No schema or migration was added.
- No raw address, date, account, confirmation number, name, email, phone, raw URL/referrer, AI prompt/response, provider account-change, or partner-lead payload is intentionally emitted by the Phase-1 adapter.
- Phase-1 metadata is reduced to closed enum/coarse values before `trackEvent`; the API route applies the same allowlist again before the existing metadata sanitizer writes `UserEvent`.
- Events still respect existing consent gates:
  - Web: analytics cookie consent plus authenticated session.
  - Mobile: current `ANALYTICS` consent plus authenticated session.

## Tests Run

```powershell
pnpm --filter @locateflow/web test -- src/lib/analytics.test.ts src/app/api/tracking/event/route.test.ts src/components/dashboard/move-briefing-card.test.tsx 'src/app/(app)/moving/plan/trust-copy.test.tsx' ../../packages/shared/src/phase1-experiment-analytics.test.ts
```

Result: 5 files passed, 54 tests passed.

Known warning: local Node is `v24.13.0`; repo engine wants Node `22.x`.

## Not Done

- No PostHog install, destination, dashboard, or external analytics integration.
- No billing copy changes.
- No AI runtime or key changes.
- No deploy, push, migration, or infrastructure change.

## Review Notes

- `trackEvent` on web now also queues sanitized internal `UserEvent` writes after consent, even when GA/GTM is not configured. Google behavior remains gated by GA/GTM config.
- Paid onboarding teaser events use `plan_tier = unknown` when the exact paid tier is not available on the client screen.
- Existing legacy events such as `move_teaser_viewed`, `checkout_started`, `trial_started`, and `subscription_started` were preserved.

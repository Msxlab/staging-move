# Data Retention Policy

Updated: 2026-06-16

Backlinks: [[EVENT_TAXONOMY]], [[POSTHOG_MEASUREMENT_PLAN]], [[../00_PRODUCT_BRAIN_DASHBOARD]]

## Scope

This policy bounds growth from consented `UserEvent` analytics rows created by the existing `trackEvent` -> `/api/tracking/event` -> `UserEvent` pipeline.

This is a volume policy, not a privacy policy. Privacy guardrails are already enforced by analytics consent, metadata sanitization, Phase-1 property allowlists, and PII-like field stripping.

This policy applies to `UserEvent` rows only. Existing non-UserEvent cleanup in the data-retention cron is unchanged.

## Retention Window

- Default proposed window: **180 days**.
- Runtime-config/env key: `USER_EVENT_RETENTION_DAYS`.
- Allowed range in code: 30 to 3650 days.
- Existing retained exceptions: `LEGAL_CONSENT_ACCEPTED` and `ONBOARDING_COMPLETED` are excluded from UserEvent pruning, matching the prior legal/onboarding retention exception.

## Safe Default

- Default mode: **dry-run**.
- Enable deletion only with explicit runtime-config/env key: `USER_EVENT_RETENTION_ENABLED=true`.
- Dry-run behavior: the existing `data-retention` cron logs how many old `UserEvent` rows would be deleted by age bucket and deletes zero `UserEvent` rows.
- Enabled behavior: deletion is batched, ordered oldest-first, and idempotent.
- Batch config: `USER_EVENT_RETENTION_BATCH_SIZE`, default 1000, allowed range 1 to 5000.
- Per-run safety: at most 20 batches are attempted per cron invocation; rerunning the cron continues pruning remaining eligible rows.

## Sampling

- Default mode: **off**.
- Enable only with `USER_EVENT_SAMPLING_ENABLED=true`.
- Rate key: `USER_EVENT_SAMPLING_RATE`, decimal between 0 and 1, default 1.
- Sampling applies only to non-experiment events.
- The five Phase-1 experiment events are always persisted at 100%:
  - `ai_briefing_viewed`
  - `ai_briefing_action_clicked`
  - `trust_copy_shown`
  - `onboarding_teaser_viewed`
  - `upgrade_clicked`

## Current Index Status

Prisma schema currently includes `@@index([createdAt])` on `UserEvent`, which supports age-based pruning.

No index migration was created or applied in this task. If deployed database drift shows that the live database lacks this index, request explicit migration approval before changing schema.

## Guardrails

- Do not run destructive deletes manually by default.
- Do not enable `USER_EVENT_RETENTION_ENABLED` in production without explicit human approval.
- Do not use sampling to drop Phase-1 experiment events while experiments are being evaluated.
- Do not add raw addresses, names, emails, phone numbers, account numbers, provider credentials, confirmation numbers, raw URLs/referrers, AI prompts, AI responses, or document contents to analytics metadata.
- Keep PostHog uninstalled/unconfigured unless separately approved.

## Operator Checklist

1. Confirm `UserEvent.createdAt` index exists in the deployed database.
2. Run the data-retention cron in dry-run mode and inspect `USER_EVENT_RETENTION` logs.
3. Choose a retention window, defaulting to 180 days unless product analysis needs a longer lookback.
4. Turn on `USER_EVENT_RETENTION_ENABLED=true` only after approval.
5. Leave sampling off until high-frequency non-experiment events are proven to create meaningful storage pressure.

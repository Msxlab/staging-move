# Phase-1 Integration Handoff - 2026-06-16

Backlinks: [[../02_ACTIVE_EXPERIMENTS]], [[../analytics/EVENT_TAXONOMY]], [[../analytics/DATA_RETENTION_POLICY]]

## Branch

- Integration branch: `codex/phase1-integration`.
- Common local base: `main` at `5fe35bbc8e69e6930c28bf371a32dba2f1180501` (`Add AI agent workflow documentation`).
- Current branch HEAD: `5fe35bbc8e69e6930c28bf371a32dba2f1180501`.
- Note: local `main` is the requested common base and differs from `move-main/main`; no remote merge/rebase was performed.

## Branch/commit inventory

Local branches checked:

- `codex/phase1-telemetry-persistence` -> `5fe35bbc8e69e6930c28bf371a32dba2f1180501`
- `codex/ux-trust-copy-v1` -> `5fe35bbc8e69e6930c28bf371a32dba2f1180501`
- `codex/ux-onboarding-teaser-v1` -> `5fe35bbc8e69e6930c28bf371a32dba2f1180501`
- `main` -> `5fe35bbc8e69e6930c28bf371a32dba2f1180501`

No unique local commits were found for Exp 1, Exp 2, Exp 3, telemetry persistence, UserEvent retention/sampling, or the briefing typecheck fix. The Phase-1 work is present as working-tree changes, not committed branch deltas. Therefore no merge or cherry-pick conflicts occurred; the integration branch was created from the common base and the dirty worktree was carried forward.

## Conflicts

No Git conflicts occurred because there were no distinct Phase-1 branch commits to merge. Multi-touch files remain as integrated working-tree changes:

- `packages/shared/src/ux-experiments.ts`
- `apps/web/src/components/dashboard/move-briefing-card.tsx`
- dashboard, onboarding, and moving-plan web files
- mobile home/onboarding/briefing/teaser files
- `apps/web/src/i18n/messages/en.json`
- `apps/web/src/i18n/messages/es.json`
- `packages/shared/src/legal.ts`
- `packages/shared/src/runtime-config.ts`
- `docs/ai/02_ACTIVE_EXPERIMENTS.md`
- `docs/ai/analytics/EVENT_TAXONOMY.md`

The briefing typecheck fix is preserved: `move-briefing-card.tsx` now guards `if (!data || !parsed) return null;` before `briefingTelemetryForState(data)`.

## Post-merge invariants

- Flags default to control: `resolveUxExperimentVariant` returns `control` for non-string/unset values and for non-variant strings. The three flags remain `ux_ai_briefing_experience_v1`, `ux_trust_copy_v1`, and `ux_onboarding_teaser_v1`.
- No flag was enabled by this task. No runtime feature flag row/config was changed.
- `UserEvent` retention defaults to dry-run: `USER_EVENT_RETENTION_ENABLED` resolves via `parseBoolean(undefined) === false`; default window is 180 days.
- `UserEvent` sampling defaults off: `USER_EVENT_SAMPLING_ENABLED` resolves false; sample rate default is 1.
- Phase-1 events persist at 100%: `shouldPersistUserEvent` returns true for `isPhase1AnalyticsEvent(event)` before sampling.
- Free onboarding paywall remains closed: `onboarding-client.tsx` branches on `if (wantsToMove && !isPremium)` before calling `saveMovingPlan()`, and the free teaser completion path says no `/api/moving` POST.
- Legal-consent/onboarding events remain excluded from pruning: `user-event-retention.ts` excludes `[LEGAL_CONSENT_EVENT, ONBOARDING_COMPLETED_EVENT]`.
- `apps/web/src/i18n/messages/en.json` and `apps/web/src/i18n/messages/es.json` parse as valid JSON.

## Full CI results

Environment warning on all pnpm commands: repo wants Node `22.x`; current runtime is Node `v24.13.0`, pnpm `9.15.0`.

| Gate | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | GREEN | Lockfile up to date. Postinstall ran `pnpm --filter @locateflow/db generate` / `prisma generate`. No migration. |
| `pnpm lint` | RED | Fails in `@locateflow/mobile#lint` with Expo typed-route errors for routes such as `/settings/workspace`, `/notifications`, `/custom-providers`, `/help/tickets`, `/blog`. |
| `pnpm verify:typecheck` | RED | Web/admin passed before mobile; mobile fails with the same typed-route errors as lint. |
| `pnpm --filter @locateflow/web test` | GREEN | 278 files passed, 2484 tests passed. |
| `pnpm --filter @locateflow/admin test` | RED | 117 files passed, 1 failed. `runtime-config-client.test.ts` has 3 failures: `ReferenceError: React is not defined` in `runtime-config-client.tsx`. |
| `pnpm --filter @locateflow/mobile test` | GREEN | 28 files passed, 284 tests passed. |
| `pnpm --filter @locateflow/web e2e -- --project=chromium tests/e2e/public-pages.spec.ts` | KNOWN RED | 1 passed, 8 failed. Public page failures are `page.goto(... waitUntil: "load")` timeouts and localhost/noindex SEO expectation drift. Kept separate per instruction. |

## E2E known-failure note

The public-pages e2e failure remains separate from the consolidation verdict. It is consistent with the earlier known public e2e/environmental issue: pages render but `load` does not complete in the harness, and SEO assertions expect production-indexing output while local noindex behavior returns blocking robots / suppressed site schemas.

## Safety confirmations

- No push to `main`.
- No deploy.
- No feature flag enabled.
- No telemetry or retention default changed beyond the already-approved safe defaults.
- No DB migration created or applied.
- No package dependency change was made; install only refreshed local `node_modules`/Prisma client generation.

## Recommendation

Do not promote the integration branch yet. The web Phase-1 path is green, but the repo-level gate is red because of mobile typed-route typecheck failures and an admin Runtime Config test failure. Request a separate approval to fix those CI blockers before staging/PR promotion.

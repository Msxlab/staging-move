# Provider Additions V1 Batch 3A Final Safety Report

Generated: 2026-05-07

## Scope

- Rows reviewed from Batch 3 planning: 98
- Rows selected for Batch 3A: 5
- Rows added active: 5
- Rows skipped/deferred: 93
- Rows rejected from import: 12

## Selected Rows Added Active

- CA | recology-san-francisco | Recology San Francisco | UTILITY_TRASH | ZIP prefixes: 941
- FL | miami-dade-solid-waste | Miami-Dade Solid Waste Management | UTILITY_TRASH | ZIP prefixes: 330;331;332
- FL | orange-county-utilities-water | Orange County Utilities Water | UTILITY_WATER | ZIP prefixes: 327;328
- FL | palm-beach-county-water | Palm Beach County Water Utilities Department | UTILITY_WATER | ZIP prefixes: 334
- FL | pinellas-county-water | Pinellas County Utilities Water | UTILITY_WATER | ZIP prefixes: 337;346

## Final Counts

- Final raw provider count: 888
- Final sanitized provider count: 887
- Final coverage row count: 1832
- Coverage rows added by Batch 3A ZIP prefixes: 9

## Safety Confirmations

- Controlled provider import files remain absent: yes.
- No rejected rows became active: yes.
- No manual-review or backlog rows became active: yes.
- No UPDATE_EXISTING_ONLY rows were added as new providers: yes.
- No transit rows were added: yes.
- No public-works-only, pickup-calendar, route/resource, recycling-info, or education rows were added: yes.
- All 5 added providers are address-check-required: yes; each seed record carries ZIP-prefix coverage and the address-check tag.
- No selected provider is statewide modeled: yes.

## Exact Files Changed

- packages/db/prisma/seed-data/state-provider-catalog.ts
- docs/generated/state-provider-completeness-catalog.json
- docs/generated/state-provider-completeness-catalog.md
- docs/generated/state-provider-seed-diff.json
- docs/generated/state-provider-seed-diff.md
- docs/audits/providers/provider_additions_v1_batch3a_codex_review.csv
- docs/audits/providers/provider_additions_v1_batch3a_summary.md
- docs/audits/providers/provider_additions_v1_batch3a_final_safety_report.md

Batch 3 planning artifacts used as inputs and already present in the worktree:

- docs/audits/providers/provider_additions_v1_batch3_candidates.csv
- docs/audits/providers/provider_additions_v1_batch3_rejected.csv
- docs/audits/providers/provider_additions_v1_batch3_existing_updates.csv
- docs/audits/providers/provider_additions_v1_batch3_summary.md

## Verification

- pnpm audit:providers: passed. Raw provider records: 888. Sanitized provider records: 887. Dedupe removals: 1. Coverage rows by shape total: 1832.
- pnpm audit:providers:coverage: passed. No coverage gaps found.
- pnpm audit:providers:state-completeness: passed with --skip-fetch. Catalog entries: 150. Newly added in merged seed: 143. Catalog-only backlog: 7.
- pnpm --filter @locateflow/db exec tsc --noEmit: passed.
- pnpm --filter @locateflow/web exec tsc --noEmit: passed.
- pnpm --filter @locateflow/admin exec tsc --noEmit: passed.
- pnpm --filter @locateflow/mobile exec tsc --noEmit: passed.
- Provider matching/recommendation tests: passed, 5 web test files and 41 tests.
- Web move-task generation test: passed, 1 file and 2 tests.
- Shared provider/recommendation/move-task tests: passed, 7 files and 40 tests.
- Node runtime note: commands ran on Node v24.13.0 and emitted the expected repo engine warning for Node 22.x.
- Test rerun note: an initial root-level shared Vitest command matched stale .claude worktree copies; the clean packages/shared-root rerun passed.

## Commit Recommendation

Safe to commit after review. Batch 3A adds exactly 5 active providers, all selected from the approved safe list, all ZIP-prefix scoped and address-check-required, with no rejected/manual/backlog/transit/resource-only rows activated.

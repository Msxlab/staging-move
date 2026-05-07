# Provider Additions V1 Batch 2A Final Safety Report

Generated: 2026-05-07

## Scope

- Rows reviewed from Batch 2 planning: 138
- Rows selected for Batch 2A: 40
- Rows added active: 40
- Rows skipped/deferred: 98
- Rows rejected from import: 7

## Selected Rows Added Active

- AK | juneau-water-utility | City and Borough of Juneau Water Utility | UTILITY_WATER | ZIP prefixes: 998
- AK | college-golden-heart-utilities-water | College & Golden Heart Utilities Water | UTILITY_WATER | ZIP prefixes: 997
- AL | huntsville-water-pollution-control | City of Huntsville Water Pollution Control | UTILITY_SEWER | ZIP prefixes: 357;358
- AL | jefferson-county-environmental-services | Jefferson County Environmental Services Department | UTILITY_SEWER | ZIP prefixes: 350;351;352
- AL | tuscaloosa-water | City of Tuscaloosa Water | UTILITY_WATER | ZIP prefixes: 354
- AL | madison-county-water | Madison County Water Department | UTILITY_WATER | ZIP prefixes: 357;358
- AL | mawss-water | Mobile Area Water and Sewer System Water | UTILITY_WATER | ZIP prefixes: 366
- AR | little-rock-water-reclamation | Little Rock Water Reclamation Authority | UTILITY_SEWER | ZIP prefixes: 722
- AR | springdale-water-utilities-wastewater | Springdale Water Utilities Wastewater | UTILITY_SEWER | ZIP prefixes: 727
- AR | bentonville-water-utilities | Bentonville Water Utilities | UTILITY_WATER | ZIP prefixes: 727
- AR | fayetteville-water | Fayetteville Water and Sewer | UTILITY_WATER | ZIP prefixes: 727
- AR | fort-smith-water | Fort Smith Utilities Water | UTILITY_WATER | ZIP prefixes: 729
- AR | jonesboro-cwl-water | Jonesboro City Water and Light Water | UTILITY_WATER | ZIP prefixes: 724
- AR | rogers-water-utilities | Rogers Water Utilities | UTILITY_WATER | ZIP prefixes: 727
- AZ | pima-county-wastewater | Pima County Regional Wastewater Reclamation Department | UTILITY_SEWER | ZIP prefixes: 856;857
- AZ | chandler-water | City of Chandler Water | UTILITY_WATER | ZIP prefixes: 852
- AZ | tempe-water-services | City of Tempe Water Services | UTILITY_WATER | ZIP prefixes: 852
- AZ | glendale-water-services | Glendale Water Services | UTILITY_WATER | ZIP prefixes: 853
- AZ | scottsdale-water | Scottsdale Water | UTILITY_WATER | ZIP prefixes: 852
- AZ | gilbert-water | Town of Gilbert Water | UTILITY_WATER | ZIP prefixes: 852
- CA | fresno-water | City of Fresno Utilities Water | UTILITY_WATER | ZIP prefixes: 937
- CA | sacramento-water | City of Sacramento Department of Utilities Water | UTILITY_WATER | ZIP prefixes: 958
- CA | san-diego-public-utilities-water | City of San Diego Public Utilities Water | UTILITY_WATER | ZIP prefixes: 919;920;921
- CA | ebmud-water | East Bay Municipal Utility District Water | UTILITY_WATER | ZIP prefixes: 945;946;947;948
- CA | long-beach-utilities-water | Long Beach Utilities Water | UTILITY_WATER | ZIP prefixes: 908
- CA | san-jose-water | San Jose Water | UTILITY_WATER | ZIP prefixes: 951
- CO | aurora-water | Aurora Water | UTILITY_WATER | ZIP prefixes: 800;801
- CO | boulder-water-utilities | City of Boulder Water Utilities | UTILITY_WATER | ZIP prefixes: 803
- CO | colorado-springs-utilities-water | Colorado Springs Utilities Water | UTILITY_WATER | ZIP prefixes: 809
- CO | fort-collins-utilities-water | Fort Collins Utilities Water | UTILITY_WATER | ZIP prefixes: 805
- CT | bridgeport-wpca | Bridgeport Water Pollution Control Authority | UTILITY_SEWER | ZIP prefixes: 066
- CT | gnhwpca | Greater New Haven Water Pollution Control Authority | UTILITY_SEWER | ZIP prefixes: 064;065
- CT | stamford-wpca | Stamford Water Pollution Control Authority | UTILITY_SEWER | ZIP prefixes: 069
- CT | mdc-ct-water | Metropolitan District Commission | UTILITY_WATER | ZIP prefixes: 060;061
- CT | regional-water-authority-ct | South Central Connecticut Regional Water Authority | UTILITY_WATER | ZIP prefixes: 064;065
- DE | kent-county-wastewater | Kent County Wastewater Division | UTILITY_SEWER | ZIP prefixes: 199
- DE | new-castle-county-sewer | New Castle County Sewer | UTILITY_SEWER | ZIP prefixes: 197;198
- DE | sussex-county-sewer | Sussex County Environmental Services | UTILITY_SEWER | ZIP prefixes: 199
- DE | wilmington-water-utility | Wilmington Water Utility | UTILITY_WATER | ZIP prefixes: 198
- FL | hillsborough-county-water | Hillsborough County Water Resources | UTILITY_WATER | ZIP prefixes: 335;336

## Skipped / Deferred Rows

- Deferred ADD_NEW_ACTIVE rows: 37
- Excluded manual-review/backlog rows: 8
- Excluded existing/update/skip rows: 46
- Excluded rejected resource-only rows: 7

## Safety Confirmations

- Controlled provider import files remain absent: yes, filesystem check returned no matches.
- No rejected resources were imported: yes, selected set excludes all REJECT_RESOURCE_ONLY rows.
- No manual-review/backlog rows became active: yes, selected set excludes all ADD_NEW_MANUAL_REVIEW and BACKLOG_ONLY rows.
- No transit rows were added: yes, selected categories are only UTILITY_WATER and UTILITY_SEWER.
- No PSC/PUC/broadband/map/directory/info/report pages were added: yes, selected set uses customer utility account rows only.
- No selected provider is statewide modeled: yes, all selected rows use ZIP-prefix coverage.
- ZIP prefix is not treated as proof of service: yes, every added row carries address-check wording and address-check seed tag.

## Exact Files Changed

- packages/db/prisma/seed-data/state-provider-catalog.ts
- docs/generated/state-provider-completeness-catalog.json
- docs/generated/state-provider-completeness-catalog.md
- docs/generated/state-provider-seed-diff.json
- docs/generated/state-provider-seed-diff.md
- docs/audits/providers/provider_additions_v1_batch2a_codex_review.csv
- docs/audits/providers/provider_additions_v1_batch2a_summary.md
- docs/audits/providers/provider_additions_v1_batch2a_final_safety_report.md

Batch 2 planning artifacts used as inputs and already present in the worktree:

- docs/audits/providers/provider_additions_v1_batch2_candidates.csv
- docs/audits/providers/provider_additions_v1_batch2_existing_updates.csv
- docs/audits/providers/provider_additions_v1_batch2_rejected.csv
- docs/audits/providers/provider_additions_v1_batch2_summary.md

## Final Counts

- Final raw provider count: 883
- Final sanitized provider count: 882
- Final coverage row count: 1823

## Verification

- pnpm audit:providers: passed. Raw provider records: 883. Sanitized provider records: 882. Dedupe removals: 1.
- pnpm audit:providers:coverage: passed. No coverage gaps found.
- pnpm audit:providers:state-completeness: passed with --skip-fetch. Generated provider docs changed because of real Batch 2A additions.
- pnpm --filter @locateflow/db exec tsc --noEmit: passed.
- pnpm --filter @locateflow/web exec tsc --noEmit: passed.
- pnpm --filter @locateflow/admin exec tsc --noEmit: passed.
- pnpm --filter @locateflow/mobile exec tsc --noEmit: passed.
- Provider matching/recommendation and move-task tests: passed, 10 files and 82 tests.
- Node runtime note: commands ran on Node v24.12.0 and emitted the expected repo engine warning for Node 22.x.

## Commit Recommendation

Safe to commit as Batch 2A. Active added count is 40, all selected rows are real water/sewer utility account providers, no rejected/manual/backlog rows became active, and audits/typechecks/tests passed.

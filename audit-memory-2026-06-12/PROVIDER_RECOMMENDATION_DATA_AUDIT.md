# Provider, Recommendation, AI/API/Data Audit

Status: source-reviewed, provider audit scripts executed.

## What Works

- Recommendation route is authenticated and workspace-scoped before loading user data.
- Provider candidate query uses active providers, effective state, and indexed `ServiceProviderCoverage`.
- Coverage tiers are deterministic: exact ZIP, ZIP prefix, polygon, state, live-address.
- Recommendation engine treats `fccServiceable` and `utilityServiceable` as `AVAILABLE_AT_ADDRESS`.
- FCC and OpenEI lookups degrade safely: disabled/missing key/network failure does not break recommendations.
- Tests cover recommendation routing, electric lookup matching, FCC lookup parsing, coverage tiering, and scoring.

## Verification Results

- Provider seed audit: 1122 raw / 1122 sanitized records.
- Critical coverage audit: no gaps across 51 states x 4 critical categories.
- Coverage surface inventory: 562 location-sensitive providers; 434 have ZIP rules; 118 state-scoped overbroad candidates; 39 federal address-qualified candidates.
- Web tests: 263 files / 2343 tests passed.
- Shared/provider-related tests are included in the web/mobile/shared test runs.

## Findings

1. FCC bulk ingest is still a documented stub.
   - File: `scripts/ingest/fcc-bulk-ingest.ts`
   - Impact: if new FCC bulk datasets were downloaded, they are not yet wired into local `ServiceProviderCoverage` unless a separate process loaded them. The current production path still relies on seed/coverage rows plus optional live FCC lookup.
   - Recommendation: implement streamed FCC bulk reader, block-to-ZIP/ZCTA crosswalk, and FCC provider-id/brand-to-catalog slug mapping. Add a CI smoke test that a known FCC row produces a coverage row.

2. Internet provider coverage remains address-qualified, not true local bulk coverage.
   - Evidence: 20 internet providers, 0 ZIP rules, 9 federal, 11 state, 88 state rows from the coverage inventory.
   - Impact: internet recommendations are only more precise when FCC lookup is configured and succeeds. Without it, many ISPs remain "check availability" recommendations.
   - Recommendation: prioritize FCC bulk ingest or a paid/official address-availability provider for internet.

3. Electric lookup is useful but not proof of installability.
   - File: `apps/web/src/lib/electric-utility.ts`
   - Impact: OpenEI URDB returns rate/utility data at coordinates; it is a strong signal, but municipal/co-op borders and rate filing gaps can still produce false negatives/ambiguity.
   - Recommendation: keep current "confidence, not promise" copy. For higher precision, add utility service-territory polygons from EIA/OpenEI/state utility commissions into coverage metadata.

4. Location-sensitive state-only provider candidates remain high risk.
   - Audit output: 118 state-scoped overbroad candidates.
   - Highest-risk categories: toll, transit, water, electric, gas.
   - Recommendation: continue converting high-risk rows to ZIP/polygon coverage, starting with `UTILITY_WATER` and `TRANSPORTATION_TRANSIT`, then electric/gas.

5. Provider data quality gaps are mostly completeness, not breakage.
   - Missing logo: 1122.
   - Missing phone: 454.
   - Cross-category domain duplicates: 58 buckets.
   - Recommendation: do not block release on this, but add governance queue thresholds and logo enrichment for top categories.

## External API Cross-Check

- OpenEI official docs confirm `/utility_rates` requires `version`, `format`, and `api_key`; supports `lat`, `lon`, `sector`, `approved`, and `limit`. The code uses `version=7&format=json&api_key=...&lat=...&lon=...&sector=Residential&approved=true&limit=20&detail=minimal`.
- FCC official materials confirm National Broadband Map public data API access requires a logged-in FCC account/API token, and public map data is provider-reported. The code's username/hash-value header approach matches the documented direction, but the exact `/api/public/map/availability/fixed?block=` endpoint should be smoke-tested with real credentials because FCC endpoint behavior has changed historically.

Sources:
- https://openei.org/services/doc/rest/util_rates/?version=7
- https://www.fcc.gov/sites/default/files/bdc-public-data-api-spec.pdf
- https://broadbandmap.fcc.gov/data-download

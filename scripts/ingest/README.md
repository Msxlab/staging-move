# `scripts/ingest/` — bulk serviceability dataset ingestion (scaffold)

This directory holds **bulk-dataset ingestion** jobs that turn large public
coverage datasets into the normalized `ServiceProviderCoverage` rows the
recommendation engine already understands.

Today, FCC ISP serviceability is resolved **per-request** at recommendation time
via `apps/web/src/lib/fcc-isp.ts` (a live FCC National Broadband Map / BDC API
lookup, cached in-process). That is correct for low/medium traffic and degrades
gracefully when unconfigured.

At scale, per-request FCC calls become the bottleneck. The answer is to ingest
the FCC's **bulk availability dataset** once (it updates ~twice a year) and write
provider→ZIP coverage rows into the DB, so the existing tiered matcher
(`exact → prefix → polygon → state → live_address`) resolves internet
serviceability from indexed local rows with **no live API call**.

## Why this is a scaffold (stub), not a finished job

The bulk FCC dataset is large (state-by-state CSVs keyed by census block), and
wiring a production ingestion needs decisions the owner must make first:

- **Where the dataset comes from.** Download the "Fixed Broadband" availability
  files from <https://broadbandmap.fcc.gov/data-download> (or the BDC bulk API).
  Decide cadence (manual vs cron) and storage (S3/Spaces vs ephemeral).
- **Block → ZIP rollup.** FCC availability is per census block. To use the
  existing `expandCoverageRows` (which is ZIP/state based) you must roll blocks
  up to ZIP/ZCTA. That crosswalk (HUD ZIP↔Tract, or Census block→ZCTA) is an
  owner-supplied input — see `fcc-bulk-ingest.ts` TODOs.
- **Provider identity mapping.** FCC `provider_id`/`brand_name` must be matched
  to catalog `ServiceProvider` slugs (same normalization as
  `normalizeIspName` in `apps/web/src/lib/fcc-isp.ts`).

## The pipeline it plugs into (already exists)

```
raw FCC rows ──► (block→ZIP rollup) ──► { providerSlug, scope, zipCodes[] }
            ──► expandCoverageRows()  // packages/shared — (scope,zips)→CoverageRow[]
            ──► rebuildProviderCoverage(tx, { providerId, scope, zipCodes })
                                       // packages/db — writes ServiceProviderCoverage
```

`expandCoverageRows` and `rebuildProviderCoverage` are the SAME functions the
seed pipeline uses, so ingested coverage behaves identically to seeded coverage
and the tiered matcher / recommendation engine need **zero changes**.

## Files

- `fcc-bulk-ingest.ts` — documented stub. Reads a (placeholder) FCC export,
  maps providers, rolls blocks up to ZIPs, and calls the real
  `rebuildProviderCoverage` pipeline. Marked `DRY RUN` by default; the network
  download + crosswalk steps are left as clearly-marked TODOs for the owner.

## Owner setup required to make this real

1. Obtain FCC bulk files (link above) — no API key needed for bulk downloads.
2. Provide a block→ZIP (ZCTA) crosswalk file.
3. Confirm provider slug mapping for the ISPs you carry in the catalog.
4. Run `pnpm tsx scripts/ingest/fcc-bulk-ingest.ts --apply` after reviewing the
   dry-run output.

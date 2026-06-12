# `scripts/ingest/` - bulk serviceability dataset ingestion

This directory holds bulk-dataset ingestion jobs that turn public coverage
datasets into normalized `ServiceProviderCoverage` rows.

## FCC fixed broadband

`fcc-bulk-ingest.ts` ingests FCC fixed-broadband availability exports into the
internet provider coverage table. It is a dry run by default and writes only
when `--apply` is passed.

Dry run:

```bash
pnpm tsx scripts/ingest/fcc-bulk-ingest.ts \
  --fcc ./data/fcc-fixed \
  --crosswalk ./data/fcc-geo-to-zip.csv \
  --mapping ./data/fcc-provider-map.csv
```

Apply:

```bash
pnpm tsx scripts/ingest/fcc-bulk-ingest.ts \
  --fcc ./data/fcc-fixed \
  --crosswalk ./data/fcc-geo-to-zip.csv \
  --mapping ./data/fcc-provider-map.csv \
  --apply
```

### Inputs

`--fcc` may be a CSV file or a directory of CSV/TXT files. Repeat the flag for
multiple roots. The reader streams rows and accepts common FCC/public-data column
names:

- Provider: `provider_id`, `frn`, `brand_name`, `provider_name`
- Geography: `block_geoid`, `geoid`, `location_id`, `fabric_location_id`
- Direct ZIP: `zip`, `zip_code`, `zcta`, `zcta5`
- Technology/speeds: `technology_code`, `technology`,
  `max_advertised_download_speed`, `max_advertised_upload_speed`

`--crosswalk` is required when FCC rows do not already contain ZIP/ZCTA. It maps
the FCC geography key to a ZIP/ZCTA:

```csv
block_geoid,zip
480010001001000,78701
```

or:

```csv
location_id,zcta
1234567890,78701
```

`--mapping` maps FCC provider identity to catalog `ServiceProvider.slug`. CSV:

```csv
provider_id,brand_name,provider_slug
111,,xfinity
,AT&T,att-fiber
```

JSON object:

```json
{
  "provider:111": "xfinity",
  "brand:AT&T": "att-fiber"
}
```

The script also tries conservative auto-matching against active
`UTILITY_INTERNET` catalog provider names, using the same ISP normalizer as the
live FCC lookup.

### Safety

- No external API calls are made.
- Dry run is the default.
- `--apply` rebuilds `ServiceProviderCoverage` only for matched provider slugs.
- The main `ServiceProvider` rows are not overwritten.
- Non-fixed technologies are ignored.
- Optional speed filters are available:

```bash
--min-download-mbps 100 --min-upload-mbps 20
```

Leave those unset to ingest all fixed service reports.

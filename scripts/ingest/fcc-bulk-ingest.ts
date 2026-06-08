/**
 * scripts/ingest/fcc-bulk-ingest.ts — FCC bulk serviceability ingestion (STUB)
 * ============================================================================
 *
 * Purpose
 * -------
 * Ingest the FCC National Broadband Map's BULK fixed-broadband availability
 * dataset into the catalog's `ServiceProviderCoverage` table, so internet
 * serviceability resolves from indexed local rows (the existing tiered matcher)
 * instead of a live per-request FCC API call (apps/web/src/lib/fcc-isp.ts).
 *
 * This is intentionally a DOCUMENTED STUB. It wires the *real* pipeline
 * (`expandCoverageRows` → `rebuildProviderCoverage`) but leaves the
 * owner-specific inputs (dataset download, block→ZIP crosswalk, provider
 * mapping) as clearly marked TODOs. It is safe to run: it does nothing
 * destructive unless `--apply` is passed, and even then it only writes coverage
 * for the sample rows you provide.
 *
 * Run (dry run, default):   pnpm tsx scripts/ingest/fcc-bulk-ingest.ts
 * Run (apply to DB):        pnpm tsx scripts/ingest/fcc-bulk-ingest.ts --apply
 *
 * Owner setup — see scripts/ingest/README.md for full details:
 *   1. Download FCC fixed-broadband files: https://broadbandmap.fcc.gov/data-download
 *   2. Provide a census-block → ZIP/ZCTA crosswalk.
 *   3. Confirm provider slug mapping for the ISPs in your catalog.
 * ============================================================================
 */

import { db, rebuildProviderCoverage } from "../../packages/db/src";
import { expandCoverageRows } from "../../packages/shared/src";

const APPLY = process.argv.includes("--apply");

/**
 * One normalized ingestion record: a catalog provider + the ZIPs the FCC bulk
 * dataset reports it serves. This is the shape the existing coverage pipeline
 * consumes — identical to how the seed pipeline feeds rebuildProviderCoverage.
 */
interface IngestRecord {
  providerSlug: string;
  scope: "FEDERAL" | "STATE";
  /** 5-digit ZIPs (or 3-digit prefixes) the provider serves, rolled up from blocks. */
  zipCodes: string[];
}

/**
 * STEP 1 — LOAD THE FCC BULK DATASET.
 *
 * TODO(owner): replace this placeholder with a real reader over the FCC
 * fixed-broadband availability export (CSV per state, keyed by census block).
 * Parse rows into `{ providerId, brandName, blockGeoid, technologyCode }`.
 * The files are large — stream them (e.g. csv-parse + node:stream) rather than
 * buffering. No API key is required for the bulk downloads.
 */
async function loadFccBulkRows(): Promise<
  Array<{ providerId: string; brandName: string; blockGeoid: string; technologyCode: number }>
> {
  // Placeholder: empty until the owner wires the real dataset reader.
  return [];
}

/**
 * STEP 2 — ROLL CENSUS BLOCKS UP TO ZIPs.
 *
 * FCC availability is per census block; the catalog coverage model is ZIP/state
 * based. TODO(owner): supply a block→ZIP (ZCTA) crosswalk (HUD or Census) and
 * map each blockGeoid to its ZIP here. Until then this returns nothing.
 */
function blockToZip(_blockGeoid: string): string | null {
  // TODO(owner): look up ZIP/ZCTA for the census block via your crosswalk.
  return null;
}

/**
 * STEP 3 — MAP FCC PROVIDERS TO CATALOG SLUGS.
 *
 * TODO(owner): match FCC provider_id / brand_name to your ServiceProvider
 * slugs. Reuse the SAME normalization as apps/web/src/lib/fcc-isp.ts
 * (`normalizeIspName`) so live-lookup and bulk-ingest agree on identity.
 */
function fccProviderToSlug(_providerId: string, _brandName: string): string | null {
  // TODO(owner): return the catalog slug for this FCC provider, or null to skip.
  return null;
}

/** Aggregate raw FCC rows into per-provider ZIP lists. */
async function buildIngestRecords(): Promise<IngestRecord[]> {
  const rows = await loadFccBulkRows();
  const bySlug = new Map<string, Set<string>>();

  for (const row of rows) {
    const slug = fccProviderToSlug(row.providerId, row.brandName);
    if (!slug) continue;
    const zip = blockToZip(row.blockGeoid);
    if (!zip) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, new Set());
    bySlug.get(slug)!.add(zip);
  }

  return [...bySlug.entries()].map(([providerSlug, zips]) => ({
    providerSlug,
    // Internet ISPs are STATE-scoped + ZIP-bounded in the catalog model.
    scope: "STATE" as const,
    zipCodes: [...zips],
  }));
}

async function main() {
  console.log(`[fcc-ingest] mode=${APPLY ? "APPLY" : "DRY RUN"}`);

  const records = await buildIngestRecords();
  if (records.length === 0) {
    console.log(
      "[fcc-ingest] No ingest records produced. This stub has no dataset wired yet — " +
        "see scripts/ingest/README.md for the owner setup (dataset download, " +
        "block→ZIP crosswalk, provider mapping).",
    );
    return;
  }

  let written = 0;
  for (const record of records) {
    // Preview the normalized coverage rows the pipeline WOULD write. This is the
    // exact same expansion the seed path uses, so behavior is identical.
    const previewRows = expandCoverageRows({
      scope: record.scope,
      zipCodes: record.zipCodes,
    });
    console.log(
      `[fcc-ingest] ${record.providerSlug}: ${record.zipCodes.length} zips → ${previewRows.length} coverage rows`,
    );

    if (!APPLY) continue;

    const provider = await db.serviceProvider.findUnique({
      where: { slug: record.providerSlug },
      select: { id: true },
    });
    if (!provider) {
      console.warn(`[fcc-ingest] skip: no ServiceProvider with slug "${record.providerSlug}"`);
      continue;
    }

    // The REAL pipeline — same function the seed uses. Writes normalized
    // ServiceProviderCoverage rows; the tiered matcher + recommendation engine
    // pick them up with no further changes.
    const count = await rebuildProviderCoverage(db, {
      providerId: provider.id,
      scope: record.scope,
      zipCodes: record.zipCodes,
    });
    written += count;
    console.log(`[fcc-ingest] applied ${count} rows for ${record.providerSlug}`);
  }

  console.log(`[fcc-ingest] done. ${APPLY ? `${written} rows written.` : "dry run — nothing written."}`);
}

main()
  .catch((err) => {
    console.error("[fcc-ingest] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => {});
  });

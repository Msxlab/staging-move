/**
 * FCC bulk fixed-broadband availability ingestion.
 *
 * Dry run:
 *   pnpm tsx scripts/ingest/fcc-bulk-ingest.ts --fcc ./data/fcc --crosswalk ./data/geo-zip.csv --mapping ./data/fcc-provider-map.csv
 *
 * Apply:
 *   pnpm tsx scripts/ingest/fcc-bulk-ingest.ts --fcc ./data/fcc --crosswalk ./data/geo-zip.csv --mapping ./data/fcc-provider-map.csv --apply
 *
 * Inputs:
 * - FCC CSV files: fixed broadband availability rows with provider/brand,
 *   technology, speed, and either a ZIP/ZCTA column or a geo key such as
 *   block_geoid/location_id.
 * - Crosswalk CSV: maps the FCC geo key (block_geoid/location_id/geoid) to
 *   ZIP/ZCTA when FCC rows do not contain ZIP directly.
 * - Provider mapping CSV/JSON: maps FCC provider_id and/or brand_name to
 *   catalog ServiceProvider.slug. The script also tries conservative auto-match
 *   against active UTILITY_INTERNET provider names.
 */

import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { db, rebuildProviderCoverage } from "../../packages/db/src";
import { expandCoverageRows, normalizeIspName, zipToState } from "../../packages/shared/src";

const FIXED_BROADBAND_TECH_CODES = new Set<number>([
  10, // Copper / DSL
  40, // Cable
  50, // Fiber
  60, // Geostationary satellite
  61, // Non-geostationary satellite
  70, // Unlicensed terrestrial fixed wireless
  71, // Licensed terrestrial fixed wireless
  72, // Licensed-by-rule terrestrial fixed wireless
]);

type CsvRow = Record<string, string>;

interface FccAvailabilityRow {
  providerId: string | null;
  brandName: string | null;
  geoKey: string | null;
  zip: string | null;
  technologyCode: number | null;
  maxDownloadMbps: number | null;
  maxUploadMbps: number | null;
}

export interface ProviderSlugMapping {
  byProviderId: Map<string, string>;
  byBrandName: Map<string, string>;
}

export interface CatalogProvider {
  slug: string;
  name: string;
}

export interface IngestRecord {
  providerSlug: string;
  scope: "STATE";
  zipCodes: string[];
}

export interface IngestStats {
  filesRead: number;
  rowsRead: number;
  rowsAccepted: number;
  skippedNoProvider: number;
  skippedNonFixedTechnology: number;
  skippedSpeedThreshold: number;
  skippedNoProviderMapping: number;
  skippedNoGeo: number;
  skippedNoZip: number;
  skippedStateFilter: number;
  unmappedBrands: Array<{ providerId: string | null; brandName: string | null }>;
}

export interface BuildIngestOptions {
  fccPaths: string[];
  crosswalkPath?: string | null;
  mappingPath?: string | null;
  catalogProviders?: CatalogProvider[];
  minDownloadMbps?: number;
  minUploadMbps?: number;
  state?: string | null;
  maxRows?: number | null;
}

export interface BuildIngestResult {
  records: IngestRecord[];
  stats: IngestStats;
}

interface CliOptions extends BuildIngestOptions {
  apply: boolean;
}

function createStats(): IngestStats {
  return {
    filesRead: 0,
    rowsRead: 0,
    rowsAccepted: 0,
    skippedNoProvider: 0,
    skippedNonFixedTechnology: 0,
    skippedSpeedThreshold: 0,
    skippedNoProviderMapping: 0,
    skippedNoGeo: 0,
    skippedNoZip: 0,
    skippedStateFilter: 0,
    unmappedBrands: [],
  };
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

async function forEachCsvRow(filePath: string, onRow: (row: CsvRow) => void | Promise<void>): Promise<number> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] | null = null;
  let count = 0;

  for await (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (!headers) {
      headers = parseCsvLine(line).map(normalizeHeader);
      continue;
    }
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").trim();
    });
    await onRow(row);
    count += 1;
  }

  return count;
}

function getField(row: CsvRow, aliases: readonly string[]): string | null {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return null;
}

function normalizeGeoKey(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^\d+\.0$/.test(raw)) return raw.slice(0, -2);
  return raw;
}

function normalizeZip(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  if (digits.length === 4) return digits.padStart(5, "0");
  if (digits.length === 3) return digits;
  return null;
}

function parseNumber(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseFccAvailabilityRow(row: CsvRow): FccAvailabilityRow {
  const providerId = getField(row, ["provider_id", "providerid", "frn", "provider frn"]);
  const brandName = getField(row, ["brand_name", "brandname", "provider_name", "providername", "doing_business_as"]);
  const geoKey = normalizeGeoKey(
    getField(row, [
      "block_geoid",
      "blockgeoid",
      "census_block",
      "censusblock",
      "block_fips",
      "blockfips",
      "geoid",
      "location_id",
      "locationid",
      "fabric_location_id",
      "fabriclocationid",
      "location",
    ]),
  );
  const zip = normalizeZip(getField(row, ["zip", "zipcode", "zip_code", "zcta", "zcta5", "zcta5ce20"]));
  return {
    providerId,
    brandName,
    geoKey,
    zip,
    technologyCode: parseNumber(getField(row, ["technology", "technology_code", "technologycode", "tech_code", "techcode"])),
    maxDownloadMbps: parseNumber(
      getField(row, ["max_advertised_download_speed", "maxadvertiseddownloadspeed", "max_down", "download_mbps"]),
    ),
    maxUploadMbps: parseNumber(
      getField(row, ["max_advertised_upload_speed", "maxadvertiseduploadspeed", "max_up", "upload_mbps"]),
    ),
  };
}

async function collectCsvFiles(inputs: string[]): Promise<string[]> {
  const files: string[] = [];

  async function visit(inputPath: string): Promise<void> {
    const abs = path.resolve(inputPath);
    const info = await stat(abs);
    if (info.isDirectory()) {
      const entries = await readdir(abs, { withFileTypes: true });
      for (const entry of entries) {
        await visit(path.join(abs, entry.name));
      }
      return;
    }
    if (info.isFile() && /\.(csv|txt)$/i.test(abs)) files.push(abs);
  }

  for (const input of inputs) {
    await visit(input);
  }

  return files.sort((a, b) => a.localeCompare(b));
}

export async function loadGeoZipCrosswalk(filePath?: string | null): Promise<Map<string, string>> {
  const crosswalk = new Map<string, string>();
  if (!filePath) return crosswalk;

  await forEachCsvRow(filePath, (row) => {
    const geoKey = normalizeGeoKey(
      getField(row, [
        "block_geoid",
        "blockgeoid",
        "census_block",
        "censusblock",
        "block_fips",
        "blockfips",
        "geoid",
        "location_id",
        "locationid",
        "fabric_location_id",
        "fabriclocationid",
        "location",
      ]),
    );
    const zip = normalizeZip(getField(row, ["zip", "zipcode", "zip_code", "zcta", "zcta5", "zcta5ce20"]));
    if (geoKey && zip && !crosswalk.has(geoKey)) {
      crosswalk.set(geoKey, zip);
    }
  });

  return crosswalk;
}

export function createProviderSlugMapping(): ProviderSlugMapping {
  return { byProviderId: new Map(), byBrandName: new Map() };
}

function addProviderMapping(
  mapping: ProviderSlugMapping,
  input: { providerId?: string | null; brandName?: string | null; key?: string | null; slug: string | null | undefined },
): void {
  const slug = input.slug?.trim();
  if (!slug) return;

  const providerId = normalizeGeoKey(input.providerId);
  if (providerId) mapping.byProviderId.set(providerId, slug);

  const brandName = normalizeIspName(input.brandName);
  if (brandName) mapping.byBrandName.set(brandName, slug);

  const key = input.key?.trim();
  if (!key) return;
  const prefixed = key.match(/^(provider|providerid|id|frn):(.*)$/i);
  if (prefixed?.[2]) {
    const id = normalizeGeoKey(prefixed[2]);
    if (id) mapping.byProviderId.set(id, slug);
    return;
  }
  const brandPrefixed = key.match(/^(brand|brandname|name):(.*)$/i);
  if (brandPrefixed?.[2]) {
    const brand = normalizeIspName(brandPrefixed[2]);
    if (brand) mapping.byBrandName.set(brand, slug);
    return;
  }
  if (/^\d+$/.test(key)) {
    mapping.byProviderId.set(key, slug);
  } else {
    const brand = normalizeIspName(key);
    if (brand) mapping.byBrandName.set(brand, slug);
  }
}

export async function loadProviderSlugMapping(filePath?: string | null): Promise<ProviderSlugMapping> {
  const mapping = createProviderSlugMapping();
  if (!filePath) return mapping;

  if (/\.json$/i.test(filePath)) {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (!entry || typeof entry !== "object") continue;
        const obj = entry as Record<string, unknown>;
        addProviderMapping(mapping, {
          providerId: String(obj.providerId ?? obj.provider_id ?? obj.frn ?? ""),
          brandName: String(obj.brandName ?? obj.brand_name ?? obj.name ?? ""),
          slug: String(obj.providerSlug ?? obj.provider_slug ?? obj.slug ?? ""),
        });
      }
    } else if (parsed && typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        addProviderMapping(mapping, { key, slug: typeof value === "string" ? value : null });
      }
    }
    return mapping;
  }

  await forEachCsvRow(filePath, (row) => {
    addProviderMapping(mapping, {
      providerId: getField(row, ["provider_id", "providerid", "frn"]),
      brandName: getField(row, ["brand_name", "brandname", "provider_name", "providername", "name"]),
      slug: getField(row, ["provider_slug", "providerslug", "slug", "catalog_slug", "catalogslug"]),
    });
  });

  return mapping;
}

function buildCatalogIndex(catalogProviders: CatalogProvider[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();

  function add(key: string, slug: string): void {
    const normalized = normalizeIspName(key);
    if (!normalized) return;
    if (!index.has(normalized)) index.set(normalized, new Set());
    index.get(normalized)!.add(slug);
  }

  for (const provider of catalogProviders) {
    add(provider.name, provider.slug);
    add(provider.slug, provider.slug);
  }

  return index;
}

function findUniqueCatalogSlug(normalizedBrand: string, catalogIndex: Map<string, Set<string>>): string | null {
  const exact = catalogIndex.get(normalizedBrand);
  if (exact?.size === 1) return [...exact][0]!;
  if (!normalizedBrand || normalizedBrand.length < 4) return null;

  const candidates = new Set<string>();
  for (const [catalogName, slugs] of catalogIndex.entries()) {
    if (catalogName.length < 4) continue;
    if (catalogName.startsWith(normalizedBrand) || normalizedBrand.startsWith(catalogName)) {
      slugs.forEach((slug) => candidates.add(slug));
      continue;
    }
    if (normalizedBrand.length >= 5 && catalogName.includes(normalizedBrand)) {
      slugs.forEach((slug) => candidates.add(slug));
    }
  }

  return candidates.size === 1 ? [...candidates][0]! : null;
}

function resolveProviderSlug(
  row: FccAvailabilityRow,
  mapping: ProviderSlugMapping,
  catalogIndex: Map<string, Set<string>>,
): string | null {
  const providerId = normalizeGeoKey(row.providerId);
  if (providerId && mapping.byProviderId.has(providerId)) return mapping.byProviderId.get(providerId)!;

  const normalizedBrand = normalizeIspName(row.brandName);
  if (normalizedBrand && mapping.byBrandName.has(normalizedBrand)) {
    return mapping.byBrandName.get(normalizedBrand)!;
  }

  return normalizedBrand ? findUniqueCatalogSlug(normalizedBrand, catalogIndex) : null;
}

function addUnmapped(stats: IngestStats, row: FccAvailabilityRow): void {
  if (stats.unmappedBrands.length >= 25) return;
  const exists = stats.unmappedBrands.some(
    (entry) => entry.providerId === row.providerId && entry.brandName === row.brandName,
  );
  if (!exists) stats.unmappedBrands.push({ providerId: row.providerId, brandName: row.brandName });
}

function passesSpeedThreshold(row: FccAvailabilityRow, options: BuildIngestOptions): boolean {
  const minDown = options.minDownloadMbps ?? 0;
  const minUp = options.minUploadMbps ?? 0;
  if (minDown > 0 && (row.maxDownloadMbps === null || row.maxDownloadMbps < minDown)) return false;
  if (minUp > 0 && (row.maxUploadMbps === null || row.maxUploadMbps < minUp)) return false;
  return true;
}

async function loadCatalogProviders(): Promise<CatalogProvider[]> {
  return await db.serviceProvider.findMany({
    where: { category: "UTILITY_INTERNET", isActive: true },
    select: { slug: true, name: true },
  });
}

export async function buildIngestRecords(options: BuildIngestOptions): Promise<BuildIngestResult> {
  if (options.fccPaths.length === 0) {
    throw new Error("At least one --fcc file or directory is required.");
  }

  const stats = createStats();
  const [fccFiles, crosswalk, mapping, catalogProviders] = await Promise.all([
    collectCsvFiles(options.fccPaths),
    loadGeoZipCrosswalk(options.crosswalkPath),
    loadProviderSlugMapping(options.mappingPath),
    Promise.resolve(options.catalogProviders ?? loadCatalogProviders()),
  ]);
  const catalogIndex = buildCatalogIndex(catalogProviders);
  const bySlug = new Map<string, Set<string>>();
  const stateFilter = options.state?.trim().toUpperCase() || null;
  const maxRows = options.maxRows ?? null;

  for (const file of fccFiles) {
    stats.filesRead += 1;
    await forEachCsvRow(file, (csvRow) => {
      if (maxRows !== null && stats.rowsRead >= maxRows) return;
      stats.rowsRead += 1;
      const row = parseFccAvailabilityRow(csvRow);

      if (!row.providerId && !row.brandName) {
        stats.skippedNoProvider += 1;
        return;
      }
      if (row.technologyCode !== null && !FIXED_BROADBAND_TECH_CODES.has(row.technologyCode)) {
        stats.skippedNonFixedTechnology += 1;
        return;
      }
      if (!passesSpeedThreshold(row, options)) {
        stats.skippedSpeedThreshold += 1;
        return;
      }

      const slug = resolveProviderSlug(row, mapping, catalogIndex);
      if (!slug) {
        stats.skippedNoProviderMapping += 1;
        addUnmapped(stats, row);
        return;
      }

      if (!row.zip && !row.geoKey) {
        stats.skippedNoGeo += 1;
        return;
      }
      const zip = row.zip || (row.geoKey ? crosswalk.get(row.geoKey) ?? null : null);
      if (!zip) {
        stats.skippedNoZip += 1;
        return;
      }
      if (stateFilter && zipToState(zip) !== stateFilter) {
        stats.skippedStateFilter += 1;
        return;
      }

      if (!bySlug.has(slug)) bySlug.set(slug, new Set());
      bySlug.get(slug)!.add(zip);
      stats.rowsAccepted += 1;
    });
    if (maxRows !== null && stats.rowsRead >= maxRows) break;
  }

  const records = [...bySlug.entries()]
    .map(([providerSlug, zips]) => ({
      providerSlug,
      scope: "STATE" as const,
      zipCodes: [...zips].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.providerSlug.localeCompare(b.providerSlug));

  return { records, stats };
}

function usage(): string {
  return [
    "FCC bulk ingest",
    "",
    "Required:",
    "  --fcc <file-or-dir>       FCC availability CSV file or directory. Repeatable.",
    "",
    "Optional:",
    "  --crosswalk <file>        CSV mapping block_geoid/location_id/geoid to ZIP/ZCTA.",
    "  --mapping <file>          CSV or JSON mapping FCC provider IDs/brands to ServiceProvider slugs.",
    "  --apply                   Write ServiceProviderCoverage rows. Default is dry run.",
    "  --state <USPS>            Only ingest ZIPs in one state.",
    "  --min-download-mbps <n>   Optional speed floor. Default 0.",
    "  --min-upload-mbps <n>     Optional speed floor. Default 0.",
    "  --max-rows <n>            Debug limit.",
  ].join("\n");
}

function readNumberFlag(name: string, raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number.`);
  return value;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    fccPaths: [],
    apply: false,
    crosswalkPath: null,
    mappingPath: null,
    minDownloadMbps: 0,
    minUploadMbps: 0,
    state: null,
    maxRows: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const [flag, inlineValue] = arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const nextValue = () => {
      const value = inlineValue ?? argv[++i];
      if (!value) throw new Error(`${flag} requires a value.`);
      return value;
    };

    switch (flag) {
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
      case "--apply":
        options.apply = true;
        break;
      case "--fcc":
      case "--input":
        options.fccPaths.push(nextValue());
        break;
      case "--crosswalk":
        options.crosswalkPath = nextValue();
        break;
      case "--mapping":
      case "--provider-map":
        options.mappingPath = nextValue();
        break;
      case "--state":
        options.state = nextValue().trim().toUpperCase();
        break;
      case "--min-download-mbps":
        options.minDownloadMbps = readNumberFlag(flag, nextValue());
        break;
      case "--min-upload-mbps":
        options.minUploadMbps = readNumberFlag(flag, nextValue());
        break;
      case "--max-rows":
        options.maxRows = readNumberFlag(flag, nextValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  return options;
}

function logStats(stats: IngestStats): void {
  console.log(
    [
      `[fcc-ingest] files=${stats.filesRead}`,
      `rows=${stats.rowsRead}`,
      `accepted=${stats.rowsAccepted}`,
      `noProvider=${stats.skippedNoProvider}`,
      `nonFixedTech=${stats.skippedNonFixedTechnology}`,
      `speedFiltered=${stats.skippedSpeedThreshold}`,
      `noMapping=${stats.skippedNoProviderMapping}`,
      `noGeo=${stats.skippedNoGeo}`,
      `noZip=${stats.skippedNoZip}`,
      `stateFiltered=${stats.skippedStateFilter}`,
    ].join(" "),
  );
  if (stats.unmappedBrands.length > 0) {
    console.log("[fcc-ingest] sample unmapped providers:");
    for (const item of stats.unmappedBrands) {
      console.log(`  - providerId=${item.providerId ?? "<none>"} brand="${item.brandName ?? "<none>"}"`);
    }
  }
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  console.log(`[fcc-ingest] mode=${options.apply ? "APPLY" : "DRY RUN"}`);

  const { records, stats } = await buildIngestRecords(options);
  logStats(stats);

  if (records.length === 0) {
    console.log("[fcc-ingest] no coverage records produced.");
    return;
  }

  let written = 0;
  for (const record of records) {
    const previewRows = expandCoverageRows({
      scope: record.scope,
      zipCodes: record.zipCodes,
    });
    console.log(
      `[fcc-ingest] ${record.providerSlug}: ${record.zipCodes.length} ZIPs -> ${previewRows.length} coverage rows`,
    );

    if (!options.apply) continue;

    const provider = await db.serviceProvider.findUnique({
      where: { slug: record.providerSlug },
      select: { id: true },
    });
    if (!provider) {
      console.warn(`[fcc-ingest] skip: no active ServiceProvider with slug "${record.providerSlug}"`);
      continue;
    }

    const count = await rebuildProviderCoverage(db, {
      providerId: provider.id,
      scope: record.scope,
      zipCodes: record.zipCodes,
    });
    written += count;
    console.log(`[fcc-ingest] applied ${count} rows for ${record.providerSlug}`);
  }

  console.log(`[fcc-ingest] done. ${options.apply ? `${written} rows written.` : "dry run - nothing written."}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const thisPath = fileURLToPath(import.meta.url);

if (invokedPath === thisPath) {
  runCli()
    .catch((err) => {
      console.error("[fcc-ingest] failed:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect().catch(() => {});
    });
}

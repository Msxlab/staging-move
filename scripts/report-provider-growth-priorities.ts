import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  buildProviderQualitySnapshot,
  buildProviderQueryDiagnostics,
  getCategoryLabel,
  sanitizeProviderSeedRecords,
  type ProviderQualityRecord,
} from "../packages/shared/src";
import {
  FEDERAL_NEW as RAW_FEDERAL_NEW,
  STATE_DMVS,
  STATE_PROVIDERS as RAW_STATE_PROVIDERS,
} from "../packages/db/prisma/seed-data/providers";
import { applyProviderCoverageOverrides } from "../packages/db/prisma/seed-data/provider-coverage-overrides";
import { STATE_PROVIDER_EXPANSIONS } from "../packages/db/prisma/seed-data/state-provider-catalog";

interface CliOptions {
  json: boolean;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
}

interface LoadResult {
  records: ProviderQualityRecord[];
  source: "database" | "seed";
  note: string | null;
}

type RawProvider = {
  name: string;
  slug?: string;
  category: string;
  subCategory?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  scope?: string | null;
  states?: string[];
  zipCodes?: string[];
  tags?: string[];
  popularityScore?: number;
  isActive?: boolean;
  displayOrder?: number;
  coverageModel?: string | null;
};

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptions(): CliOptions {
  return {
    json: hasFlag("json"),
    state: getArg("state")?.trim().toUpperCase() || null,
    zip: getArg("zip")?.trim() || null,
    lat: parseNumber(getArg("lat")),
    lng: parseNumber(getArg("lng")),
  };
}

function toQualityRecord(provider: any): ProviderQualityRecord {
  return {
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    category: provider.category,
    subCategory: provider.subCategory,
    description: provider.description,
    website: provider.website,
    phone: provider.phone,
    logoUrl: provider.logoUrl,
    scope: provider.scope,
    states: provider.states as string[] | string | null,
    zipCodes: provider.zipCodes as string[] | string | null,
    tags: provider.tags as string[] | string | null,
    popularityScore: provider.popularityScore,
    isActive: provider.isActive,
    displayOrder: provider.displayOrder,
    coverageModel: provider.coverageModel,
    deletedAt: provider.deletedAt,
    updatedAt: provider.updatedAt,
    coverages: provider.coverages,
  };
}

function loadSeedProviderRecords(): ProviderQualityRecord[] {
  const rawProviders: RawProvider[] = [
    ...(applyProviderCoverageOverrides(RAW_FEDERAL_NEW) as RawProvider[]),
    ...(STATE_DMVS.map((provider) => ({
      ...provider,
      category: "GOVERNMENT_DMV",
      scope: "STATE",
    })) as RawProvider[]),
    ...(applyProviderCoverageOverrides([
      ...RAW_STATE_PROVIDERS,
      ...STATE_PROVIDER_EXPANSIONS,
    ]) as RawProvider[]),
  ];

  return sanitizeProviderSeedRecords(rawProviders).providers.map((provider) => ({
    ...provider,
    isActive: provider.isActive ?? true,
  }));
}

async function loadProviderRecords(): Promise<LoadResult> {
  const prisma = new PrismaClient();
  try {
    const providers = await prisma.serviceProvider.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        subCategory: true,
        description: true,
        website: true,
        phone: true,
        logoUrl: true,
        scope: true,
        states: true,
        zipCodes: true,
        tags: true,
        popularityScore: true,
        displayOrder: true,
        isActive: true,
        coverageModel: true,
        deletedAt: true,
        updatedAt: true,
        coverages: {
          select: {
            state: true,
            zipPrefix: true,
            zipExact: true,
          },
        },
      },
    });
    return {
      records: providers.map(toQualityRecord),
      source: "database",
      note: null,
    };
  } catch (error: any) {
    const message = String(error?.message || error || "");
    if (message.includes("DATABASE_URL")) {
      return {
        records: loadSeedProviderRecords(),
        source: "seed",
        note: "DATABASE_URL is not configured, so this report used the seed catalog fallback.",
      };
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function printTextReport(loadResult: LoadResult, options: CliOptions): void {
  const { records } = loadResult;
  const snapshot = buildProviderQualitySnapshot(records);
  const queryDiagnostics =
    options.state || options.zip
      ? buildProviderQueryDiagnostics(records, {
          state: options.state,
          zip: options.zip,
          lat: options.lat,
          lng: options.lng,
        })
      : null;

  console.log("Provider growth priorities");
  console.log(`Generated: ${snapshot.generatedAt}`);
  console.log(`Source: ${loadResult.source}`);
  if (loadResult.note) console.log(`Note: ${loadResult.note}`);
  console.log("");
  console.log("Summary");
  console.log(`- Active providers: ${snapshot.summary.activeProviders}`);
  console.log(`- Categories: ${snapshot.summary.categoryCount}`);
  console.log(`- Location-sensitive providers: ${snapshot.summary.locationSensitiveProviders}`);
  console.log(`- Location-sensitive non-state coverage: ${snapshot.summary.locationSensitiveNonStateCoverage}`);
  console.log(`- State-scoped overbroad providers: ${snapshot.summary.stateScopedOverbroadProviders}`);
  console.log(`- Sparse categories: ${snapshot.summary.sparseCategoryCount}`);
  console.log(`- Thin states below ${snapshot.summary.thinStateThreshold}: ${snapshot.summary.thinStateCount}`);
  console.log("");

  console.log("Coverage models");
  for (const model of snapshot.coverageModels) {
    console.log(`- ${model.model}: ${model.count}`);
  }
  console.log("");

  console.log("Priority backlog");
  for (const item of snapshot.priorityItems) {
    console.log(`- [${item.priority}] ${item.title}`);
    console.log(`  Area: ${item.affectedArea}`);
    console.log(`  Recommendation: ${item.recommendation}`);
    console.log(`  Evidence: ${item.evidence}`);
  }
  console.log("");

  console.log("Sparse categories");
  for (const row of snapshot.sparseCategories.slice(0, 15)) {
    console.log(`- ${getCategoryLabel(row.category)} (${row.category}): ${row.count}`);
  }
  console.log("");

  console.log("Thin states");
  for (const row of snapshot.thinStates.slice(0, 15)) {
    console.log(`- ${row.state}: ${row.stateProviderCount} providers, ${row.categoryCount} categories`);
  }

  if (queryDiagnostics) {
    console.log("");
    console.log("Query diagnostic");
    console.log(`- Input state: ${queryDiagnostics.input.state || "none"}`);
    console.log(`- Input ZIP: ${queryDiagnostics.input.normalizedZip || "none"}`);
    console.log(`- Effective state: ${queryDiagnostics.input.effectiveState || "none"}`);
    console.log(`- Candidate providers: ${queryDiagnostics.candidateCount}`);
    console.log(`- Address-check candidates: ${queryDiagnostics.addressCheckCandidateCount}`);
    console.log("- Match levels:");
    for (const row of queryDiagnostics.matchCounts.filter((item) => item.count > 0)) {
      console.log(`  - ${row.matchLevel}: ${row.count}`);
    }
    console.log("- Top providers:");
    for (const provider of queryDiagnostics.topProviders.slice(0, 10)) {
      console.log(
        `  - ${provider.name} (${getCategoryLabel(provider.category)}): ${provider.matchLevel}, ${provider.coverageModel}, warnings=${provider.warningCodes.length}`,
      );
    }
  }
}

async function main() {
  const options = parseOptions();
  const loadResult = await loadProviderRecords();

  if (options.json) {
    const { records } = loadResult;
    const snapshot = buildProviderQualitySnapshot(records);
    const queryDiagnostics = buildProviderQueryDiagnostics(records, {
      state: options.state,
      zip: options.zip,
      lat: options.lat,
      lng: options.lng,
    });
    console.log(JSON.stringify({ source: loadResult.source, note: loadResult.note, snapshot, queryDiagnostics }, null, 2));
    return;
  }

  printTextReport(loadResult, options);
}

main().catch((error) => {
  console.error("Failed to build provider growth report:", error?.message || error);
  process.exitCode = 1;
});

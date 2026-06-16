import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const criticalCategories = [
  "GOVERNMENT_DMV",
  "GOVERNMENT_POSTAL",
  "UTILITY_ELECTRIC",
  "UTILITY_GAS",
  "UTILITY_WATER",
  "UTILITY_INTERNET",
  "FINANCIAL_BANK",
  "FINANCIAL_INSURANCE_AUTO",
  "FINANCIAL_INSURANCE_RENTERS",
];

type SmokeCase = {
  label: string;
  state: string;
  zip: string;
  category: string;
  expectedAny: string[];
  forbidden?: string[];
  warnIfOnly?: string[];
};

const smokeCases: SmokeCase[] = [
  {
    label: "Austin electric delivery/municipal check",
    state: "TX",
    zip: "78701",
    category: "UTILITY_ELECTRIC",
    expectedAny: ["Austin Energy", "City of Austin"],
    warnIfOnly: ["Reliant Energy", "TXU Energy"],
  },
  {
    label: "Miami electric territory check",
    state: "FL",
    zip: "33101",
    category: "UTILITY_ELECTRIC",
    expectedAny: ["Florida Power", "FPL"],
    forbidden: ["Orlando Utilities Commission"],
  },
  {
    label: "Manhattan electric check",
    state: "NY",
    zip: "10019",
    category: "UTILITY_ELECTRIC",
    expectedAny: ["Con Edison", "Consolidated Edison"],
  },
  {
    label: "San Francisco electric check",
    state: "CA",
    zip: "94105",
    category: "UTILITY_ELECTRIC",
    expectedAny: ["PG&E", "Pacific Gas"],
  },
];

function parseJsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function nameIncludesAny(name: string, needles: string[]): boolean {
  const normalized = normalizedName(name);
  return needles.some((needle) => normalized.includes(normalizedName(needle)));
}

function providerMatchesZip(
  provider: {
    scope: string;
    coverageModel: string | null;
    zipCodes: string;
    coverages: Array<{ state: string | null; zipPrefix: string | null; zipExact: string | null }>;
  },
  state: string,
  zip: string,
): boolean {
  const coverages = provider.coverages || [];
  const zipCodes = parseJsonList(provider.zipCodes);
  const coverageModel = provider.coverageModel || (zipCodes.length > 0 ? "zip_prefix" : "live_address");
  const isFederalFallback = provider.scope === "FEDERAL" && coverages.length === 0;
  let hasStateCoverage = isFederalFallback;
  let hasAnyStateCoverage = false;
  let hasMatchingStateCoverage = isFederalFallback;
  let hasZipScopedCoverage = zipCodes.length > 0;

  for (const prefix of zipCodes) {
    if (zip.startsWith(prefix)) return true;
  }

  for (const coverage of coverages) {
    const matchesState = !coverage.state || coverage.state === state;
    if (coverage.state) {
      hasAnyStateCoverage = true;
      if (matchesState) hasMatchingStateCoverage = true;
    }
    if (coverage.zipExact || coverage.zipPrefix) hasZipScopedCoverage = true;
    if (matchesState && coverage.zipExact && coverage.zipExact === zip) return true;
    if (matchesState && coverage.zipPrefix && zip.startsWith(coverage.zipPrefix)) return true;
    if (matchesState && coverage.state && !coverage.zipExact && !coverage.zipPrefix) hasStateCoverage = true;
  }

  if (provider.scope !== "FEDERAL" && hasAnyStateCoverage && !hasMatchingStateCoverage) return false;
  if (hasZipScopedCoverage && !hasStateCoverage) return false;
  if (coverageModel === "live_address" || coverageModel === "polygon") return hasMatchingStateCoverage;
  return hasStateCoverage;
}

async function runSmokeCases() {
  console.log("Provider quality smoke cases:");
  for (const smoke of smokeCases) {
    const candidates = await prisma.serviceProvider.findMany({
      where: {
        isActive: true,
        category: smoke.category,
        OR: [{ scope: "FEDERAL" }, { coverages: { some: { state: smoke.state } } }],
      },
      select: {
        name: true,
        scope: true,
        coverageModel: true,
        zipCodes: true,
        coverages: {
          where: { state: smoke.state },
          select: { state: true, zipPrefix: true, zipExact: true },
        },
      },
      orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
    });
    const matched = candidates.filter((provider) => providerMatchesZip(provider, smoke.state, smoke.zip));
    const names = matched.map((provider) => provider.name);
    const hasExpected = names.some((name) => nameIncludesAny(name, smoke.expectedAny));
    const forbiddenNames = (smoke.forbidden || []).filter((needle) =>
      names.some((name) => nameIncludesAny(name, [needle])),
    );
    const onlyWarnNames =
      smoke.warnIfOnly && names.length > 0 && names.every((name) => nameIncludesAny(name, smoke.warnIfOnly))
        ? smoke.warnIfOnly
        : [];

    const status =
      hasExpected && forbiddenNames.length === 0 && onlyWarnNames.length === 0
        ? "PASS"
        : hasExpected && forbiddenNames.length === 0
          ? "WARN"
          : "FAIL";
    console.log(`- ${status} | ${smoke.label} | ${smoke.state} ${smoke.zip} ${smoke.category}`);
    console.log(`  matched: ${names.length > 0 ? names.join(", ") : "none"}`);
    if (!hasExpected) console.log(`  missing expected: ${smoke.expectedAny.join(" / ")}`);
    if (forbiddenNames.length > 0) console.log(`  forbidden present: ${forbiddenNames.join(", ")}`);
    if (onlyWarnNames.length > 0) console.log(`  weak-only match: ${onlyWarnNames.join(", ")}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL is not set. Run this in the DigitalOcean App Platform console for staging DB diagnostics.");
    return;
  }

  const [
    serviceProviderCount,
    activeProviderCount,
    coverageCount,
    njCoverageCount,
    federalProviderCount,
    providersByCategory,
    coveragesByState,
    njProviders,
  ] = await Promise.all([
    prisma.serviceProvider.count(),
    prisma.serviceProvider.count({ where: { isActive: true } }),
    prisma.serviceProviderCoverage.count(),
    prisma.serviceProviderCoverage.count({ where: { state: "NJ" } }),
    prisma.serviceProvider.count({ where: { isActive: true, scope: "FEDERAL" } }),
    prisma.serviceProvider.groupBy({
      by: ["category"],
      where: { isActive: true },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
    }),
    prisma.serviceProviderCoverage.groupBy({
      by: ["state"],
      where: { state: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { state: "desc" } },
      take: 20,
    }),
    prisma.serviceProvider.findMany({
      where: {
        isActive: true,
        OR: [{ scope: "FEDERAL" }, { coverages: { some: { state: "NJ" } } }],
      },
      select: {
        name: true,
        category: true,
        scope: true,
      },
      orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
      take: 20,
    }),
  ]);

  const njCategoryCounts = await prisma.serviceProvider.groupBy({
    by: ["category"],
    where: {
      isActive: true,
      OR: [{ scope: "FEDERAL" }, { coverages: { some: { state: "NJ" } } }],
    },
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
  });

  const njCategories = new Set(njCategoryCounts.map((row) => row.category));
  const missingCriticalCategories = criticalCategories.filter((category) => !njCategories.has(category));

  console.log("LocateFlow staging provider data audit");
  console.log("--------------------------------------");
  console.log(`ServiceProvider count: ${serviceProviderCount}`);
  console.log(`Active provider count: ${activeProviderCount}`);
  console.log(`ServiceProviderCoverage count: ${coverageCount}`);
  console.log(`Federal active provider count: ${federalProviderCount}`);
  console.log(`NJ coverage row count: ${njCoverageCount}`);
  console.log(`NJ/federal active provider candidates: ${njProviders.length}`);
  console.log("");
  console.log("Top active categories:");
  for (const row of providersByCategory.slice(0, 20)) {
    console.log(`- ${row.category}: ${row._count._all}`);
  }
  console.log("");
  console.log("Top coverage states:");
  for (const row of coveragesByState) {
    console.log(`- ${row.state}: ${row._count._all}`);
  }
  console.log("");
  console.log("NJ category counts:");
  for (const row of njCategoryCounts.slice(0, 20)) {
    console.log(`- ${row.category}: ${row._count._all}`);
  }
  console.log("");
  console.log("Top NJ/federal provider candidates:");
  for (const provider of njProviders) {
    console.log(`- ${provider.name} | ${provider.category} | ${provider.scope}`);
  }
  console.log("");
  console.log("Missing critical categories for NJ:");
  if (missingCriticalCategories.length === 0) {
    console.log("- none");
  } else {
    for (const category of missingCriticalCategories) console.log(`- ${category}`);
  }
  console.log("");
  await runSmokeCases();
  console.log("");
  if (serviceProviderCount === 0) {
    console.log("Likely root cause: provider seed has not been loaded into this database.");
  } else if (coverageCount === 0 || (federalProviderCount === 0 && njCoverageCount === 0)) {
    console.log("Likely root cause: provider rows exist, but active federal/NJ coverage rows are missing.");
  } else if (njProviders.length === 0) {
    console.log("Likely root cause: active provider coverage does not include NJ or federal fallback candidates.");
  } else {
    console.log("Provider data exists for NJ/federal candidates; inspect API/UI filters next.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Provider data audit failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

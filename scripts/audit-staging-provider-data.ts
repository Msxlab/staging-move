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

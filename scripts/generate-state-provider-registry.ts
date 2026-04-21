import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawProvidersModule = require("../packages/db/prisma/seed-data/providers");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mergedProvidersModule = require("../packages/db/prisma/seed-data/provider-seed");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const catalogModule = require("../packages/db/prisma/seed-data/state-provider-catalog");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const integrityModule = require("../packages/shared/src/provider-integrity");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const coverageModule = require("../packages/shared/src/provider-coverage");

const { STATE_PROVIDERS: RAW_STATE_PROVIDERS } = rawProvidersModule as {
  STATE_PROVIDERS: ProviderRecord[];
};

const { STATE_PROVIDERS: MERGED_STATE_PROVIDERS } = mergedProvidersModule as {
  STATE_PROVIDERS: ProviderRecord[];
};

const { STATE_PROVIDER_COMPLETENESS_CATALOG } = catalogModule as {
  STATE_PROVIDER_COMPLETENESS_CATALOG: CatalogEntry[];
};

const {
  sanitizeProviderSeedRecords,
  normalizeProviderRecord,
} = integrityModule as {
  sanitizeProviderSeedRecords: <T extends ProviderRecord>(records: T[]) => { providers: T[] };
  normalizeProviderRecord: <T extends ProviderRecord>(record: T) => T & NormalizedProvider;
};

const { expandCoverageRows } = coverageModule as {
  expandCoverageRows: (input: {
    scope: string;
    states?: string[] | string | null;
    zipCodes?: string[] | string | null;
  }) => Array<{ state: string | null }>;
};

type ProviderRecord = {
  name: string;
  slug?: string;
  category: string;
  website?: string;
  scope?: string;
  states?: string[];
  zipCodes?: string[];
};

type NormalizedProvider = {
  name: string;
  slug: string;
  category: string;
  website?: string;
  scope: string;
  states: string[];
  zipCodes: string[];
};

type CatalogEntry = {
  providerName: string;
  states: string[];
  category: string;
  officialUrl: string;
  coverageModel: "state" | "zip_prefix" | "polygon" | "live_address";
  note: string;
  legacyNames?: string[];
  seedRecord?: {
    name: string;
    slug: string;
    category: string;
    website: string;
    states: string[];
    zipCodes?: string[];
  };
};

type ResearchStatus = "resolved" | "partial" | "blocked";
type ZipRemediationPath =
  | "seed_exact_or_prefix_after_lookup"
  | "requires_live_address_check"
  | "needs_polygon_or_corridor_model"
  | "state_only_ok"
  | "manual_research_required";

type ResearchEntry = {
  name: string;
  slug: string;
  category: string;
  scope: string;
  states: string[];
  website: string | null;
  repoCoverage: {
    zipRules: number;
    modeledAsStateOnly: boolean;
  };
  officialResearch: {
    status: ResearchStatus;
    zipRemediationPath: ZipRemediationPath;
    bestUrl: string | null;
    title: string | null;
    sourceType: string;
    sourceConfidence: "high" | "medium" | "low";
    error?: string | null;
  };
};

type RegistryProvider = {
  name: string;
  slug: string | null;
  category: string;
  source: "existing_seed" | "catalog_added" | "catalog_backlog";
  currentModel: "state" | "zip_prefix" | "catalog_only";
  nextWave: "none" | "promote_zip" | "live_address" | "polygon" | "manual_research";
  officialUrl: string;
  officialStatus: ResearchStatus | "catalog_only";
  sourceConfidence: "high" | "medium" | "low" | "catalog";
  note: string | null;
  website: string | null;
  zipRuleCount: number;
};

const ALL_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
] as const;

const CATEGORY_ORDER = [
  "UTILITY_ELECTRIC",
  "UTILITY_GAS",
  "UTILITY_WATER",
  "UTILITY_INTERNET",
  "TRANSPORTATION_TRANSIT",
  "TRANSPORTATION_TOLL",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  UTILITY_ELECTRIC: "Electric",
  UTILITY_GAS: "Gas",
  UTILITY_WATER: "Water",
  UTILITY_INTERNET: "Internet",
  TRANSPORTATION_TRANSIT: "Transit",
  TRANSPORTATION_TOLL: "Toll",
};

function simplifyName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProviders(records: ProviderRecord[]) {
  return sanitizeProviderSeedRecords(records).providers.map((provider) =>
    normalizeProviderRecord(provider)
  );
}

function getProviderStates(provider: NormalizedProvider) {
  const states = new Set<string>();
  const rows = expandCoverageRows({
    scope: provider.scope,
    states: provider.states,
    zipCodes: provider.zipCodes,
  });

  for (const row of rows) {
    if (row.state) states.add(row.state);
  }

  for (const state of provider.states) {
    if (state) states.add(state);
  }

  return [...states].sort();
}

function buildCatalogKeys(entry: CatalogEntry) {
  const keys = new Set<string>();
  keys.add(simplifyName(entry.providerName));
  for (const legacyName of entry.legacyNames || []) {
    keys.add(simplifyName(legacyName));
  }
  if (entry.seedRecord?.name) {
    keys.add(simplifyName(entry.seedRecord.name));
  }
  if (entry.seedRecord?.slug) {
    keys.add(entry.seedRecord.slug.trim());
  }
  return keys;
}

function determineNextWave(args: {
  source: RegistryProvider["source"];
  currentModel: RegistryProvider["currentModel"];
  catalogEntry?: CatalogEntry | null;
  researchEntry?: ResearchEntry | null;
}) {
  if (args.catalogEntry?.coverageModel === "polygon") return "polygon";
  if (args.catalogEntry?.coverageModel === "live_address") return "live_address";

  const path = args.researchEntry?.officialResearch.zipRemediationPath;
  if (path === "needs_polygon_or_corridor_model") return "polygon";
  if (path === "requires_live_address_check") return "live_address";
  if (path === "manual_research_required") return "manual_research";
  if (path === "seed_exact_or_prefix_after_lookup" && args.currentModel === "state") {
    return "promote_zip";
  }
  if (args.source === "catalog_backlog" && args.catalogEntry?.coverageModel === "zip_prefix") {
    return "promote_zip";
  }
  return "none";
}

async function main() {
  const researchPath = resolve(process.cwd(), "docs/generated/provider-official-coverage-research.json");
  const researchPayload = JSON.parse(await readFile(researchPath, "utf8")) as {
    summary: { generatedAt: string };
    providers: ResearchEntry[];
  };

  const rawStateProviders = normalizeProviders(RAW_STATE_PROVIDERS);
  const mergedStateProviders = normalizeProviders(MERGED_STATE_PROVIDERS);

  const rawSlugs = new Set(rawStateProviders.map((provider) => provider.slug));
  const researchByKey = new Map<string, ResearchEntry>();
  for (const entry of researchPayload.providers.filter((provider) => provider.scope === "STATE")) {
    researchByKey.set(entry.slug, entry);
    researchByKey.set(simplifyName(entry.name), entry);
  }

  const catalogByKey = new Map<string, CatalogEntry>();
  for (const entry of STATE_PROVIDER_COMPLETENESS_CATALOG) {
    for (const key of buildCatalogKeys(entry)) {
      catalogByKey.set(key, entry);
    }
  }

  const stateRows = ALL_STATES.map((state) => ({
    state,
    providers: [] as RegistryProvider[],
  }));
  const stateMap = new Map(stateRows.map((row) => [row.state, row]));

  for (const provider of mergedStateProviders) {
    if (!(provider.category in CATEGORY_LABELS)) continue;

    const researchEntry =
      researchByKey.get(provider.slug) ||
      researchByKey.get(simplifyName(provider.name)) ||
      null;
    const catalogEntry =
      catalogByKey.get(provider.slug) ||
      catalogByKey.get(simplifyName(provider.name)) ||
      null;
    const source: RegistryProvider["source"] = rawSlugs.has(provider.slug)
      ? "existing_seed"
      : "catalog_added";
    const currentModel: RegistryProvider["currentModel"] = provider.zipCodes.length > 0
      ? "zip_prefix"
      : "state";
    const nextWave = determineNextWave({
      source,
      currentModel,
      catalogEntry,
      researchEntry,
    });
    const registryProvider: RegistryProvider = {
      name: provider.name,
      slug: provider.slug,
      category: provider.category,
      source,
      currentModel,
      nextWave,
      officialUrl: catalogEntry?.officialUrl || researchEntry?.officialResearch.bestUrl || provider.website || "",
      officialStatus: researchEntry?.officialResearch.status || "catalog_only",
      sourceConfidence: researchEntry?.officialResearch.sourceConfidence || "catalog",
      note: catalogEntry?.note || researchEntry?.officialResearch.title || researchEntry?.officialResearch.error || null,
      website: provider.website || null,
      zipRuleCount: provider.zipCodes.length,
    };

    for (const state of getProviderStates(provider)) {
      const row = stateMap.get(state);
      if (!row) continue;
      row.providers.push(registryProvider);
    }
  }

  for (const entry of STATE_PROVIDER_COMPLETENESS_CATALOG.filter((catalog) => !catalog.seedRecord)) {
    for (const state of entry.states) {
      const row = stateMap.get(state);
      if (!row) continue;

      const researchEntry =
        researchByKey.get(simplifyName(entry.providerName)) ||
        (entry.legacyNames || []).map((legacyName) => researchByKey.get(simplifyName(legacyName))).find(Boolean) ||
        null;

      row.providers.push({
        name: entry.providerName,
        slug: entry.seedRecord?.slug || null,
        category: entry.category,
        source: "catalog_backlog",
        currentModel: "catalog_only",
        nextWave: determineNextWave({
          source: "catalog_backlog",
          currentModel: "catalog_only",
          catalogEntry: entry,
          researchEntry,
        }),
        officialUrl: entry.officialUrl,
        officialStatus: researchEntry?.officialResearch.status || "catalog_only",
        sourceConfidence: researchEntry?.officialResearch.sourceConfidence || "catalog",
        note: entry.note,
        website: entry.seedRecord?.website || null,
        zipRuleCount: entry.seedRecord?.zipCodes?.length || 0,
      });
    }
  }

  const registryStates = stateRows
    .map((row) => {
      const providers = row.providers.sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a.category as typeof CATEGORY_ORDER[number]) -
            CATEGORY_ORDER.indexOf(b.category as typeof CATEGORY_ORDER[number]) ||
          a.name.localeCompare(b.name)
      );

      const totals = {
        totalProviders: providers.length,
        existingSeed: providers.filter((provider) => provider.source === "existing_seed").length,
        catalogAdded: providers.filter((provider) => provider.source === "catalog_added").length,
        catalogBacklog: providers.filter((provider) => provider.source === "catalog_backlog").length,
        zipModeled: providers.filter((provider) => provider.currentModel === "zip_prefix").length,
        stateOnly: providers.filter((provider) => provider.currentModel === "state").length,
        promoteZip: providers.filter((provider) => provider.nextWave === "promote_zip").length,
        liveAddress: providers.filter((provider) => provider.nextWave === "live_address").length,
        polygon: providers.filter((provider) => provider.nextWave === "polygon").length,
        manualResearch: providers.filter((provider) => provider.nextWave === "manual_research").length,
      };

      const categories = CATEGORY_ORDER
        .map((category) => ({
          category,
          label: CATEGORY_LABELS[category],
          providers: providers.filter((provider) => provider.category === category),
        }))
        .filter((category) => category.providers.length > 0);

      return {
        state: row.state,
        totals,
        categories,
      };
    })
    .sort((a, b) => a.state.localeCompare(b.state));

  const uniqueProviderMap = new Map<string, RegistryProvider>();
  for (const state of registryStates) {
    for (const category of state.categories) {
      for (const provider of category.providers) {
        const key = provider.slug || `${provider.name}|${provider.category}`;
        if (!uniqueProviderMap.has(key)) {
          uniqueProviderMap.set(key, provider);
        }
      }
    }
  }

  const uniqueProviders = [...uniqueProviderMap.values()];
  const summary = {
    generatedAt: researchPayload.summary.generatedAt,
    statesCovered: registryStates.filter((state) => state.totals.totalProviders > 0).length,
    uniqueProviders: uniqueProviders.length,
    stateAssignments: registryStates.reduce((sum, state) => sum + state.totals.totalProviders, 0),
    existingSeedProviders: uniqueProviders.filter((provider) => provider.source === "existing_seed").length,
    catalogAddedProviders: uniqueProviders.filter((provider) => provider.source === "catalog_added").length,
    catalogBacklogProviders: uniqueProviders.filter((provider) => provider.source === "catalog_backlog").length,
    zipModeledProviders: uniqueProviders.filter((provider) => provider.currentModel === "zip_prefix").length,
    stateOnlyProviders: uniqueProviders.filter((provider) => provider.currentModel === "state").length,
    secondWave: {
      promoteZip: uniqueProviders.filter((provider) => provider.nextWave === "promote_zip").length,
      liveAddress: uniqueProviders.filter((provider) => provider.nextWave === "live_address").length,
      polygon: uniqueProviders.filter((provider) => provider.nextWave === "polygon").length,
      manualResearch: uniqueProviders.filter((provider) => provider.nextWave === "manual_research").length,
    },
  };

  const markdownLines: string[] = [];
  markdownLines.push("# State Provider Official Registry");
  markdownLines.push("");
  markdownLines.push(`Generated: ${summary.generatedAt}`);
  markdownLines.push("");
  markdownLines.push("## Summary");
  markdownLines.push("");
  markdownLines.push(`- States covered: ${summary.statesCovered}`);
  markdownLines.push(`- Unique state-scoped providers in registry: ${summary.uniqueProviders}`);
  markdownLines.push(`- State provider assignments: ${summary.stateAssignments}`);
  markdownLines.push(`- Existing seed providers: ${summary.existingSeedProviders}`);
  markdownLines.push(`- Catalog-added providers: ${summary.catalogAddedProviders}`);
  markdownLines.push(`- Catalog backlog providers: ${summary.catalogBacklogProviders}`);
  markdownLines.push(`- ZIP-modeled providers: ${summary.zipModeledProviders}`);
  markdownLines.push(`- State-only providers: ${summary.stateOnlyProviders}`);
  markdownLines.push(
    `- Second wave backlog: promote_zip=${summary.secondWave.promoteZip}, live_address=${summary.secondWave.liveAddress}, polygon=${summary.secondWave.polygon}, manual_research=${summary.secondWave.manualResearch}`
  );
  markdownLines.push("");

  for (const state of registryStates) {
    markdownLines.push(`## ${state.state}`);
    markdownLines.push("");
    markdownLines.push(
      `- Totals: total=${state.totals.totalProviders}, existing_seed=${state.totals.existingSeed}, catalog_added=${state.totals.catalogAdded}, catalog_backlog=${state.totals.catalogBacklog}, zip_modeled=${state.totals.zipModeled}, state_only=${state.totals.stateOnly}, promote_zip=${state.totals.promoteZip}, live_address=${state.totals.liveAddress}, polygon=${state.totals.polygon}, manual_research=${state.totals.manualResearch}`
    );
    markdownLines.push("");

    for (const category of state.categories) {
      markdownLines.push(`### ${category.label}`);
      markdownLines.push("");

      for (const provider of category.providers) {
        markdownLines.push(
          `- ${provider.name} | ${provider.source} | current=${provider.currentModel} | next=${provider.nextWave} | official=${provider.officialUrl} | status=${provider.officialStatus} | confidence=${provider.sourceConfidence}`
        );
        if (provider.note) {
          markdownLines.push(`  note: ${provider.note}`);
        }
      }

      markdownLines.push("");
    }
  }

  const outDir = resolve(process.cwd(), "docs/generated");
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(outDir, "state-provider-official-registry.md"),
      `${markdownLines.join("\n")}\n`,
      "utf8"
    ),
    writeFile(
      resolve(outDir, "state-provider-official-registry.json"),
      `${JSON.stringify({ summary, states: registryStates }, null, 2)}\n`,
      "utf8"
    ),
  ]);

  console.log(markdownLines.join("\n"));
  console.log("\nWrote state provider registry artifacts to docs/generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

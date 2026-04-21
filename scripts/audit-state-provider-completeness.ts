import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawProvidersModule = require("../packages/db/prisma/seed-data/providers");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mergedProvidersModule = require("../packages/db/prisma/seed-data/provider-seed");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const catalogModule = require("../packages/db/prisma/seed-data/state-provider-catalog");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const integrityModule = require("../packages/shared/src/provider-integrity");

const { FEDERAL_NEW: RAW_FEDERAL_NEW, STATE_PROVIDERS: RAW_STATE_PROVIDERS } = rawProvidersModule as {
  FEDERAL_NEW: ProviderRecord[];
  STATE_PROVIDERS: ProviderRecord[];
};

const { FEDERAL_NEW: MERGED_FEDERAL_NEW, STATE_PROVIDERS: MERGED_STATE_PROVIDERS } = mergedProvidersModule as {
  FEDERAL_NEW: ProviderRecord[];
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

type ValidationStatus = "ok" | "redirect" | "error";

const ALL_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
] as const;

const LOCATION_SENSITIVE_CATEGORIES = new Set([
  "UTILITY_ELECTRIC",
  "UTILITY_GAS",
  "UTILITY_WATER",
  "UTILITY_INTERNET",
  "TRANSPORTATION_TRANSIT",
  "TRANSPORTATION_TOLL",
]);

function simplifyName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNormalizedProviders(records: ProviderRecord[]) {
  return sanitizeProviderSeedRecords(records).providers.map((provider) =>
    normalizeProviderRecord(provider)
  );
}

function buildMatchKeys(entry: CatalogEntry) {
  const keys = new Set<string>();
  keys.add(simplifyName(entry.providerName));
  for (const legacyName of entry.legacyNames || []) {
    keys.add(simplifyName(legacyName));
  }
  if (entry.seedRecord?.name) {
    keys.add(simplifyName(entry.seedRecord.name));
  }
  return keys;
}

function findProviderMatch(providers: NormalizedProvider[], entry: CatalogEntry) {
  const matchKeys = buildMatchKeys(entry);
  const seedSlug = entry.seedRecord?.slug?.trim();

  return providers.find((provider) => {
    if (seedSlug && provider.slug === seedSlug) return true;
    return matchKeys.has(simplifyName(provider.name));
  }) || null;
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() || null;
}

async function fetchValidation(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "LocateflowStateProviderAudit/1.0 (+https://locateflow.local)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    const text = await response.text();
    const finalUrl = response.url || url;
    const title = extractTitle(text);
    const status: ValidationStatus = finalUrl !== url ? "redirect" : "ok";

    return {
      status,
      httpStatus: response.status,
      finalUrl,
      title,
      error: null as string | null,
    };
  } catch (error) {
    return {
      status: "error" as const,
      httpStatus: null as number | null,
      finalUrl: url,
      title: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function next() {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current]);
    await next();
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  );

  return results;
}

function getStateProviders(providers: NormalizedProvider[], state: string) {
  return providers
    .filter((provider) => {
      if (!LOCATION_SENSITIVE_CATEGORIES.has(provider.category)) return false;
      return provider.scope === "FEDERAL" || provider.states.includes(state);
    })
    .map((provider) => provider.name)
    .sort((a, b) => a.localeCompare(b));
}

async function main() {
  const skipFetch = process.argv.includes("--skip-fetch");

  const rawProviders = getNormalizedProviders([
    ...RAW_FEDERAL_NEW,
    ...RAW_STATE_PROVIDERS,
  ]);
  const mergedProviders = getNormalizedProviders([
    ...MERGED_FEDERAL_NEW,
    ...MERGED_STATE_PROVIDERS,
  ]);

  const validations = skipFetch
    ? STATE_PROVIDER_COMPLETENESS_CATALOG.map((entry) => ({
        entry,
        validation: {
          status: "ok" as const,
          httpStatus: 200,
          finalUrl: entry.officialUrl,
          title: null,
          error: null,
        },
      }))
    : await mapWithConcurrency(
        STATE_PROVIDER_COMPLETENESS_CATALOG,
        6,
        async (entry) => ({
          entry,
          validation: await fetchValidation(entry.officialUrl),
        })
      );

  const validationByUrl = new Map(
    validations.map(({ entry, validation }) => [entry.officialUrl, validation])
  );

  const catalogRows = STATE_PROVIDER_COMPLETENESS_CATALOG.map((entry) => {
    const rawMatch = findProviderMatch(rawProviders, entry);
    const mergedMatch = findProviderMatch(mergedProviders, entry);
    const validation = validationByUrl.get(entry.officialUrl);

    return {
      ...entry,
      rawSeedMatch: rawMatch
        ? { name: rawMatch.name, slug: rawMatch.slug }
        : null,
      mergedSeedMatch: mergedMatch
        ? { name: mergedMatch.name, slug: mergedMatch.slug }
        : null,
      validation: validation || null,
      status:
        !rawMatch && mergedMatch
          ? "newly_added"
          : rawMatch
            ? "already_present"
            : "catalog_backlog",
    };
  });

  const states = ALL_STATES.map((state) => {
    const externalEntries = catalogRows.filter((entry) => entry.states.includes(state));
    return {
      state,
      repoProvidersBefore: getStateProviders(rawProviders, state),
      repoProvidersAfter: getStateProviders(mergedProviders, state),
      externalEntries,
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    catalogEntries: catalogRows.length,
    statesCovered: ALL_STATES.filter((state) =>
      catalogRows.some((entry) => entry.states.includes(state))
    ),
    coverageModelCounts: {
      state: catalogRows.filter((entry) => entry.coverageModel === "state").length,
      zipPrefix: catalogRows.filter((entry) => entry.coverageModel === "zip_prefix").length,
      polygon: catalogRows.filter((entry) => entry.coverageModel === "polygon").length,
      liveAddress: catalogRows.filter((entry) => entry.coverageModel === "live_address").length,
    },
    statusCounts: {
      alreadyPresent: catalogRows.filter((entry) => entry.status === "already_present").length,
      newlyAdded: catalogRows.filter((entry) => entry.status === "newly_added").length,
      backlog: catalogRows.filter((entry) => entry.status === "catalog_backlog").length,
    },
    validationCounts: {
      ok: catalogRows.filter((entry) => entry.validation?.status === "ok").length,
      redirect: catalogRows.filter((entry) => entry.validation?.status === "redirect").length,
      error: catalogRows.filter((entry) => entry.validation?.status === "error").length,
    },
  };

  const markdownLines: string[] = [];
  markdownLines.push("# State Provider Completeness Catalog");
  markdownLines.push("");
  markdownLines.push(`Generated: ${summary.generatedAt}`);
  markdownLines.push("");
  markdownLines.push("## Summary");
  markdownLines.push("");
  markdownLines.push(`- Catalog entries: ${summary.catalogEntries}`);
  markdownLines.push(`- States covered: ${summary.statesCovered.length}`);
  markdownLines.push(`- Already present in raw seed: ${summary.statusCounts.alreadyPresent}`);
  markdownLines.push(`- Newly added in merged seed: ${summary.statusCounts.newlyAdded}`);
  markdownLines.push(`- Catalog-only backlog entries: ${summary.statusCounts.backlog}`);
  markdownLines.push(
    `- Coverage models: state=${summary.coverageModelCounts.state}, zip_prefix=${summary.coverageModelCounts.zipPrefix}, polygon=${summary.coverageModelCounts.polygon}, live_address=${summary.coverageModelCounts.liveAddress}`
  );
  markdownLines.push(
    `- Official URL validation: ok=${summary.validationCounts.ok}, redirect=${summary.validationCounts.redirect}, error=${summary.validationCounts.error}`
  );
  markdownLines.push("");
  markdownLines.push("## Per-State Diff");
  markdownLines.push("");

  for (const state of states) {
    markdownLines.push(`### ${state.state}`);
    markdownLines.push("");
    markdownLines.push(`- Repo before: ${state.repoProvidersBefore.length ? state.repoProvidersBefore.join(", ") : "none"}`);
    markdownLines.push(`- Repo after: ${state.repoProvidersAfter.length ? state.repoProvidersAfter.join(", ") : "none"}`);
    if (!state.externalEntries.length) {
      markdownLines.push("- External catalog: none");
      markdownLines.push("");
      continue;
    }

    for (const entry of state.externalEntries) {
      const statusLabel =
        entry.status === "newly_added"
          ? "newly_added"
          : entry.status === "already_present"
            ? "already_present"
            : "catalog_backlog";
      markdownLines.push(
        `- ${entry.providerName} | ${entry.category} | ${statusLabel} | ${entry.coverageModel} | ${entry.officialUrl}`
      );
      if (entry.note) {
        markdownLines.push(`  note: ${entry.note}`);
      }
      if (entry.validation?.title || entry.validation?.error) {
        markdownLines.push(
          `  source: ${entry.validation.title || "no-title"}${entry.validation.error ? ` | error: ${entry.validation.error}` : ""}`
        );
      }
    }

    markdownLines.push("");
  }

  const diffPayload = {
    summary,
    additions: catalogRows.filter((entry) => entry.status === "newly_added"),
    alreadyPresent: catalogRows.filter((entry) => entry.status === "already_present"),
    backlog: catalogRows.filter((entry) => entry.status === "catalog_backlog"),
    states,
  };

  const outDir = resolve(process.cwd(), "docs/generated");
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(outDir, "state-provider-completeness-catalog.md"),
      `${markdownLines.join("\n")}\n`,
      "utf8"
    ),
    writeFile(
      resolve(outDir, "state-provider-completeness-catalog.json"),
      `${JSON.stringify(diffPayload, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      resolve(outDir, "state-provider-seed-diff.md"),
      `${[
        "# State Provider Seed Diff",
        "",
        `Generated: ${summary.generatedAt}`,
        "",
        `- newly added: ${summary.statusCounts.newlyAdded}`,
        `- already present: ${summary.statusCounts.alreadyPresent}`,
        `- backlog: ${summary.statusCounts.backlog}`,
        "",
        "## Newly Added",
        "",
        ...diffPayload.additions.map(
          (entry) => `- ${entry.providerName} | ${entry.category} | ${entry.coverageModel} | ${entry.officialUrl}`
        ),
        "",
        "## Backlog",
        "",
        ...diffPayload.backlog.map(
          (entry) => `- ${entry.providerName} | ${entry.category} | ${entry.coverageModel} | ${entry.officialUrl}`
        ),
        "",
      ].join("\n")}\n`,
      "utf8"
    ),
    writeFile(
      resolve(outDir, "state-provider-seed-diff.json"),
      `${JSON.stringify({
        generatedAt: summary.generatedAt,
        additions: diffPayload.additions,
        backlog: diffPayload.backlog,
      }, null, 2)}\n`,
      "utf8"
    ),
  ]);

  console.log(markdownLines.join("\n"));
  console.log("\nWrote state provider completeness artifacts to docs/generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

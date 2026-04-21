import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
// tsx evaluates this script with CJS output in this repo, so use require-based
// loading for local TS modules to keep the inventory script portable.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const providersModule = require("../packages/db/prisma/seed-data/provider-seed");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shared = require("../packages/shared/src");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const integrityModule = require("../packages/shared/src/provider-integrity");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const coverageModule = require("../packages/shared/src/provider-coverage");

const { FEDERAL_NEW, STATE_DMVS, STATE_PROVIDERS } = providersModule as {
  FEDERAL_NEW: ProviderRecord[];
  STATE_DMVS: ProviderRecord[];
  STATE_PROVIDERS: ProviderRecord[];
};

const {
  sanitizeProviderSeedRecords,
  normalizeProviderRecord,
} = integrityModule;

const { expandCoverageRows } = coverageModule;

const { CATEGORY_META } = shared as {
  CATEGORY_META: Record<string, { label: string }>;
};

type ProviderRecord = {
  name: string;
  slug?: string;
  category: string;
  website?: string;
  scope?: string;
  states?: string[];
  zipCodes?: string[];
  description?: string;
};

type NormalizedProvider = ReturnType<typeof normalizeProviderRecord<ProviderRecord>>;

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

const HIGH_RISK_LOCAL_CATEGORIES = new Set([
  "UTILITY_WATER",
  "TRANSPORTATION_TRANSIT",
  "TRANSPORTATION_TOLL",
]);

const ADDRESS_QUALIFIED_FEDERAL_CATEGORIES = new Set([
  "UTILITY_INTERNET",
  "UTILITY_TRASH",
  "GROCERY_DELIVERY",
  "HOUSING_HOME_SERVICE",
  "HOUSING_MOVING",
]);

const LOCALITY_SIGNAL_REGEX =
  /\b(city|county|metro|metropolitan|transit|water|sewer|public works|utilities|utility|district|authority|board|bureau|commission|regional|town|village)\b/i;

function getRawProviders() {
  return [
    ...FEDERAL_NEW,
    ...STATE_DMVS.map((provider) => ({
      ...provider,
      category: "GOVERNMENT_DMV",
      scope: "STATE",
    })),
    ...STATE_PROVIDERS,
  ];
}

function coversState(provider: NormalizedProvider, state: string) {
  if (provider.scope === "FEDERAL") return true;
  return provider.states.includes(state);
}

function buildCategoryStats(providers: NormalizedProvider[]) {
  const buckets = new Map<string, {
    total: number;
    federal: number;
    state: number;
    withZipRules: number;
    exactRows: number;
    prefixRows: number;
    stateRows: number;
  }>();

  for (const provider of providers) {
    const entry = buckets.get(provider.category) || {
      total: 0,
      federal: 0,
      state: 0,
      withZipRules: 0,
      exactRows: 0,
      prefixRows: 0,
      stateRows: 0,
    };

    entry.total += 1;
    if (provider.scope === "FEDERAL") entry.federal += 1;
    else entry.state += 1;
    if (provider.zipCodes.length > 0) entry.withZipRules += 1;

    for (const row of expandCoverageRows({
      scope: provider.scope,
      states: provider.states,
      zipCodes: provider.zipCodes,
    })) {
      if (row.zipExact) entry.exactRows += 1;
      else if (row.zipPrefix) entry.prefixRows += 1;
      else entry.stateRows += 1;
    }

    buckets.set(provider.category, entry);
  }

  return [...buckets.entries()]
    .map(([category, value]) => ({
      category,
      label: CATEGORY_META[category]?.label || category,
      ...value,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

function buildPrecisionRiskLists(providers: NormalizedProvider[]) {
  const localScopeOverbroad = [];
  const federalAddressQualified = [];

  for (const provider of providers) {
    const localitySignal = LOCALITY_SIGNAL_REGEX.test(`${provider.name} ${provider.description || ""}`);

    if (
      provider.scope === "STATE" &&
      provider.zipCodes.length === 0 &&
      LOCATION_SENSITIVE_CATEGORIES.has(provider.category)
    ) {
      localScopeOverbroad.push({
        name: provider.name,
        slug: provider.slug,
        category: provider.category,
        scope: provider.scope,
        states: provider.states,
        website: provider.website,
        risk:
          HIGH_RISK_LOCAL_CATEGORIES.has(provider.category) || localitySignal
            ? "high"
            : "medium",
        reason: localitySignal
          ? "locality signal in name/description with state-only coverage"
          : "location-sensitive category has only state coverage",
      });
    }

    if (
      provider.scope === "FEDERAL" &&
      provider.zipCodes.length === 0 &&
      ADDRESS_QUALIFIED_FEDERAL_CATEGORIES.has(provider.category)
    ) {
      federalAddressQualified.push({
        name: provider.name,
        slug: provider.slug,
        category: provider.category,
        website: provider.website,
        risk: "medium",
        reason: "national brand likely requires address-level serviceability check",
      });
    }
  }

  return {
    localScopeOverbroad: localScopeOverbroad.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    federalAddressQualified: federalAddressQualified.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
  };
}

function buildStateRiskMatrix(providers: NormalizedProvider[]) {
  const perState = new Map<string, {
    state: string;
    locationSensitiveProviders: number;
    highRiskLocalProviders: number;
    categories: Record<string, number>;
  }>();

  for (const state of ALL_STATES) {
    perState.set(state, {
      state,
      locationSensitiveProviders: 0,
      highRiskLocalProviders: 0,
      categories: {},
    });
  }

  for (const provider of providers) {
    if (!LOCATION_SENSITIVE_CATEGORIES.has(provider.category)) continue;

    for (const state of ALL_STATES) {
      if (!coversState(provider, state)) continue;
      const entry = perState.get(state);
      if (!entry) continue;

      entry.locationSensitiveProviders += 1;
      entry.categories[provider.category] = (entry.categories[provider.category] || 0) + 1;

      if (provider.scope === "STATE" && provider.zipCodes.length === 0) {
        if (HIGH_RISK_LOCAL_CATEGORIES.has(provider.category) || LOCALITY_SIGNAL_REGEX.test(provider.name)) {
          entry.highRiskLocalProviders += 1;
        }
      }
    }
  }

  return [...perState.values()].sort(
    (a, b) =>
      b.highRiskLocalProviders - a.highRiskLocalProviders ||
      b.locationSensitiveProviders - a.locationSensitiveProviders ||
      a.state.localeCompare(b.state)
  );
}

function toMarkdown(input: {
  rawCount: number;
  sanitizedCount: number;
  categoryStats: ReturnType<typeof buildCategoryStats>;
  localScopeOverbroad: ReturnType<typeof buildPrecisionRiskLists>["localScopeOverbroad"];
  federalAddressQualified: ReturnType<typeof buildPrecisionRiskLists>["federalAddressQualified"];
  stateRiskMatrix: ReturnType<typeof buildStateRiskMatrix>;
}) {
  const lines: string[] = [];
  const locationSensitiveStats = input.categoryStats.filter((row) => LOCATION_SENSITIVE_CATEGORIES.has(row.category));
  const totalLocationSensitive = locationSensitiveStats.reduce((sum, row) => sum + row.total, 0);
  const totalZipBacked = locationSensitiveStats.reduce((sum, row) => sum + row.withZipRules, 0);

  lines.push("# Provider Coverage Surface Inventory");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Raw provider records: ${input.rawCount}`);
  lines.push(`- Sanitized provider records: ${input.sanitizedCount}`);
  lines.push(`- Location-sensitive providers: ${totalLocationSensitive}`);
  lines.push(`- Location-sensitive providers with ZIP rules: ${totalZipBacked}`);
  lines.push(`- State-scoped overbroad candidates: ${input.localScopeOverbroad.length}`);
  lines.push(`- Federal/address-qualified candidates: ${input.federalAddressQualified.length}`);
  lines.push("");
  lines.push("## Category Precision");
  lines.push("");
  for (const row of locationSensitiveStats) {
    lines.push(
      `- ${row.category} (${row.label}): total=${row.total}, federal=${row.federal}, state=${row.state}, withZip=${row.withZipRules}, exactRows=${row.exactRows}, prefixRows=${row.prefixRows}, stateRows=${row.stateRows}`
    );
  }
  lines.push("");
  lines.push("## Highest-Risk States");
  lines.push("");
  for (const row of input.stateRiskMatrix.slice(0, 20)) {
    lines.push(
      `- ${row.state}: highRiskLocalProviders=${row.highRiskLocalProviders}, locationSensitiveProviders=${row.locationSensitiveProviders}`
    );
  }
  lines.push("");
  lines.push("## State-Scoped Overbroad Candidates");
  lines.push("");
  if (input.localScopeOverbroad.length === 0) {
    lines.push("- None");
  } else {
    for (const row of input.localScopeOverbroad.slice(0, 80)) {
      lines.push(
        `- ${row.name} | ${row.category} | ${row.states.join(",")} | ${row.risk} | ${row.reason}${row.website ? ` | ${row.website}` : ""}`
      );
    }
  }
  lines.push("");
  lines.push("## Federal Address-Qualified Candidates");
  lines.push("");
  if (input.federalAddressQualified.length === 0) {
    lines.push("- None");
  } else {
    for (const row of input.federalAddressQualified.slice(0, 80)) {
      lines.push(
        `- ${row.name} | ${row.category} | ${row.risk} | ${row.reason}${row.website ? ` | ${row.website}` : ""}`
      );
    }
  }
  lines.push("");
  lines.push("## Recommended Research Order");
  lines.push("");
  lines.push("- UTILITY_WATER and TRANSPORTATION_TRANSIT first because they are most visibly overbroad at state level.");
  lines.push("- UTILITY_ELECTRIC, UTILITY_GAS, and UTILITY_INTERNET second because they are location-sensitive but often span complex multistate territories.");
  lines.push("- Federal brands with coverage checkers should be modeled separately from true nationwide providers.");

  return lines.join("\n");
}

async function main() {
  const shouldWrite = process.argv.includes("--write");
  const rawProviders = getRawProviders();
  const sanitized = sanitizeProviderSeedRecords(rawProviders);
  const providers = sanitized.providers.map((provider) => normalizeProviderRecord(provider));

  const categoryStats = buildCategoryStats(providers);
  const precisionRisk = buildPrecisionRiskLists(providers);
  const stateRiskMatrix = buildStateRiskMatrix(providers);

  const report = toMarkdown({
    rawCount: rawProviders.length,
    sanitizedCount: providers.length,
    categoryStats,
    localScopeOverbroad: precisionRisk.localScopeOverbroad,
    federalAddressQualified: precisionRisk.federalAddressQualified,
    stateRiskMatrix,
  });

  if (shouldWrite) {
    const docsDir = resolve(process.cwd(), "docs", "generated");
    await mkdir(docsDir, { recursive: true });
    await writeFile(resolve(docsDir, "provider-coverage-surface-inventory.md"), report, "utf8");
    await writeFile(
      resolve(docsDir, "provider-coverage-surface-inventory.json"),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          rawCount: rawProviders.length,
          sanitizedCount: providers.length,
          locationSensitiveCategories: [...LOCATION_SENSITIVE_CATEGORIES],
          highRiskLocalCategories: [...HIGH_RISK_LOCAL_CATEGORIES],
          categoryStats,
          localScopeOverbroad: precisionRisk.localScopeOverbroad,
          federalAddressQualified: precisionRisk.federalAddressQualified,
          stateRiskMatrix,
        },
        null,
        2
      ),
      "utf8"
    );
    console.log("Wrote coverage surface inventory artifacts to docs/generated.");
  }

  console.log(report);
}

void main();

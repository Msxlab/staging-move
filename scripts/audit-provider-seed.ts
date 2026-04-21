import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CATEGORY_META,
  expandCoverageRows,
  normalizeProviderRecord,
  sanitizeProviderSeedRecords,
} from "../packages/shared/src";
import {
  FEDERAL_NEW as RAW_FEDERAL_NEW,
  STATE_DMVS,
  STATE_PROVIDERS as RAW_STATE_PROVIDERS,
} from "../packages/db/prisma/seed-data/providers";
import { applyProviderCoverageOverrides } from "../packages/db/prisma/seed-data/provider-coverage-overrides";
import { STATE_PROVIDER_EXPANSIONS } from "../packages/db/prisma/seed-data/state-provider-catalog";

type RawProvider = {
  name: string;
  slug?: string;
  category: string;
  website?: string;
  scope?: string;
  states?: string[];
  zipCodes?: string[];
  description?: string;
};

type DuplicateBucket = {
  key: string;
  providers: Array<{
    name: string;
    slug: string;
    category: string;
    website: string | null;
  }>;
};

function topLevelCategory(category: string): string {
  return category.split("_")[0] || category;
}

function bucketBy<T>(
  items: T[],
  keyFn: (item: T) => string | null,
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const list = buckets.get(key) || [];
    list.push(item);
    buckets.set(key, list);
  }

  return buckets;
}

function toDuplicateBuckets(
  entries: Map<string, ReturnType<typeof normalizeProviderRecord>[]>,
  crossCategoryOnly = false,
): DuplicateBucket[] {
  return [...entries.entries()]
    .filter(([, providers]) => {
      if (providers.length < 2) return false;
      if (!crossCategoryOnly) return true;
      return new Set(providers.map((provider) => provider.category)).size > 1;
    })
    .map(([key, providers]) => ({
      key,
      providers: providers.map((provider) => ({
        name: provider.name,
        slug: provider.slug,
        category: provider.category,
        website: provider.websiteDomain,
      })),
    }))
    .sort(
      (a, b) =>
        b.providers.length - a.providers.length || a.key.localeCompare(b.key),
    );
}

function summarizeCoverage(
  providers: ReturnType<typeof normalizeProviderRecord>[],
) {
  let exactZipRules = 0;
  let prefixZipRules = 0;
  let stateWideRows = 0;
  let emptyCoverageRows = 0;
  const anomalies: string[] = [];

  for (const provider of providers) {
    const rows = expandCoverageRows({
      scope: provider.scope,
      states: provider.states,
      zipCodes: provider.zipCodes,
    });

    if (
      provider.scope === "STATE" &&
      provider.states.length === 0 &&
      provider.zipCodes.length === 0
    ) {
      anomalies.push(
        `${provider.slug}: STATE scope but no states or ZIP rules`,
      );
    }
    if (provider.scope === "FEDERAL" && provider.states.length > 0) {
      anomalies.push(
        `${provider.slug}: FEDERAL scope should not carry explicit states`,
      );
    }

    if (provider.zipCodes.length > 0 && rows.length === 0) {
      anomalies.push(
        `${provider.slug}: ZIP rules provided but produced no coverage rows`,
      );
    }

    if (rows.length === 0) {
      emptyCoverageRows += 1;
    }

    for (const row of rows) {
      if (row.zipExact) exactZipRules += 1;
      else if (row.zipPrefix) prefixZipRules += 1;
      else stateWideRows += 1;
    }
  }

  return {
    exactZipRules,
    prefixZipRules,
    stateWideRows,
    emptyCoverageRows,
    anomalies,
  };
}

function buildMarkdownReport(input: {
  rawCount: number;
  sanitizedCount: number;
  renamedCount: number;
  dedupedCount: number;
  categoryStats: Array<{ category: string; count: number; label: string }>;
  scopeStats: Array<{ scope: string; count: number }>;
  slugDuplicates: DuplicateBucket[];
  sameCategoryNameDuplicates: DuplicateBucket[];
  crossCategoryNameDuplicates: DuplicateBucket[];
  crossCategoryDomainDuplicates: DuplicateBucket[];
  coverageSummary: ReturnType<typeof summarizeCoverage>;
}) {
  const lines: string[] = [];

  lines.push("# Provider Seed Audit Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Raw provider records: ${input.rawCount}`);
  lines.push(`- Sanitized provider records: ${input.sanitizedCount}`);
  lines.push(`- Dedupe removals: ${input.dedupedCount}`);
  lines.push(`- Cross-category slug renames: ${input.renamedCount}`);
  lines.push(
    `- Same-category normalized-name duplicates: ${input.sameCategoryNameDuplicates.length}`,
  );
  lines.push(
    `- Cross-category normalized-name duplicates: ${input.crossCategoryNameDuplicates.length}`,
  );
  lines.push(
    `- Cross-category domain duplicates: ${input.crossCategoryDomainDuplicates.length}`,
  );
  lines.push("");
  lines.push("## Scope Distribution");
  lines.push("");
  input.scopeStats.forEach((entry) =>
    lines.push(`- ${entry.scope}: ${entry.count}`),
  );
  lines.push("");
  lines.push("## Coverage Shape");
  lines.push("");
  lines.push(`- Exact ZIP rules: ${input.coverageSummary.exactZipRules}`);
  lines.push(`- ZIP prefix rules: ${input.coverageSummary.prefixZipRules}`);
  lines.push(`- State-wide rows: ${input.coverageSummary.stateWideRows}`);
  lines.push(
    `- Providers with no generated coverage rows: ${input.coverageSummary.emptyCoverageRows}`,
  );
  lines.push("");
  lines.push("## Top Categories");
  lines.push("");
  input.categoryStats.slice(0, 20).forEach((entry) => {
    lines.push(`- ${entry.category} (${entry.label}): ${entry.count}`);
  });
  lines.push("");

  const sections: Array<[string, DuplicateBucket[]]> = [
    ["Raw duplicate slugs", input.slugDuplicates],
    ["Same-category duplicate names", input.sameCategoryNameDuplicates],
    ["Cross-category duplicate names", input.crossCategoryNameDuplicates],
    ["Cross-category duplicate domains", input.crossCategoryDomainDuplicates],
  ];

  for (const [title, rows] of sections) {
    lines.push(`## ${title}`);
    lines.push("");
    if (rows.length === 0) {
      lines.push("- None");
      lines.push("");
      continue;
    }
    rows.slice(0, 20).forEach((row) => {
      const families = new Set(
        row.providers.map((provider) => topLevelCategory(provider.category)),
      );
      const severity = families.size > 1 ? "high" : "medium";
      lines.push(`- ${row.key} (${severity})`);
      row.providers.forEach((provider) => {
        lines.push(
          `  - ${provider.name} | ${provider.category} | ${provider.slug}${provider.website ? ` | ${provider.website}` : ""}`,
        );
      });
    });
    lines.push("");
  }

  lines.push("## Coverage Anomalies");
  lines.push("");
  if (input.coverageSummary.anomalies.length === 0) {
    lines.push("- None");
  } else {
    input.coverageSummary.anomalies
      .slice(0, 50)
      .forEach((entry) => lines.push(`- ${entry}`));
  }
  lines.push("");
  lines.push("## Recommended Next Cleanup Slice");
  lines.push("");
  lines.push(
    "- Resolve cross-category same-name/domain duplicates first because they create recommendation ambiguity.",
  );
  lines.push(
    "- Review all providers with STATE scope but no states/ZIP coverage.",
  );
  lines.push(
    "- Review shared domains that span incompatible category families.",
  );
  lines.push(
    "- Promote this report into CI as a failing guard once acceptable duplicate thresholds are defined.",
  );

  return lines.join("\n");
}

async function main() {
  const shouldWrite = process.argv.includes("--write");
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

  const normalizedProviders = rawProviders.map((provider) =>
    normalizeProviderRecord(provider),
  );
  const sanitized = sanitizeProviderSeedRecords(rawProviders);
  const sanitizedNormalizedProviders = sanitized.providers.map((provider) =>
    normalizeProviderRecord(provider),
  );

  const slugDuplicates = toDuplicateBuckets(
    bucketBy(normalizedProviders, (provider) => provider.slug),
  );
  const sameCategoryNameDuplicates = toDuplicateBuckets(
    bucketBy(
      sanitizedNormalizedProviders,
      (provider) => `${provider.normalizedName}::${provider.category}`,
    ),
    false,
  );
  const crossCategoryNameDuplicates = toDuplicateBuckets(
    bucketBy(
      sanitizedNormalizedProviders,
      (provider) => provider.normalizedName || null,
    ),
    true,
  );
  const crossCategoryDomainDuplicates = toDuplicateBuckets(
    bucketBy(
      sanitizedNormalizedProviders,
      (provider) => provider.websiteDomain,
    ),
    true,
  );

  const categoryCounts = new Map<string, number>();
  const scopeCounts = new Map<string, number>();
  for (const provider of sanitized.providers) {
    categoryCounts.set(
      provider.category,
      (categoryCounts.get(provider.category) || 0) + 1,
    );
    scopeCounts.set(provider.scope, (scopeCounts.get(provider.scope) || 0) + 1);
  }

  const categoryStats = [...categoryCounts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      label: CATEGORY_META[category]?.label || category,
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const scopeStats = [...scopeCounts.entries()]
    .map(([scope, count]) => ({ scope, count }))
    .sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope));

  const coverageSummary = summarizeCoverage(
    sanitized.providers.map((provider) => normalizeProviderRecord(provider)),
  );
  const report = buildMarkdownReport({
    rawCount: rawProviders.length,
    sanitizedCount: sanitized.providers.length,
    renamedCount: sanitized.renamed.length,
    dedupedCount: sanitized.deduped.reduce(
      (sum, entry) => sum + entry.removedCount,
      0,
    ),
    categoryStats,
    scopeStats,
    slugDuplicates,
    sameCategoryNameDuplicates,
    crossCategoryNameDuplicates,
    crossCategoryDomainDuplicates,
    coverageSummary,
  });

  if (shouldWrite) {
    const docsDir = resolve(process.cwd(), "docs", "generated");
    await mkdir(docsDir, { recursive: true });
    await writeFile(resolve(docsDir, "provider-seed-audit.md"), report, "utf8");
    await writeFile(
      resolve(docsDir, "provider-seed-audit.json"),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          rawCount: rawProviders.length,
          sanitizedCount: sanitized.providers.length,
          renamed: sanitized.renamed,
          deduped: sanitized.deduped,
          categoryStats,
          scopeStats,
          slugDuplicates,
          sameCategoryNameDuplicates,
          crossCategoryNameDuplicates,
          crossCategoryDomainDuplicates,
          coverageSummary,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log("Wrote provider seed audit artifacts to docs/generated.");
  }

  console.log(report);
}

void main();

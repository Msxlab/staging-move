import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ADDRESS_QUALIFIED_FEDERAL_CATEGORIES,
  CATEGORY_META,
  LOCATION_SENSITIVE_PROVIDER_CATEGORIES,
  getProviderQualityWarnings,
  normalizeProviderRecord,
  normalizeProviderUrlDomain,
  sanitizeProviderSeedRecords,
} from "../packages/shared/src";
import {
  FEDERAL_NEW as RAW_FEDERAL_NEW,
  STATE_DMVS,
  STATE_PROVIDERS as RAW_STATE_PROVIDERS,
} from "../packages/db/prisma/seed-data/providers";
import { STATE_PROVIDER_EXPANSIONS } from "../packages/db/prisma/seed-data/state-provider-catalog";
import { applyProviderCoverageOverrides } from "../packages/db/prisma/seed-data/provider-coverage-overrides";

const ALL_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
];

const CRITICAL_CATEGORIES = [
  "UTILITY_ELECTRIC",
  "UTILITY_GAS",
  "UTILITY_WATER",
  "UTILITY_SEWER",
  "UTILITY_TRASH",
  "UTILITY_INTERNET",
  "UTILITY_CABLE",
  "GOVERNMENT_DMV",
  "GOVERNMENT_VOTER",
  "TRANSPORTATION_TOLL",
  "TRANSPORTATION_TRANSIT",
  "FINANCIAL_INSURANCE_AUTO",
  "FINANCIAL_INSURANCE_RENTERS",
  "FINANCIAL_BANK",
  "GOVERNMENT_POSTAL",
];

type RawProvider = {
  name: string;
  slug?: string;
  category: string;
  website?: string;
  phone?: string;
  logoUrl?: string | null;
  scope?: string;
  states?: string[];
  zipCodes?: string[];
  description?: string;
};

type NormalizedProvider = ReturnType<typeof normalizeProviderRecord>;

type MatrixCell = {
  state: string;
  category: string;
  count: number;
  federalCount: number;
  stateCount: number;
  zipRuleCount: number;
  broadOnly: boolean;
  gapType: "covered" | "missing" | "broad_only";
  suggestedSourceType: string;
  riskIfIgnored: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  adminQueue: string;
};

function getSuggestedSourceType(category: string) {
  if (category.startsWith("UTILITY_INTERNET") || category === "UTILITY_CABLE") {
    return "FCC broadband data/map plus official provider availability pages";
  }
  if (category.startsWith("UTILITY_")) {
    return "State public utility commission, EIA/FERC/state utility data, and official utility pages";
  }
  if (category === "GOVERNMENT_DMV" || category === "GOVERNMENT_VOTER" || category === "GOVERNMENT_POSTAL") {
    return "Official state/federal government pages";
  }
  if (category.startsWith("TRANSPORTATION_")) {
    return "Official toll, transit, or transportation agency pages";
  }
  if (category.startsWith("FINANCIAL_INSURANCE")) {
    return "Official provider pages and state insurance department context";
  }
  if (category.startsWith("FINANCIAL_")) {
    return "Official provider contact pages";
  }
  return "Official provider or agency source";
}

function getRiskIfIgnored(category: string, gapType: "covered" | "missing" | "broad_only") {
  if (gapType === "covered") return "No current critical gap by broad catalog rules; still not proof of address availability.";
  if (category.startsWith("UTILITY_")) {
    return gapType === "missing"
      ? "Users may have no current-product guidance for starting required destination utility service."
      : "Users may see broad utility listings that are not correct for their exact address or service territory.";
  }
  if (category.startsWith("GOVERNMENT_")) {
    return "Users may miss required state/federal move updates or rely on incomplete government guidance.";
  }
  if (category.startsWith("TRANSPORTATION_")) {
    return "Users may miss toll/transit account updates or local transportation requirements.";
  }
  if (category.startsWith("FINANCIAL_INSURANCE")) {
    return "Users may miss insurance address or requote steps that can affect coverage.";
  }
  return "Users may receive incomplete provider guidance for the move.";
}

function getPriority(category: string, gapType: "covered" | "missing" | "broad_only"): "HIGH" | "MEDIUM" | "LOW" {
  if (gapType === "covered") return "LOW";
  if (category.startsWith("UTILITY_") || category === "GOVERNMENT_DMV" || category === "GOVERNMENT_VOTER") return "HIGH";
  if (category.startsWith("FINANCIAL_INSURANCE") || category.startsWith("TRANSPORTATION_")) return "MEDIUM";
  return "LOW";
}

function getSeedProviders(): NormalizedProvider[] {
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

  return sanitizeProviderSeedRecords(rawProviders).providers.map((provider) =>
    normalizeProviderRecord(provider),
  );
}

function providerCoversState(provider: NormalizedProvider, state: string) {
  return provider.scope === "FEDERAL" || provider.states.includes(state);
}

function groupByDomain(providers: NormalizedProvider[]) {
  const buckets = new Map<string, NormalizedProvider[]>();
  for (const provider of providers) {
    const domain = normalizeProviderUrlDomain(provider.website);
    if (!domain) continue;
    const list = buckets.get(domain) || [];
    list.push(provider);
    buckets.set(domain, list);
  }
  return buckets;
}

function getDomainCounts(providers: NormalizedProvider[]) {
  const counts = new Map<string, number>();
  for (const [domain, list] of groupByDomain(providers)) {
    counts.set(domain, list.length);
  }
  return counts;
}

function getWarnings(provider: NormalizedProvider, domainCounts: Map<string, number>) {
  const domain = normalizeProviderUrlDomain(provider.website);
  return getProviderQualityWarnings({
    ...provider,
    duplicateDomainCount: domain ? domainCounts.get(domain) || 0 : 0,
  });
}

function buildMatrix(providers: NormalizedProvider[], domainCounts: Map<string, number>) {
  const cells: MatrixCell[] = [];

  for (const state of ALL_STATES) {
    for (const category of CRITICAL_CATEGORIES) {
      const matches = providers.filter(
        (provider) => provider.category === category && providerCoversState(provider, state),
      );
      const broadMatches = matches.filter((provider) => {
        const warnings = getWarnings(provider, domainCounts);
        return warnings.some((warning) =>
          [
            "broad_state_coverage",
            "broad_national_coverage",
            "address_check_required",
            "polygon_check_required",
          ].includes(warning.code),
        );
      });

      const gapType: MatrixCell["gapType"] =
        matches.length === 0 ? "missing" : matches.length === broadMatches.length ? "broad_only" : "covered";

      cells.push({
        state,
        category,
        count: matches.length,
        federalCount: matches.filter((provider) => provider.scope === "FEDERAL").length,
        stateCount: matches.filter((provider) => provider.scope === "STATE").length,
        zipRuleCount: matches.filter((provider) => provider.zipCodes.length > 0).length,
        broadOnly: matches.length > 0 && matches.length === broadMatches.length,
        gapType,
        suggestedSourceType: getSuggestedSourceType(category),
        riskIfIgnored: getRiskIfIgnored(category, gapType),
        priority: getPriority(category, gapType),
        adminQueue: gapType === "missing" ? "Coverage Gap Queue" : gapType === "broad_only" ? "Broad Coverage Review Queue" : "Provider Quality Queue",
      });
    }
  }

  return cells;
}

function summarizeQuality(providers: NormalizedProvider[], domainCounts: Map<string, number>) {
  const byCode = new Map<string, { label: string; count: number; examples: string[] }>();

  for (const provider of providers) {
    for (const warning of getWarnings(provider, domainCounts)) {
      const bucket = byCode.get(warning.code) || {
        label: warning.label,
        count: 0,
        examples: [],
      };
      bucket.count += 1;
      if (bucket.examples.length < 25) {
        bucket.examples.push(`${provider.name} (${provider.category})`);
      }
      byCode.set(warning.code, bucket);
    }
  }

  return [...byCode.entries()]
    .map(([code, bucket]) => ({ code, ...bucket }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function summarizeDuplicateDomains(providers: NormalizedProvider[]) {
  return [...groupByDomain(providers).entries()]
    .filter(([, list]) => list.length > 1)
    .map(([domain, list]) => ({
      domain,
      count: list.length,
      categories: [...new Set(list.map((provider) => provider.category))].sort(),
      providers: list
        .map((provider) => ({
          name: provider.name,
          slug: provider.slug,
          category: provider.category,
        }))
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

function summarizeBroadCoverage(providers: NormalizedProvider[], domainCounts: Map<string, number>) {
  return providers
    .map((provider) => ({
      name: provider.name,
      slug: provider.slug,
      category: provider.category,
      scope: provider.scope,
      states: provider.states,
      warnings: getWarnings(provider, domainCounts)
        .filter((warning) =>
          [
            "broad_state_coverage",
            "broad_national_coverage",
            "address_check_required",
            "polygon_check_required",
          ].includes(warning.code),
        )
        .map((warning) => warning.label),
    }))
    .filter((provider) => provider.warnings.length > 0)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function summarizeSuspiciousCategories(providers: NormalizedProvider[]) {
  const counts = new Map<string, number>();
  for (const provider of providers) {
    counts.set(provider.category, (counts.get(provider.category) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      label: CATEGORY_META[category]?.label || category,
      count,
      reason:
        count <= 1
          ? "Suspiciously low catalog count"
          : count >= 50
            ? "High count; review for broad imports or over-splitting"
            : "Within current review threshold",
    }))
    .filter((entry) => entry.count <= 1 || entry.count >= 50)
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

function summarizeSplitMergeCandidates(providers: NormalizedProvider[]) {
  const duplicateDomains = summarizeDuplicateDomains(providers);
  return duplicateDomains
    .filter((bucket) => bucket.categories.length > 1)
    .slice(0, 50)
    .map((bucket) => ({
      domain: bucket.domain,
      categories: bucket.categories,
      note:
        "Review as merge, split, or cross-link candidate. Do not auto-merge without official-source validation.",
      providers: bucket.providers,
    }));
}

function buildMarkdown(input: {
  generatedAt: string;
  providers: NormalizedProvider[];
  matrix: MatrixCell[];
  quality: ReturnType<typeof summarizeQuality>;
  duplicateDomains: ReturnType<typeof summarizeDuplicateDomains>;
  broadCoverage: ReturnType<typeof summarizeBroadCoverage>;
  suspiciousCategories: ReturnType<typeof summarizeSuspiciousCategories>;
  splitMergeCandidates: ReturnType<typeof summarizeSplitMergeCandidates>;
}) {
  const missingCells = input.matrix.filter((cell) => cell.count === 0);
  const broadOnlyCells = input.matrix.filter((cell) => cell.broadOnly);
  const expansionBacklog = input.matrix
    .filter((cell) => cell.gapType !== "covered")
    .sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || a.state.localeCompare(b.state) || a.category.localeCompare(b.category);
    });
  const weakUtilityStates = ALL_STATES.map((state) => ({
    state,
    missing: missingCells
      .filter((cell) => cell.state === state && cell.category.startsWith("UTILITY_"))
      .map((cell) => cell.category),
    broadOnly: broadOnlyCells
      .filter((cell) => cell.state === state && cell.category.startsWith("UTILITY_"))
      .map((cell) => cell.category),
  })).filter((entry) => entry.missing.length > 0 || entry.broadOnly.length > 0);
  const weakGovernmentStates = ALL_STATES.map((state) => ({
    state,
    missing: missingCells
      .filter((cell) => cell.state === state && cell.category.startsWith("GOVERNMENT_"))
      .map((cell) => cell.category),
    broadOnly: broadOnlyCells
      .filter((cell) => cell.state === state && cell.category.startsWith("GOVERNMENT_"))
      .map((cell) => cell.category),
  })).filter((entry) => entry.missing.length > 0 || entry.broadOnly.length > 0);

  const lines: string[] = [];
  lines.push("# Provider Readiness Gap Report");
  lines.push("");
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Providers reviewed: ${input.providers.length}`);
  lines.push(`- State/category matrix cells: ${input.matrix.length}`);
  lines.push(`- Missing critical state/category cells: ${missingCells.length}`);
  lines.push(`- Broad-only state/category cells: ${broadOnlyCells.length}`);
  lines.push(`- Duplicate-domain buckets: ${input.duplicateDomains.length}`);
  for (const bucket of input.quality) {
    lines.push(`- ${bucket.label}: ${bucket.count}`);
  }
  lines.push("");
  lines.push("## Missing Critical Categories By State");
  lines.push("");
  if (missingCells.length === 0) {
    lines.push("- None by current broad catalog rules. This does not prove address availability.");
  } else {
    for (const state of ALL_STATES) {
      const missing = missingCells.filter((cell) => cell.state === state);
      if (missing.length === 0) continue;
      lines.push(`- ${state}: ${missing.map((cell) => cell.category).join(", ")}`);
    }
  }
  lines.push("");
  lines.push("## Broad-Only Critical Coverage");
  lines.push("");
  broadOnlyCells.slice(0, 120).forEach((cell) => {
    lines.push(`- ${cell.state} ${cell.category}: ${cell.count} providers, all broad or address-check-required`);
  });
  if (broadOnlyCells.length > 120) {
    lines.push(`- ${broadOnlyCells.length - 120} additional broad-only cells omitted from markdown; see JSON.`);
  }
  lines.push("");
  lines.push("## Duplicate Domain Buckets");
  lines.push("");
  input.duplicateDomains.slice(0, 40).forEach((bucket) => {
    lines.push(`- ${bucket.domain}: ${bucket.count} records across ${bucket.categories.join(", ")}`);
  });
  lines.push("");
  lines.push("## Broad Coverage Provider Candidates");
  lines.push("");
  input.broadCoverage.slice(0, 80).forEach((provider) => {
    lines.push(`- ${provider.name} | ${provider.category} | ${provider.scope} | ${provider.warnings.join(", ")}`);
  });
  lines.push("");
  lines.push("## Suspicious Category Counts");
  lines.push("");
  input.suspiciousCategories.forEach((entry) => {
    lines.push(`- ${entry.category} (${entry.label}): ${entry.count} - ${entry.reason}`);
  });
  lines.push("");
  lines.push("## Split, Merge, Or Cross-Link Candidates");
  lines.push("");
  input.splitMergeCandidates.slice(0, 30).forEach((bucket) => {
    lines.push(`- ${bucket.domain}: ${bucket.categories.join(", ")}`);
  });
  lines.push("");
  lines.push("## Weak Utility States");
  lines.push("");
  weakUtilityStates.slice(0, 30).forEach((entry) => {
    lines.push(`- ${entry.state}: missing [${entry.missing.join(", ") || "none"}], broad-only [${entry.broadOnly.join(", ") || "none"}]`);
  });
  lines.push("");
  lines.push("## Weak Government Task States");
  lines.push("");
  weakGovernmentStates.slice(0, 30).forEach((entry) => {
    lines.push(`- ${entry.state}: missing [${entry.missing.join(", ") || "none"}], broad-only [${entry.broadOnly.join(", ") || "none"}]`);
  });
  lines.push("");
  lines.push("## Provider Expansion Backlog");
  lines.push("");
  expansionBacklog.slice(0, 120).forEach((cell) => {
    lines.push(`- ${cell.priority} | ${cell.state} ${cell.category} | ${cell.gapType} | ${cell.adminQueue}`);
    lines.push(`  - Source type: ${cell.suggestedSourceType}`);
    lines.push(`  - Risk: ${cell.riskIfIgnored}`);
  });
  if (expansionBacklog.length > 120) {
    lines.push(`- ${expansionBacklog.length - 120} additional backlog items omitted from markdown; see JSON.`);
  }
  lines.push("");
  lines.push("## User-Created Provider Promotion Candidates");
  lines.push("");
  lines.push("- Static seed reports do not include user-created private provider rows because they require database access.");
  lines.push("- Review user-created provider promotion candidates in the admin Provider Governance Center.");
  lines.push("- Promotion to the global catalog still requires official-source validation and audit.");
  lines.push("");
  lines.push("## Source-First Expansion Rules");
  lines.push("");
  lines.push("- Use state public utility commissions for electric, gas, water, telecom, and utility territory research.");
  lines.push("- Use FCC broadband data/maps for internet availability research.");
  lines.push("- Use official state DMV, voter, toll, transit, and agency pages for government and transportation records.");
  lines.push("- Use official provider websites/contact pages for domain and phone validation.");
  lines.push("- Do not use generic SEO pages or search snippets as proof.");
  lines.push("- Do not mark providers as verified until source URL, checked date, and validation status have an approved storage path.");

  return lines.join("\n");
}

async function main() {
  const providers = getSeedProviders();
  const domainCounts = getDomainCounts(providers);
  const generatedAt = new Date().toISOString();
  const matrix = buildMatrix(providers, domainCounts);
  const quality = summarizeQuality(providers, domainCounts);
  const duplicateDomains = summarizeDuplicateDomains(providers);
  const broadCoverage = summarizeBroadCoverage(providers, domainCounts);
  const suspiciousCategories = summarizeSuspiciousCategories(providers);
  const splitMergeCandidates = summarizeSplitMergeCandidates(providers);
  const providerExpansionBacklog = matrix
    .filter((cell) => cell.gapType !== "covered")
    .sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || a.state.localeCompare(b.state) || a.category.localeCompare(b.category);
    });

  const report = {
    generatedAt,
    providerCount: providers.length,
    criticalCategories: CRITICAL_CATEGORIES,
    addressSensitiveCategories: [...LOCATION_SENSITIVE_PROVIDER_CATEGORIES],
    addressQualifiedFederalCategories: [...ADDRESS_QUALIFIED_FEDERAL_CATEGORIES],
    matrix,
    missingCriticalCategories: matrix.filter((cell) => cell.count === 0),
    broadOnlyCriticalCoverage: matrix.filter((cell) => cell.broadOnly),
    providerExpansionBacklog,
    userCreatedProviderPromotionCandidates: {
      includedInStaticReport: false,
      source: "Admin database userCustomProvider records",
      adminQueue: "User-Created Provider Review Queue",
      note: "Private user-created provider rows are reviewed in admin. Promotion to global catalog requires official-source validation.",
    },
    quality,
    duplicateDomains,
    broadCoverage,
    suspiciousCategories,
    splitMergeCandidates,
  };

  const docsDir = resolve(process.cwd(), "docs", "generated");
  await mkdir(docsDir, { recursive: true });
  await writeFile(
    resolve(docsDir, "provider-readiness-gap-report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
  await writeFile(
    resolve(docsDir, "provider-readiness-gap-report.md"),
    buildMarkdown({
      generatedAt,
      providers,
      matrix,
      quality,
      duplicateDomains,
      broadCoverage,
      suspiciousCategories,
      splitMergeCandidates,
    }),
    "utf8",
  );

  console.log("Wrote provider readiness gap report artifacts to docs/generated.");
}

void main();

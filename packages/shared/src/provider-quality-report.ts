import {
  ADDRESS_QUALIFIED_FEDERAL_CATEGORIES,
  getProviderQualityWarnings,
  inferProviderCoverageModel,
  LOCATION_SENSITIVE_PROVIDER_CATEGORIES,
  normalizeProviderRecord,
  type ProviderCoverageModelName,
  type ProviderIntegrityRecord,
  type ProviderQualityWarning,
} from "./provider-integrity";
import {
  expandCoverageRows,
  normalizeZip,
  resolveEffectiveState,
  type CoverageRow,
} from "./provider-coverage";

export const US_STATES_AND_DC = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
] as const;

export interface ProviderQualityCoverageRow {
  state?: string | null;
  zipPrefix?: string | null;
  zipExact?: string | null;
}

export interface ProviderQualityRecord extends ProviderIntegrityRecord {
  coverageModel?: string | null;
  coverages?: ProviderQualityCoverageRow[] | null;
  deletedAt?: Date | string | number | null;
  updatedAt?: Date | string | number | null;
}

export interface ProviderModelCount {
  model: ProviderCoverageModelName;
  count: number;
}

export interface ProviderCategoryQualityRow {
  category: string;
  count: number;
  locationSensitiveCount: number;
  zipRuleCount: number;
  coverageModels: Record<ProviderCoverageModelName, number>;
}

export interface ProviderStateQualityRow {
  state: string;
  stateProviderCount: number;
  categoryCount: number;
  isThin: boolean;
}

export interface ProviderWarningSummary {
  code: ProviderQualityWarning["code"];
  severity: ProviderQualityWarning["severity"];
  count: number;
}

export interface ProviderGrowthPriorityItem {
  priority: "P0" | "P1" | "P2" | "P3";
  title: string;
  affectedArea: string;
  recommendation: string;
  evidence: string;
}

export interface ProviderQualitySnapshot {
  generatedAt: string;
  summary: {
    totalProviders: number;
    activeProviders: number;
    categoryCount: number;
    stateCount: number;
    federalProviderCount: number;
    locationSensitiveProviders: number;
    locationSensitiveWithZipRules: number;
    locationSensitiveNonStateCoverage: number;
    stateScopedOverbroadProviders: number;
    sparseCategoryCount: number;
    thinStateCount: number;
    thinStateThreshold: number;
  };
  coverageModels: ProviderModelCount[];
  categories: ProviderCategoryQualityRow[];
  states: ProviderStateQualityRow[];
  sparseCategories: ProviderCategoryQualityRow[];
  thinStates: ProviderStateQualityRow[];
  warningSummary: ProviderWarningSummary[];
  priorityItems: ProviderGrowthPriorityItem[];
}

export type ProviderQueryMatchLevel =
  | "exact_zip"
  | "zip_prefix"
  | "mapped_area"
  | "live_address"
  | "state"
  | "federal"
  | "unknown";

export interface ProviderQueryDiagnosticRow {
  id?: string;
  name: string;
  category: string;
  scope: string;
  coverageModel: ProviderCoverageModelName;
  matchLevel: ProviderQueryMatchLevel;
  confidence: "high" | "medium" | "low" | "unknown";
  warningCodes: ProviderQualityWarning["code"][];
  popularityScore: number;
}

export interface ProviderQueryDiagnostics {
  input: {
    state: string | null;
    zip: string | null;
    normalizedZip: string | null;
    effectiveState: string | null;
    hasCoordinates: boolean;
  };
  candidateCount: number;
  modelCounts: ProviderModelCount[];
  matchCounts: Array<{ matchLevel: ProviderQueryMatchLevel; count: number }>;
  confidenceCounts: Array<{ confidence: ProviderQueryDiagnosticRow["confidence"]; count: number }>;
  addressCheckCandidateCount: number;
  topProviders: ProviderQueryDiagnosticRow[];
}

const MODEL_ORDER: ProviderCoverageModelName[] = ["live_address", "zip_prefix", "polygon", "state"];
const HIGH_RISK_UTILITY_CATEGORIES = new Set([
  "UTILITY_ELECTRIC",
  "UTILITY_GAS",
  "UTILITY_WATER",
  "UTILITY_INTERNET",
  "UTILITY_TRASH",
  "UTILITY_SEWER",
]);
const QUERY_MATCH_ORDER: ProviderQueryMatchLevel[] = [
  "exact_zip",
  "zip_prefix",
  "mapped_area",
  "live_address",
  "state",
  "federal",
  "unknown",
];
const CONFIDENCE_ORDER: ProviderQueryDiagnosticRow["confidence"][] = ["high", "medium", "low", "unknown"];

function emptyModelCounts(): Record<ProviderCoverageModelName, number> {
  return { state: 0, zip_prefix: 0, polygon: 0, live_address: 0 };
}

function isLocationSensitiveCategory(category: string): boolean {
  const normalized = category.toUpperCase();
  return (
    LOCATION_SENSITIVE_PROVIDER_CATEGORIES.has(normalized) ||
    ADDRESS_QUALIFIED_FEDERAL_CATEGORIES.has(normalized)
  );
}

function normalizeScope(scope?: string | null): string {
  return (scope || "FEDERAL").toUpperCase();
}

function normalizedCoverageRows(record: ProviderQualityRecord): CoverageRow[] {
  if (Array.isArray(record.coverages) && record.coverages.length > 0) {
    return record.coverages
      .map((row) => ({
        state: row.state?.trim().toUpperCase() || null,
        zipPrefix: normalizeZip(row.zipPrefix || null) || null,
        zipExact: normalizeZip(row.zipExact || null) || null,
      }))
      .filter((row) => row.state || row.zipPrefix || row.zipExact);
  }

  return expandCoverageRows({
    scope: normalizeScope(record.scope),
    states: record.states,
    zipCodes: record.zipCodes,
  });
}

function hasZipRule(record: ProviderQualityRecord, coverageRows = normalizedCoverageRows(record)): boolean {
  const normalized = normalizeProviderRecord(record);
  return normalized.zipCodes.length > 0 || coverageRows.some((row) => row.zipExact || row.zipPrefix);
}

function stateSetForRecord(record: ProviderQualityRecord): Set<string> {
  const states = new Set<string>();
  for (const row of normalizedCoverageRows(record)) {
    if (row.state) states.add(row.state);
  }
  const normalized = normalizeProviderRecord(record);
  for (const state of normalized.states) states.add(state);
  return states;
}

function modelCountsToRows(counts: Record<ProviderCoverageModelName, number>): ProviderModelCount[] {
  return MODEL_ORDER.map((model) => ({ model, count: counts[model] }));
}

function incrementMap<K extends string>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) || 0) + by);
}

function queryConfidence(matchLevel: ProviderQueryMatchLevel): ProviderQueryDiagnosticRow["confidence"] {
  if (matchLevel === "exact_zip") return "high";
  if (matchLevel === "zip_prefix" || matchLevel === "mapped_area") return "medium";
  if (matchLevel === "live_address" || matchLevel === "state" || matchLevel === "federal") return "low";
  return "unknown";
}

function queryMatchScore(matchLevel: ProviderQueryMatchLevel): number {
  switch (matchLevel) {
    case "exact_zip":
      return 70;
    case "zip_prefix":
      return 60;
    case "mapped_area":
      return 50;
    case "live_address":
      return 42;
    case "state":
      return 25;
    case "federal":
      return 10;
    default:
      return 0;
  }
}

function determineQueryMatch(
  record: ProviderQualityRecord,
  options: { effectiveState?: string | null; normalizedZip?: string | null },
): ProviderQueryMatchLevel {
  const coverageModel = inferProviderCoverageModel(record);
  const rows = normalizedCoverageRows(record);
  const normalizedZip = options.normalizedZip || null;
  const effectiveState = options.effectiveState || null;

  if (normalizedZip) {
    if (rows.some((row) => row.zipExact && row.zipExact === normalizedZip)) return "exact_zip";
    if (rows.some((row) => row.zipPrefix && normalizedZip.startsWith(row.zipPrefix))) {
      return "zip_prefix";
    }
  }

  if (coverageModel === "polygon") return "mapped_area";
  if (coverageModel === "live_address") return "live_address";
  if (
    effectiveState &&
    rows.some((row) => row.state === effectiveState && !row.zipExact && !row.zipPrefix)
  ) {
    return "state";
  }
  if (normalizeScope(record.scope) === "FEDERAL") return "federal";
  return "unknown";
}

function recordCanApplyToState(record: ProviderQualityRecord, effectiveState?: string | null): boolean {
  if (!effectiveState) return true;
  if (normalizeScope(record.scope) === "FEDERAL") return true;
  return stateSetForRecord(record).has(effectiveState);
}

function buildPriorityItems(snapshot: Omit<ProviderQualitySnapshot, "priorityItems">): ProviderGrowthPriorityItem[] {
  const items: ProviderGrowthPriorityItem[] = [];
  const thinStateNames = snapshot.thinStates.slice(0, 8).map((row) => `${row.state} (${row.stateProviderCount})`);
  const sparseCategoryNames = snapshot.sparseCategories.slice(0, 8).map((row) => `${row.category} (${row.count})`);
  const utilityStateModeRows = snapshot.categories.filter(
    (row) => HIGH_RISK_UTILITY_CATEGORIES.has(row.category) && row.coverageModels.state > 0,
  );

  if (snapshot.summary.stateScopedOverbroadProviders > 0) {
    items.push({
      priority: "P0",
      title: "Fix broad location-sensitive coverage",
      affectedArea: "Recommendations",
      recommendation: "Move location-sensitive providers from state-level coverage to ZIP, polygon, or live-address checks.",
      evidence: `${snapshot.summary.stateScopedOverbroadProviders} active provider rows still resolve to state-level coverage in address-sensitive categories.`,
    });
  }

  if (utilityStateModeRows.length > 0) {
    items.push({
      priority: "P1",
      title: "Tighten utility precision",
      affectedArea: "Electric, gas, water, trash, sewer",
      recommendation: "Prefer official service territory, ZIP, or address-confirmed utility data before showing high-confidence recommendations.",
      evidence: utilityStateModeRows
        .slice(0, 6)
        .map((row) => `${row.category}: ${row.coverageModels.state}`)
        .join(", "),
    });
  }

  if (snapshot.summary.sparseCategoryCount > 0) {
    items.push({
      priority: "P1",
      title: "Fill sparse provider categories",
      affectedArea: "Catalog depth",
      recommendation: "Prioritize official/statewide sources or vetted national brands for categories with three or fewer active providers.",
      evidence: sparseCategoryNames.join(", "),
    });
  }

  if (snapshot.summary.thinStateCount > 0) {
    items.push({
      priority: "P2",
      title: "Raise thin-state coverage",
      affectedArea: "Geographic completeness",
      recommendation: "Add state-specific utility, DMV, voter, transit, toll, healthcare, and home-service providers in the lowest-count states first.",
      evidence: thinStateNames.join(", "),
    });
  }

  items.push({
    priority: "P3",
    title: "Keep live data gates observable",
    affectedArea: "FCC/OpenEI/API-backed recommendations",
    recommendation: "Track FCC BDC, OpenEI, AirNow, Census, and FMCSA config separately from catalog counts so operators see missing live data before users do.",
    evidence: "Catalog quality and live API readiness are separate failure modes.",
  });

  return items;
}

export function buildProviderQualitySnapshot(
  records: ProviderQualityRecord[],
  options: { thinStateThreshold?: number; now?: Date } = {},
): ProviderQualitySnapshot {
  const now = options.now ?? new Date();
  const thinStateThreshold = options.thinStateThreshold ?? 12;
  const activeRecords = records.filter((record) => record.isActive !== false && !record.deletedAt);
  const categoryCounts = new Map<string, number>();
  const warningCounts = new Map<string, ProviderWarningSummary>();
  const modelCounts = emptyModelCounts();
  const categoryRows = new Map<string, ProviderCategoryQualityRow>();
  const stateBuckets = new Map<string, { providerIds: Set<string>; categories: Set<string> }>();

  for (const state of US_STATES_AND_DC) {
    stateBuckets.set(state, { providerIds: new Set(), categories: new Set() });
  }

  let federalProviderCount = 0;
  let locationSensitiveProviders = 0;
  let locationSensitiveWithZipRules = 0;
  let locationSensitiveNonStateCoverage = 0;
  let stateScopedOverbroadProviders = 0;

  for (const record of activeRecords) {
    const normalized = normalizeProviderRecord(record);
    const coverageRows = normalizedCoverageRows(record);
    const coverageModel = inferProviderCoverageModel(record);
    const category = normalized.category.toUpperCase();
    const sensitive = isLocationSensitiveCategory(category);
    const zipRule = hasZipRule(record, coverageRows);

    modelCounts[coverageModel] += 1;
    incrementMap(categoryCounts, category);
    if (normalized.scope === "FEDERAL") federalProviderCount += 1;
    if (sensitive) locationSensitiveProviders += 1;
    if (sensitive && zipRule) locationSensitiveWithZipRules += 1;
    if (sensitive && coverageModel !== "state") locationSensitiveNonStateCoverage += 1;
    if (sensitive && coverageModel === "state" && !zipRule) stateScopedOverbroadProviders += 1;

    const categoryRow = categoryRows.get(category) || {
      category,
      count: 0,
      locationSensitiveCount: 0,
      zipRuleCount: 0,
      coverageModels: emptyModelCounts(),
    };
    categoryRow.count += 1;
    categoryRow.coverageModels[coverageModel] += 1;
    if (sensitive) categoryRow.locationSensitiveCount += 1;
    if (zipRule) categoryRow.zipRuleCount += 1;
    categoryRows.set(category, categoryRow);

    if (normalized.scope !== "FEDERAL") {
      const states = stateSetForRecord(record);
      for (const state of states) {
        const bucket = stateBuckets.get(state);
        if (!bucket) continue;
        bucket.providerIds.add(record.id || normalized.slug);
        bucket.categories.add(category);
      }
    }

    const warnings = getProviderQualityWarnings(
      {
        ...record,
        scope: normalized.scope,
        states: normalized.states,
        zipCodes: normalized.zipCodes,
        coverageModel,
        updatedAt: record.updatedAt,
      },
      now.getTime(),
    );
    for (const warning of warnings) {
      const key = `${warning.code}:${warning.severity}`;
      const existing = warningCounts.get(key);
      warningCounts.set(key, {
        code: warning.code,
        severity: warning.severity,
        count: (existing?.count || 0) + 1,
      });
    }
  }

  const categories = [...categoryRows.values()].sort((a, b) => a.count - b.count || a.category.localeCompare(b.category));
  const states = US_STATES_AND_DC.map((state) => {
    const bucket = stateBuckets.get(state)!;
    return {
      state,
      stateProviderCount: bucket.providerIds.size,
      categoryCount: bucket.categories.size,
      isThin: bucket.providerIds.size < thinStateThreshold,
    };
  }).sort((a, b) => a.stateProviderCount - b.stateProviderCount || a.state.localeCompare(b.state));
  const sparseCategories = categories.filter((row) => row.count <= 3);
  const thinStates = states.filter((row) => row.isThin);

  const snapshotWithoutPriorities: Omit<ProviderQualitySnapshot, "priorityItems"> = {
    generatedAt: now.toISOString(),
    summary: {
      totalProviders: records.length,
      activeProviders: activeRecords.length,
      categoryCount: categoryCounts.size,
      stateCount: US_STATES_AND_DC.length,
      federalProviderCount,
      locationSensitiveProviders,
      locationSensitiveWithZipRules,
      locationSensitiveNonStateCoverage,
      stateScopedOverbroadProviders,
      sparseCategoryCount: sparseCategories.length,
      thinStateCount: thinStates.length,
      thinStateThreshold,
    },
    coverageModels: modelCountsToRows(modelCounts),
    categories,
    states,
    sparseCategories,
    thinStates,
    warningSummary: [...warningCounts.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
  };

  return {
    ...snapshotWithoutPriorities,
    priorityItems: buildPriorityItems(snapshotWithoutPriorities),
  };
}

export function buildProviderQueryDiagnostics(
  records: ProviderQualityRecord[],
  input: { state?: string | null; zip?: string | null; lat?: number | null; lng?: number | null } = {},
): ProviderQueryDiagnostics {
  const state = input.state?.trim().toUpperCase() || null;
  const normalizedZip = normalizeZip(input.zip || null) || null;
  const effectiveState = resolveEffectiveState(state, normalizedZip) || null;
  const modelCounts = emptyModelCounts();
  const matchCounts = new Map<ProviderQueryMatchLevel, number>();
  const confidenceCounts = new Map<ProviderQueryDiagnosticRow["confidence"], number>();
  const activeRecords = records.filter(
    (record) => record.isActive !== false && !record.deletedAt && recordCanApplyToState(record, effectiveState),
  );
  let addressCheckCandidateCount = 0;

  const rows = activeRecords.map((record): ProviderQueryDiagnosticRow => {
    const normalized = normalizeProviderRecord(record);
    const coverageModel = inferProviderCoverageModel(record);
    const matchLevel = determineQueryMatch(record, { effectiveState, normalizedZip });
    const confidence = queryConfidence(matchLevel);
    const warnings = getProviderQualityWarnings({
      ...record,
      scope: normalized.scope,
      states: normalized.states,
      zipCodes: normalized.zipCodes,
      coverageModel,
    });

    modelCounts[coverageModel] += 1;
    incrementMap(matchCounts, matchLevel);
    incrementMap(confidenceCounts, confidence);
    if (coverageModel === "live_address") addressCheckCandidateCount += 1;

    return {
      id: record.id,
      name: record.name,
      category: normalized.category.toUpperCase(),
      scope: normalized.scope,
      coverageModel,
      matchLevel,
      confidence,
      warningCodes: warnings.map((warning) => warning.code),
      popularityScore: record.popularityScore || 0,
    };
  });

  rows.sort((a, b) => {
    const scoreDiff = queryMatchScore(b.matchLevel) - queryMatchScore(a.matchLevel);
    if (scoreDiff !== 0) return scoreDiff;
    return b.popularityScore - a.popularityScore || a.name.localeCompare(b.name);
  });

  return {
    input: {
      state,
      zip: input.zip?.trim() || null,
      normalizedZip,
      effectiveState,
      hasCoordinates: typeof input.lat === "number" && typeof input.lng === "number",
    },
    candidateCount: rows.length,
    modelCounts: modelCountsToRows(modelCounts),
    matchCounts: QUERY_MATCH_ORDER.map((matchLevel) => ({
      matchLevel,
      count: matchCounts.get(matchLevel) || 0,
    })),
    confidenceCounts: CONFIDENCE_ORDER.map((confidence) => ({
      confidence,
      count: confidenceCounts.get(confidence) || 0,
    })),
    addressCheckCandidateCount,
    topProviders: rows.slice(0, 20),
  };
}

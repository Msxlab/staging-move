import { CONTROLLED_PROVIDER_IMPORT_ROWS } from "./controlled-provider-import-data";

export type ControlledProviderImportRow = {
  state: string;
  area: string;
  sourceCategory: string;
  name: string;
  slug: string;
  providerType: string;
  website: string;
  sourceUrl: string;
  coverageType: string;
  coverageNotes: string;
  confidence: string;
  addressCheckRequired: boolean;
  category: string;
  recommendedScope: string;
  zipPrefixes: string;
  existing: string;
  scopeProblem: string;
  safeToImport: string;
  action: string;
  wording: string;
  priority: string;
  notes: string;
  sourceFile: string;
  sourceCsvRow: string;
  importDecision: string;
  duplicateRule: string;
  clusterRule: string;
  addressRule: string;
  taskRule: string;
  surfaceRule: string;
  safeActivationRule: string;
};

const CONTROLLED_ROWS = CONTROLLED_PROVIDER_IMPORT_ROWS as unknown as ControlledProviderImportRow[];

export type ControlledProviderSeedRecord = {
  name: string;
  slug: string;
  category: string;
  subCategory: string;
  description: string;
  website?: string | null;
  phone?: string | null;
  scope: "STATE";
  states: string[];
  zipCodes: string[];
  tags: string[];
  popularityScore: number;
  isActive: boolean;
  displayOrder: number;
};

export type ControlledExistingProviderUpdate = {
  slug: string;
  states: string[];
  zipCodes: string[];
  tags: string[];
  description: string;
  subCategory: string;
  isActive?: boolean;
};

export type ControlledGovernanceIssueSeed = {
  providerSlug?: string;
  providerName: string;
  issueType: string;
  status: "OPEN";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  metadata: Record<string, unknown>;
};

const ACTIVE_IMPORT_DECISIONS = new Set([
  "ADD_IF_MISSING_AFTER_DEDUP_AND_SCOPE_CHECK",
  "ADD_RESOURCE_ONLY_IF_MISSING__NOT_PROVIDER_COVERAGE",
]);

const DRAFT_IMPORT_DECISIONS = new Set([
  "CREATE_DRAFT_PROVIDER__NOT_CLIENT_ACTIVE_UNTIL_REVIEW",
]);

const CATEGORY_SPLIT_SLUGS = new Set([
  "dc-water-wastewater",
  "wmata-metrorail",
  "wmata-metrobus",
  "tampa-wastewater",
]);

const EXISTING_UPDATE_SLUGS = new Set([
  "tampa-water",
]);

const STALE_EXISTING_PROVIDER_SLUGS: Record<string, string> = {
  "spire-alabama": "alagasco",
  "centerpoint-ar-stale": "centerpoint-ar",
  "dc-streetcar": "dc-streetcar",
};

const EXISTING_REVIEW_PROVIDER_SLUGS: Record<string, string> = {
  "central-alabama-water": "bwwb",
  "spire-alabama": "alagasco",
  "summit-utilities-arkansas": "centerpoint-ar",
};

const CATEGORY_MAP: Record<string, string> = {
  UTILITY_WASTE: "UTILITY_TRASH",
};

export function getControlledLocateFlowCategory(row: ControlledProviderImportRow): string {
  const category = String(row.category || "").trim().toUpperCase();
  return CATEGORY_MAP[category] || category;
}

export function isControlledResourceOnly(row: ControlledProviderImportRow): boolean {
  const text = [
    row.importDecision,
    row.providerType,
    row.coverageType,
    row.recommendedScope,
    row.clusterRule,
    row.taskRule,
    row.safeActivationRule,
  ]
    .join(" ")
    .toLowerCase();

  return (
    row.importDecision === "ADD_RESOURCE_ONLY_IF_MISSING__NOT_PROVIDER_COVERAGE" ||
    text.includes("resource-only") ||
    text.includes("resource only") ||
    text.includes("directory") ||
    text.includes("regulator") ||
    text.includes("lookup resource") ||
    text.includes("verification link")
  );
}

export function parseControlledZipPrefixes(value: string): string[] {
  const seen = new Set<string>();
  const zipPattern = /\b(\d{3})(?:\d{2})?(?:\s*-\s*(\d{3})(?:\d{2})?)?\b/g;
  let match: RegExpExecArray | null;

  while ((match = zipPattern.exec(value || ""))) {
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end < start || end - start > 150) {
      seen.add(String(start).padStart(3, "0"));
      continue;
    }
    for (let prefix = start; prefix <= end; prefix += 1) {
      seen.add(String(prefix).padStart(3, "0"));
    }
  }

  return [...seen].sort();
}

function cleanUrl(value: string): string | null {
  const clean = value.trim();
  if (!clean || clean.toLowerCase() === "unknown") return null;
  return clean;
}

function cleanSlug(row: ControlledProviderImportRow): string {
  return (row.slug || row.name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function compactDescription(row: ControlledProviderImportRow, resourceOnly: boolean): string {
  const parts = [
    row.wording || row.coverageNotes || `Check ${row.name} with the official source.`,
  ];
  if (row.addressCheckRequired) {
    parts.push("Confirm service availability at the exact address before relying on this listing.");
  }
  if (resourceOnly) {
    parts.push("Resource only; use it to verify the right local provider or process, not as a direct household biller.");
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function priorityScore(row: ControlledProviderImportRow, resourceOnly: boolean, draft: boolean): number {
  if (draft) return 5;
  const priority = row.priority.toLowerCase();
  if (resourceOnly) return priority.includes("critical") ? 45 : priority.includes("high") ? 40 : 30;
  if (priority.includes("critical")) return 65;
  if (priority.includes("high")) return 58;
  if (priority.includes("medium")) return 48;
  return 38;
}

function baseTags(row: ControlledProviderImportRow, options: { resourceOnly: boolean; draft: boolean; rejected?: boolean }): string[] {
  const tags = new Set<string>([
    "controlled-import",
    row.state.toLowerCase(),
    getControlledLocateFlowCategory(row).toLowerCase().replace(/_/g, "-"),
  ]);

  if (row.addressCheckRequired) tags.add("address-check-required");
  if (parseControlledZipPrefixes(row.zipPrefixes).length > 0) tags.add("zip-prefix-hint");
  if (options.resourceOnly) {
    tags.add("resource-only");
    tags.add("official-resource");
  }
  if (options.draft) {
    tags.add("manual-review");
    tags.add("draft-review");
  }
  if (options.rejected) tags.add("no-active-import");
  if (row.scopeProblem === "Yes") tags.add("scope-review");
  if (/stale|replace|alias/i.test(`${row.action} ${row.notes}`)) tags.add("alias-review");
  if (/municipal|city/i.test(`${row.providerType} ${row.recommendedScope} ${row.clusterRule}`)) tags.add("municipal");
  if (/county|regional/i.test(`${row.providerType} ${row.recommendedScope} ${row.clusterRule}`)) tags.add("regional");
  if (/state-level|statewide|regulator/i.test(`${row.providerType} ${row.recommendedScope} ${row.clusterRule}`)) tags.add("state-resource");

  return [...tags].sort();
}

function subCategoryFor(row: ControlledProviderImportRow, resourceOnly: boolean, draft: boolean): string {
  if (draft) return "DRAFT_REVIEW";
  if (resourceOnly) return "RESOURCE";
  if (row.addressCheckRequired) return "ADDRESS_CHECK_REQUIRED";
  if (/municipal|city/i.test(`${row.providerType} ${row.recommendedScope} ${row.clusterRule}`)) return "CITY_MUNICIPAL";
  if (/county|regional/i.test(`${row.providerType} ${row.recommendedScope} ${row.clusterRule}`)) return "COUNTY_REGIONAL";
  return "SERVICE_TERRITORY";
}

function buildSeedRecord(row: ControlledProviderImportRow, options: { draft: boolean }): ControlledProviderSeedRecord {
  const resourceOnly = isControlledResourceOnly(row);
  return {
    name: row.name,
    slug: cleanSlug(row),
    category: getControlledLocateFlowCategory(row),
    subCategory: subCategoryFor(row, resourceOnly, options.draft),
    description: compactDescription(row, resourceOnly),
    website: cleanUrl(row.website),
    phone: null,
    scope: "STATE",
    states: [row.state],
    zipCodes: parseControlledZipPrefixes(row.zipPrefixes),
    tags: baseTags(row, { resourceOnly, draft: options.draft }),
    popularityScore: priorityScore(row, resourceOnly, options.draft),
    isActive: !options.draft,
    displayOrder: 0,
  };
}

function shouldAddActiveSeed(row: ControlledProviderImportRow): boolean {
  if (row.safeToImport !== "Yes") return false;
  if (ACTIVE_IMPORT_DECISIONS.has(row.importDecision)) return true;
  return row.importDecision === "SKIP_INSERT__UPDATE_SCOPE_OR_METADATA_IF_NEEDED" && CATEGORY_SPLIT_SLUGS.has(cleanSlug(row));
}

function shouldAddDraftSeed(row: ControlledProviderImportRow): boolean {
  return row.safeToImport === "Manual Review" && DRAFT_IMPORT_DECISIONS.has(row.importDecision);
}

export function getControlledActiveProviderSeeds(): ControlledProviderSeedRecord[] {
  return CONTROLLED_ROWS
    .filter(shouldAddActiveSeed)
    .map((row) => buildSeedRecord(row, { draft: false }));
}

export function getControlledDraftProviderSeeds(): ControlledProviderSeedRecord[] {
  return CONTROLLED_ROWS
    .filter(shouldAddDraftSeed)
    .map((row) => buildSeedRecord(row, { draft: true }));
}

export function getControlledExistingProviderUpdates(): ControlledExistingProviderUpdate[] {
  const scopeUpdates = CONTROLLED_ROWS
    .filter((row) => row.importDecision === "SKIP_INSERT__UPDATE_SCOPE_OR_METADATA_IF_NEEDED")
    .filter((row) => EXISTING_UPDATE_SLUGS.has(cleanSlug(row)))
    .map((row) => ({
      slug: cleanSlug(row),
      states: [row.state],
      zipCodes: parseControlledZipPrefixes(row.zipPrefixes),
      tags: [...baseTags(row, { resourceOnly: false, draft: false }), "scope-corrected"].sort(),
      description: compactDescription(row, false),
      subCategory: subCategoryFor(row, false, false),
    }));

  const staleUpdates = CONTROLLED_ROWS
    .filter((row) => row.safeToImport === "No" || cleanSlug(row) === "spire-alabama")
    .map((row) => ({ row, existingSlug: STALE_EXISTING_PROVIDER_SLUGS[cleanSlug(row)] }))
    .filter((entry): entry is { row: ControlledProviderImportRow; existingSlug: string } => Boolean(entry.existingSlug))
    .map(({ row, existingSlug }) => ({
      slug: existingSlug,
      states: [row.state],
      zipCodes: parseControlledZipPrefixes(row.zipPrefixes),
      tags: [
        ...baseTags(row, { resourceOnly: false, draft: false, rejected: true }),
        "retired-stale",
      ].sort(),
      description: compactDescription(row, false),
      subCategory: "RETIRED_STALE",
      isActive: false,
    }));

  const reviewUpdates = CONTROLLED_ROWS
    .filter((row) => row.safeToImport === "Manual Review")
    .filter((row) => row.existing === "Yes" && row.scopeProblem === "Yes")
    .map((row) => ({ row, existingSlug: EXISTING_REVIEW_PROVIDER_SLUGS[cleanSlug(row)] || cleanSlug(row) }))
    .map(({ row, existingSlug }) => ({
      slug: existingSlug,
      states: [row.state],
      zipCodes: parseControlledZipPrefixes(row.zipPrefixes),
      tags: [
        ...baseTags(row, { resourceOnly: isControlledResourceOnly(row), draft: true }),
        "scope-review",
      ].sort(),
      description: compactDescription(row, isControlledResourceOnly(row)),
      subCategory: "SCOPE_REVIEW",
      isActive: false,
    }));

  return [...scopeUpdates, ...reviewUpdates, ...staleUpdates];
}

function governanceSeverity(row: ControlledProviderImportRow): ControlledGovernanceIssueSeed["severity"] {
  if (row.priority.toLowerCase().includes("critical")) return "CRITICAL";
  if (row.priority.toLowerCase().includes("high")) return "HIGH";
  if (row.safeToImport === "No" || row.scopeProblem === "Yes") return "HIGH";
  if (row.priority.toLowerCase().includes("low")) return "LOW";
  return "MEDIUM";
}

function governanceType(row: ControlledProviderImportRow): string {
  if (row.safeToImport === "No") return "CONTROLLED_IMPORT_REJECTED";
  if (/stale|replace|alias/i.test(`${row.action} ${row.notes}`)) return "CONTROLLED_ALIAS_REVIEW";
  if (row.scopeProblem === "Yes") return "CONTROLLED_SCOPE_REVIEW";
  if (shouldAddDraftSeed(row)) return "CONTROLLED_DRAFT_REVIEW";
  return "CONTROLLED_IMPORT_REVIEW";
}

function shouldCreateGovernanceIssue(row: ControlledProviderImportRow): boolean {
  if (row.importDecision === "SKIP_EXISTING__NO_CHANGE") return false;
  if (row.safeToImport === "No") return true;
  if (row.safeToImport === "Manual Review") return true;
  if (row.scopeProblem === "Yes") return true;
  return row.importDecision === "SKIP_INSERT__UPDATE_SCOPE_OR_METADATA_IF_NEEDED";
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length - 3)}...`;
}

export function getControlledGovernanceIssueSeeds(): ControlledGovernanceIssueSeed[] {
  return CONTROLLED_ROWS
    .filter(shouldCreateGovernanceIssue)
    .map((row) => {
      const category = getControlledLocateFlowCategory(row);
      const sourceRow = row.sourceCsvRow ? ` row ${row.sourceCsvRow}` : "";
      const title = truncate(`Controlled import: ${row.name} (${row.state} ${category}${sourceRow})`, 200);
      const action = row.action || row.importDecision || "Review controlled CSV row before activation.";
      const description = truncate(
        [
          action,
          row.safeActivationRule,
          row.addressCheckRequired ? "Address-level service availability must be confirmed." : "",
        ]
          .filter(Boolean)
          .join(" "),
        1200,
      );

      return {
        providerSlug:
          STALE_EXISTING_PROVIDER_SLUGS[cleanSlug(row)] ||
          EXISTING_REVIEW_PROVIDER_SLUGS[cleanSlug(row)] ||
          cleanSlug(row),
        providerName: row.name,
        issueType: governanceType(row),
        status: "OPEN",
        severity: governanceSeverity(row),
        title,
        description,
        metadata: {
          state: row.state,
          area: row.area,
          category,
          originalCategory: row.category,
          providerType: row.providerType,
          website: cleanUrl(row.website),
          sourceUrl: cleanUrl(row.sourceUrl),
          coverageType: row.coverageType,
          coverageNotes: row.coverageNotes,
          confidence: row.confidence,
          addressCheckRequired: row.addressCheckRequired,
          recommendedScope: row.recommendedScope,
          zipPrefixes: parseControlledZipPrefixes(row.zipPrefixes),
          existing: row.existing,
          scopeProblem: row.scopeProblem,
          safeToImport: row.safeToImport,
          importDecision: row.importDecision,
          duplicateRule: row.duplicateRule,
          clusterRule: row.clusterRule,
          addressRule: row.addressRule,
          taskRule: row.taskRule,
          surfaceRule: row.surfaceRule,
          safeActivationRule: row.safeActivationRule,
          sourceFile: row.sourceFile,
          sourceCsvRow: row.sourceCsvRow,
          notes: row.notes,
          proposedSlug: cleanSlug(row),
          resourceOnly: isControlledResourceOnly(row),
        },
      };
    });
}

export function getControlledImportSummary() {
  const summary = {
    total: CONTROLLED_ROWS.length,
    activeSeeds: getControlledActiveProviderSeeds().length,
    draftSeeds: getControlledDraftProviderSeeds().length,
    existingUpdates: getControlledExistingProviderUpdates().length,
    governanceIssues: getControlledGovernanceIssueSeeds().length,
    safeYes: 0,
    manualReview: 0,
    safeNo: 0,
  };

  for (const row of CONTROLLED_ROWS) {
    if (row.safeToImport === "Yes") summary.safeYes += 1;
    if (row.safeToImport === "Manual Review") summary.manualReview += 1;
    if (row.safeToImport === "No") summary.safeNo += 1;
  }

  return summary;
}

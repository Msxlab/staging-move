import { safeJsonArray } from "./provider-coverage";
import {
  getCoverageConfidencePresentation,
  getProviderTrustPresentation,
  mapCoverageMatchToConfidence,
  type CoverageConfidence,
  type ProviderTrustStatus,
} from "./provider-move-domain";

export interface ProviderIntegrityRecord {
  id?: string;
  name: string;
  slug?: string | null;
  category: string;
  subCategory?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  scope?: string | null;
  states?: string[] | string | null;
  zipCodes?: string[] | string | null;
  tags?: string[] | string | null;
  popularityScore?: number | null;
  isActive?: boolean | null;
  displayOrder?: number | null;
}

export interface NormalizedProviderRecord extends ProviderIntegrityRecord {
  slug: string;
  scope: string;
  states: string[];
  zipCodes: string[];
  tags: string[];
  normalizedName: string;
  websiteDomain: string | null;
}

export type ProviderCoverageMatchLevel =
  | "available_at_address"
  | "exact"
  | "prefix"
  | "polygon"
  | "state"
  | "live_address"
  | "unknown";

export type ProviderCoverageConfidenceLevel =
  | "high"
  | "medium"
  | "low"
  | "unknown";

export interface ProviderTrustRecord extends ProviderIntegrityRecord {
  coverageModel?: "state" | "zip_prefix" | "polygon" | "live_address" | string | null;
  coverageMatchLevel?: ProviderCoverageMatchLevel | string | null;
  coverageNote?: string | null;
  coverageSourceUrl?: string | null;
  requiresAddressCheck?: boolean | null;
  requiresPolygonCheck?: boolean | null;
  duplicateDomainCount?: number | null;
  /** Last time the catalog row was touched. Drives the stale_record freshness
   *  warning. Optional so callers that don't track freshness still compile. */
  updatedAt?: Date | string | number | null;
}

export type ProviderCoverageModelName = "state" | "zip_prefix" | "polygon" | "live_address";

export interface ProviderCoverageConfidence {
  confidence: CoverageConfidence;
  level: ProviderCoverageConfidenceLevel;
  label: string;
  message: string;
  requiresConfirmation: boolean;
}

export interface ProviderQualityWarning {
  code:
    | "missing_logo"
    | "missing_phone"
    | "missing_website"
    | "missing_description"
    | "generic_description"
    | "marketing_description"
    | "duplicate_domain"
    | "broad_state_coverage"
    | "broad_national_coverage"
    | "address_check_required"
    | "polygon_check_required"
    | "stale_record";
  label: string;
  message: string;
  severity: "info" | "warning" | "critical";
}

/** A catalog row not reviewed within this many days is flagged stale (info). */
export const PROVIDER_STALE_AFTER_DAYS = 180;

export interface ProviderTrustSummary {
  status: ProviderTrustStatus;
  statusLabel: "Listed provider";
  statusDescription: string;
  manualTracking: true;
  manualTrackingLabel: "Manual tracking only";
  manualTrackingDescription: string;
  verificationLabel: "Unverified directory data";
  verificationDescription: string;
  coverageConfidence: ProviderCoverageConfidence;
  qualityWarnings: ProviderQualityWarning[];
}

export const LOCATION_SENSITIVE_PROVIDER_CATEGORIES = new Set([
  "UTILITY_ELECTRIC",
  "UTILITY_GAS",
  "UTILITY_WATER",
  "UTILITY_INTERNET",
  "UTILITY_TRASH",
  "UTILITY_SEWER",
  "TRANSPORTATION_TRANSIT",
  "TRANSPORTATION_TOLL",
  "HOUSING_HOME_SERVICE",
  "HOUSING_MOVING",
  "GROCERY_DELIVERY",
]);

export const ADDRESS_QUALIFIED_FEDERAL_CATEGORIES = new Set([
  "UTILITY_INTERNET",
  "UTILITY_TRASH",
  "GROCERY_DELIVERY",
  "HOUSING_HOME_SERVICE",
  "HOUSING_MOVING",
  "HOUSING_STORAGE",
  "LOCAL_DINING",
  "FITNESS_GYM",
]);

function isProviderCoverageModelName(value: unknown): value is ProviderCoverageModelName {
  return value === "state" || value === "zip_prefix" || value === "polygon" || value === "live_address";
}

export function inferProviderCoverageModel(record: {
  scope?: string | null;
  category?: string | null;
  zipCodes?: string[] | string | null;
  coverageModel?: string | null;
}): ProviderCoverageModelName {
  if (isProviderCoverageModelName(record.coverageModel)) return record.coverageModel;
  if (normalizeZipCodes(record.zipCodes).length > 0) return "zip_prefix";

  const category = (record.category || "").toUpperCase();
  if (
    LOCATION_SENSITIVE_PROVIDER_CATEGORIES.has(category) ||
    ADDRESS_QUALIFIED_FEDERAL_CATEGORIES.has(category)
  ) {
    return "live_address";
  }

  return "state";
}

const MARKETING_DESCRIPTION_PATTERN =
  /\b(best|best-in-class|largest|leading|most convenient|number one|premium|premier|trusted|top-rated|world-class|#1)\b/i;

const GENERIC_DESCRIPTION_PATTERNS = [
  /\b(provider|service|company)\s*$/i,
  /^(local|regional|national|statewide)?\s*(service|provider|company)$/i,
  /\b(address|account|moving)\s+(service|provider)\b/i,
];

export interface ProviderConflict {
  type: "slug" | "name-category" | "website-category";
  existingId?: string;
  existingName: string;
  existingSlug: string;
  existingCategory: string;
}

export interface SanitizedSeedResult<T extends ProviderIntegrityRecord> {
  providers: Array<
    T & {
      slug: string;
      scope: string;
      states: string[];
      zipCodes: string[];
      tags: string[];
    }
  >;
  deduped: Array<{
    slug: string;
    keptName: string;
    keptCategory: string;
    removedCount: number;
  }>;
  renamed: Array<{
    name: string;
    category: string;
    from: string;
    to: string;
  }>;
}

export function slugifyProviderName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function normalizeProviderName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeProviderUrlDomain(
  value?: string | null,
): string | null {
  if (!value) return null;
  try {
    const url =
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`;
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isGenericProviderDescription(
  description?: string | null,
  providerName?: string | null,
): boolean {
  const clean = description?.trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  const normalizedName = providerName?.trim().toLowerCase();

  if (clean.length < 24) return true;
  if (normalizedName && lower === normalizedName) return true;
  return GENERIC_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(clean));
}

export function hasMarketingProviderDescription(
  description?: string | null,
): boolean {
  return MARKETING_DESCRIPTION_PATTERN.test(description || "");
}

const COVERAGE_CONFIDENCE_LEVEL: Record<
  CoverageConfidence,
  ProviderCoverageConfidenceLevel
> = {
  AVAILABLE_AT_ADDRESS: "high",
  EXACT_ZIP: "high",
  ZIP_PREFIX: "medium",
  MAPPED_SERVICE_AREA: "medium",
  STATE_LEVEL: "low",
  NATIONAL_OR_FEDERAL: "low",
  ADDRESS_CHECK_REQUIRED: "low",
  UNKNOWN: "unknown",
};

export function getProviderCoverageConfidence(
  record: ProviderTrustRecord,
): ProviderCoverageConfidence {
  const coverageModel = inferProviderCoverageModel(record);
  const matchLevel = (record.coverageMatchLevel ||
    (coverageModel === "live_address" ? "live_address" : null) ||
    "state") as ProviderCoverageMatchLevel;
  const confidence = mapCoverageMatchToConfidence(matchLevel, {
    scope: record.scope,
    coverageModel,
    requiresAddressCheck: record.requiresAddressCheck,
    requiresPolygonCheck: record.requiresPolygonCheck,
  });
  const presentation = getCoverageConfidencePresentation(confidence);

  // Derive the trust level directly from the resolved coverage confidence so it
  // can never drift from the label/message (which already follow `confidence`).
  // Previously a separate branch chain set `level` on its own, so an
  // unconfirmable polygon match could report an "Address check required" label
  // while still claiming a "medium" level.
  return {
    confidence,
    level: COVERAGE_CONFIDENCE_LEVEL[confidence],
    label: presentation.label,
    message: presentation.description,
    requiresConfirmation: true,
  };
}

export function getProviderQualityWarnings(
  record: ProviderTrustRecord,
  now: number = Date.now(),
): ProviderQualityWarning[] {
  const warnings: ProviderQualityWarning[] = [];
  const states = normalizeStates(record.states);
  const zipCodes = normalizeZipCodes(record.zipCodes);
  const domain = normalizeProviderUrlDomain(record.website);
  const coverageModel = inferProviderCoverageModel(record);
  const hasExternalCoverageModel =
    coverageModel === "live_address" || coverageModel === "polygon";

  if (!record.logoUrl) {
    warnings.push({
      code: "missing_logo",
      label: "Missing logo",
      message: "Provider has no logo URL; users will see a generic category icon.",
      severity: "info",
    });
  }

  if (!record.phone) {
    warnings.push({
      code: "missing_phone",
      label: "Missing phone",
      message: "Provider has no phone number in the catalog.",
      severity: "warning",
    });
  }

  if (!record.website) {
    warnings.push({
      code: "missing_website",
      label: "Missing website",
      message: "Provider has no website URL in the catalog.",
      severity: "critical",
    });
  }

  if (!record.description) {
    warnings.push({
      code: "missing_description",
      label: "Missing description",
      message: "Provider has no neutral user-facing description.",
      severity: "warning",
    });
  } else if (isGenericProviderDescription(record.description, record.name)) {
    warnings.push({
      code: "generic_description",
      label: "Generic description",
      message: "Description is too generic to establish what this provider covers.",
      severity: "warning",
    });
  }

  if (hasMarketingProviderDescription(record.description)) {
    warnings.push({
      code: "marketing_description",
      label: "Marketing language",
      message: "Description contains promotional language that should be neutralized.",
      severity: "warning",
    });
  }

  if (domain && (record.duplicateDomainCount || 0) > 1) {
    warnings.push({
      code: "duplicate_domain",
      label: "Duplicate domain candidate",
      message: `This domain appears on ${record.duplicateDomainCount} provider records. Review whether the split is intentional.`,
      severity: "info",
    });
  }

  if (
    record.scope === "STATE" &&
    zipCodes.length === 0 &&
    !hasExternalCoverageModel &&
    LOCATION_SENSITIVE_PROVIDER_CATEGORIES.has(record.category)
  ) {
    warnings.push({
      code: "broad_state_coverage",
      label: "Broad state coverage",
      message:
        "Location-sensitive category is modeled at state level. Availability may vary by city, territory, route, or address.",
      severity: "warning",
    });
  }

  if (
    record.scope === "FEDERAL" &&
    zipCodes.length === 0 &&
    !hasExternalCoverageModel &&
    ADDRESS_QUALIFIED_FEDERAL_CATEGORIES.has(record.category)
  ) {
    warnings.push({
      code: "broad_national_coverage",
      label: "Broad national listing",
      message:
        "National brand likely requires address-level serviceability confirmation.",
      severity: "warning",
    });
  }

  if (record.requiresAddressCheck || coverageModel === "live_address") {
    warnings.push({
      code: "address_check_required",
      label: "Address check required",
      message: "Official address-level availability check is required before relying on this provider.",
      severity: "warning",
    });
  }

  if (record.requiresPolygonCheck || coverageModel === "polygon") {
    warnings.push({
      code: "polygon_check_required",
      label: "Mapped coverage",
      message: "Coverage is approximate and should be reviewed against provider source maps.",
      severity: states.length > 1 ? "warning" : "info",
    });
  }

  // Freshness: this catalog is explicitly "unverified directory data", so a row
  // that hasn't been touched in a long time is a worklist signal for operators
  // (re-check coverage, links, contact details) rather than a hard defect.
  if (record.updatedAt != null) {
    const updatedMs =
      record.updatedAt instanceof Date ? record.updatedAt.getTime() : new Date(record.updatedAt).getTime();
    if (Number.isFinite(updatedMs)) {
      const ageDays = (now - updatedMs) / (24 * 60 * 60 * 1000);
      if (ageDays >= PROVIDER_STALE_AFTER_DAYS) {
        warnings.push({
          code: "stale_record",
          label: "Stale record",
          message: `Not reviewed in over ${PROVIDER_STALE_AFTER_DAYS} days — re-check coverage, links, and contact details.`,
          severity: "info",
        });
      }
    }
  }

  return warnings;
}

export function getProviderTrustSummary(
  record: ProviderTrustRecord,
): ProviderTrustSummary {
  const trust = getProviderTrustPresentation("LISTED");

  return {
    status: trust.status,
    statusLabel: "Listed provider",
    statusDescription: trust.description,
    manualTracking: true,
    manualTrackingLabel: "Manual tracking only",
    manualTrackingDescription:
      "Adding this provider creates a service record for your checklist. LocateFlow does not update your address with the provider.",
    verificationLabel: "Unverified directory data",
    verificationDescription:
      "Provider details should be confirmed with the official provider before you act.",
    coverageConfidence: getProviderCoverageConfidence(record),
    qualityWarnings: getProviderQualityWarnings(record),
  };
}

function normalizeStringArray(
  value: string[] | string | null | undefined,
): string[] {
  const source = Array.isArray(value) ? value : safeJsonArray(value);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of source) {
    const clean = item.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    normalized.push(clean);
  }

  return normalized;
}

function normalizeStates(
  value: string[] | string | null | undefined,
): string[] {
  return normalizeStringArray(value)
    .map((state) => state.toUpperCase())
    .filter((state) => state.length === 2);
}

function normalizeZipCodes(
  value: string[] | string | null | undefined,
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const zip of normalizeStringArray(value)) {
    const digits = zip.replace(/\D/g, "");
    if (digits.length < 3 || digits.length > 5 || seen.has(digits)) continue;
    seen.add(digits);
    normalized.push(digits);
  }

  return normalized;
}

function normalizeTags(value: string[] | string | null | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of normalizeStringArray(value)) {
    const clean = tag.toLowerCase();
    if (seen.has(clean)) continue;
    seen.add(clean);
    normalized.push(clean);
  }

  return normalized;
}

export function normalizeProviderRecord<T extends ProviderIntegrityRecord>(
  record: T,
): T & NormalizedProviderRecord {
  const slug = slugifyProviderName(record.slug?.trim() || record.name);
  const scope = (record.scope || "FEDERAL").toUpperCase();
  const states = normalizeStates(record.states);
  const zipCodes = normalizeZipCodes(record.zipCodes);
  const tags = normalizeTags(record.tags);

  return {
    ...record,
    slug,
    scope,
    states,
    zipCodes,
    tags,
    normalizedName: normalizeProviderName(record.name),
    websiteDomain: normalizeProviderUrlDomain(record.website),
  };
}

export function scoreProviderCompleteness(
  record: ProviderIntegrityRecord,
): number {
  let score = 0;
  if (record.description) score += 3;
  if (record.website) score += 3;
  if (record.phone) score += 2;
  if (record.logoUrl) score += 1;
  if (record.subCategory) score += 1;
  if (normalizeStates(record.states).length > 0) score += 2;
  if (normalizeZipCodes(record.zipCodes).length > 0) score += 2;
  if (normalizeTags(record.tags).length > 0) score += 1;
  if ((record.popularityScore || 0) > 0) score += 1;
  if ((record.displayOrder || 0) > 0) score += 1;
  return score;
}

function buildCategoryScopedSlug(baseSlug: string, category: string): string {
  return `${baseSlug}-${slugifyProviderName(category)}`;
}

function makeUniqueSlug(baseSlug: string, usedSlugs: Set<string>): string {
  if (!usedSlugs.has(baseSlug)) return baseSlug;

  let counter = 2;
  let candidate = `${baseSlug}-${counter}`;
  while (usedSlugs.has(candidate)) {
    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
  return candidate;
}

export function sanitizeProviderSeedRecords<T extends ProviderIntegrityRecord>(
  records: T[],
): SanitizedSeedResult<T> {
  const duplicateGroups = new Map<
    string,
    Array<T & NormalizedProviderRecord>
  >();
  const deduped: SanitizedSeedResult<T>["deduped"] = [];
  const renamed: SanitizedSeedResult<T>["renamed"] = [];
  const providers: SanitizedSeedResult<T>["providers"] = [];
  const usedSlugs = new Set<string>();
  const survivors: Array<T & NormalizedProviderRecord> = [];

  for (const record of records) {
    const normalized = normalizeProviderRecord(record);
    const duplicateKey = `${normalized.normalizedName}::${normalized.category.toUpperCase()}::${normalized.websiteDomain || ""}`;
    const list = duplicateGroups.get(duplicateKey) || [];
    list.push(normalized);
    duplicateGroups.set(duplicateKey, list);
  }

  for (const group of duplicateGroups.values()) {
    const sorted = [...group].sort(
      (a, b) => scoreProviderCompleteness(b) - scoreProviderCompleteness(a),
    );
    const [kept, ...removed] = sorted;
    survivors.push(kept);
    if (removed.length > 0) {
      deduped.push({
        slug: kept.slug,
        keptName: kept.name,
        keptCategory: kept.category,
        removedCount: removed.length,
      });
    }
  }

  const slugGroups = new Map<string, Array<T & NormalizedProviderRecord>>();
  for (const entry of survivors) {
    const list = slugGroups.get(entry.slug) || [];
    list.push(entry);
    slugGroups.set(entry.slug, list);
  }

  for (const [baseSlug, entries] of slugGroups.entries()) {
    entries
      .sort(
        (a, b) => scoreProviderCompleteness(b) - scoreProviderCompleteness(a),
      )
      .forEach((entry, index) => {
        let nextSlug = baseSlug;
        if (index > 0) {
          nextSlug = buildCategoryScopedSlug(baseSlug, entry.category);
        }
        nextSlug = makeUniqueSlug(nextSlug, usedSlugs);
        usedSlugs.add(nextSlug);

        if (nextSlug !== entry.slug) {
          renamed.push({
            name: entry.name,
            category: entry.category,
            from: entry.slug,
            to: nextSlug,
          });
        }

        providers.push({
          ...entry,
          slug: nextSlug,
        });
      });
  }

  return { providers, deduped, renamed };
}

export function findProviderConflicts<T extends ProviderIntegrityRecord>(
  existing: T[],
  candidate: ProviderIntegrityRecord,
  options?: { ignoreId?: string },
): ProviderConflict[] {
  const normalizedCandidate = normalizeProviderRecord(candidate);
  const conflicts: ProviderConflict[] = [];

  for (const provider of existing) {
    if (options?.ignoreId && provider.id === options.ignoreId) continue;

    const normalizedExisting = normalizeProviderRecord(provider);

    if (normalizedExisting.slug === normalizedCandidate.slug) {
      conflicts.push({
        type: "slug",
        existingId: provider.id,
        existingName: provider.name,
        existingSlug: normalizedExisting.slug,
        existingCategory: provider.category,
      });
      continue;
    }

    if (
      normalizedExisting.category.toUpperCase() ===
        normalizedCandidate.category.toUpperCase() &&
      normalizedExisting.normalizedName === normalizedCandidate.normalizedName
    ) {
      conflicts.push({
        type: "name-category",
        existingId: provider.id,
        existingName: provider.name,
        existingSlug: normalizedExisting.slug,
        existingCategory: provider.category,
      });
      continue;
    }

    if (
      normalizedExisting.category.toUpperCase() ===
        normalizedCandidate.category.toUpperCase() &&
      normalizedExisting.websiteDomain &&
      normalizedExisting.websiteDomain === normalizedCandidate.websiteDomain
    ) {
      conflicts.push({
        type: "website-category",
        existingId: provider.id,
        existingName: provider.name,
        existingSlug: normalizedExisting.slug,
        existingCategory: provider.category,
      });
    }
  }

  return conflicts;
}

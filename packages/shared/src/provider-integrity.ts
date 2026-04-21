import { safeJsonArray } from "./provider-coverage";

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

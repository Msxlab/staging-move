/**
 * Category-preselect helpers for the add-service flow (`/services/new?category=`).
 *
 * Briefing CTAs like "Set up internet" deep-link here with the catalog category
 * key. Instead of landing the user on the generic all-categories manual-entry
 * screen, the page uses these helpers to show that category's RECOMMENDED
 * providers first (the engine's existing sort already lifts "Available at your
 * address" matches to the top) and keeps manual add as the fallback path, with
 * a "show all categories" escape hatch.
 *
 * Pure functions — colocated with the page and unit-tested directly.
 */
import { getMergedDisplayCategoryKey } from "@/lib/recommendation-engine";
import type { ScoredProvider } from "@/lib/recommendation-engine";

/** Max providers surfaced in the category-scoped recommended panel. */
export const CATEGORY_RECOMMENDED_LIMIT = 6;

/**
 * Normalizes the `?category=` query param to the merged display-category key
 * the picker filters by (catalog enums are uppercase; FINANCIAL_* subcategories
 * merge into one "FINANCIAL" display group). Returns null for missing/blank
 * input — an unknown-but-present value passes through unchanged and simply
 * yields an empty filtered list plus the escape hatch, never a crash.
 */
export function resolvePreselectedCategoryKey(param: string | null | undefined): string | null {
  const raw = (param || "").trim();
  if (!raw) return null;
  return getMergedDisplayCategoryKey(raw.toUpperCase());
}

/**
 * Picks the providers for the category-scoped "Recommended" panel.
 *
 * Keeps the engine's existing order (allProviders arrives score-sorted, so
 * confirmed "Available at your address" matches are already on top) and stably
 * partitions recommendable providers (those with at least one match reason)
 * ahead of unscored directory entries, capped at `limit`. Empty/unknown
 * category → empty list (the page then falls back to the regular browse UI).
 */
export function getCategoryRecommendedProviders(
  allProviders: ScoredProvider[],
  categoryKey: string | null,
  limit: number = CATEGORY_RECOMMENDED_LIMIT,
): ScoredProvider[] {
  if (!categoryKey || limit <= 0) return [];
  const inCategory = allProviders.filter(
    (p) => getMergedDisplayCategoryKey(p.category) === categoryKey,
  );
  const recommendable = inCategory.filter((p) => (p.matchReasons?.length ?? 0) > 0);
  const rest = inCategory.filter((p) => (p.matchReasons?.length ?? 0) === 0);
  return [...recommendable, ...rest].slice(0, limit);
}

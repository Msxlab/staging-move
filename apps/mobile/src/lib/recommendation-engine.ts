import {
  buildRecommendationClusters,
  CATEGORY_META,
  getCategoryIcon,
  getCategoryLabel,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryKey,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryOrder,
  getRecommendedProviders,
  groupByMergedDisplayCategory,
  scoreProviders,
  type RecommendationCluster,
  type RecommendationExplanation,
  type RecommendationProvider as Provider,
  type RecommendationResult,
  type RecommendationUserProfile as UserProfile,
  type ScoredProvider,
  type UrgencyTier,
} from "@locateflow/shared";

/**
 * Mobile Recommendation Engine — Re-exports from shared package.
 * All scoring logic is now in @locateflow/shared/recommendation-engine.
 */
export {
  scoreProviders,
  getRecommendedProviders,
  buildRecommendationClusters,
  getCategoryLabel,
  getCategoryIcon,
  getMergedDisplayCategoryKey,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryOrder,
  groupByMergedDisplayCategory,
  CATEGORY_META,
  type UserProfile,
  type Provider,
  type ScoredProvider,
  type UrgencyTier,
  type RecommendationExplanation,
  type RecommendationCluster,
  type RecommendationResult,
};

export function getCategoryOrder(category: string): number {
  return CATEGORY_META[category]?.order ?? 99;
}

/**
 * Web Recommendation Engine — Re-exports from shared package.
 * All scoring logic is now in @locateflow/shared/recommendation-engine.
 */
export {
  scoreProviders,
  getRecommendedProviders,
  buildRecommendationClusters,
  getEssentialSetupCategories,
  getCategoryLabel,
  getCategoryIcon,
  getCategoryOrder,
  getMergedDisplayCategoryKey,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryOrder,
  getMergedDisplaySubcategoryLabel,
  groupByMergedDisplayCategory,
  CATEGORY_META,
  PROVIDER_CATEGORY_VALUES,
  PROVIDER_CATEGORY_OPTIONS,
  DEFAULT_SCORING_WEIGHTS,
  type ScoringWeights,
  type UserProfile,
  type Provider,
  type ScoredProvider,
  type UrgencyTier,
  type RecommendationExplanation,
  type RecommendationCluster,
  type RecommendationResult,
  type RecommendationContext,
  type RecommendationStateRuleContext,
} from "@locateflow/shared";

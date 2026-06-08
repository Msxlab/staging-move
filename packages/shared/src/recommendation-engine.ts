/**
 * Unified Smart Recommendation Engine (Shared across Web + Mobile)
 *
 * Scores and ranks providers using a 4-tier urgency system:
 *   CRITICAL   → Legal/financial consequence if skipped (utilities, USPS, IRS, DMV)
 *   IMPORTANT  → Major quality-of-life impact (insurance, bank, internet)
 *   RECOMMENDED → Profile-based personalized (vet, school, gym for matching profiles)
 *   OPTIONAL   → Nice-to-have (streaming, subscriptions, shopping)
 *
 * Scoring signals:
 *   1. Urgency tier weight (CRITICAL=100, IMPORTANT=60, RECOMMENDED=35, OPTIONAL=10)
 *   2. Essential category boost
 *   3. Phase-aware boost (what phase of the move is user in?)
 *   4. Profile tag matching (kids, pets, senior, car, disability, etc.)
 *   5. State-specific relevance
 *   6. Community popularity (optional external signal)
 *   7. Negative scoring for irrelevant providers
 */

import {
  getCoverageConfidencePresentation,
  isCoverageAddressSensitive,
  mapCoverageMatchToConfidence,
  type CoverageConfidence,
} from "./provider-move-domain";

// ── Types ────────────────────────────────────────────────────

export type UrgencyTier = "CRITICAL" | "IMPORTANT" | "RECOMMENDED" | "OPTIONAL";

export interface UserProfile {
  hasChildren: boolean;
  childrenCount: number;
  hasPets: boolean;
  hasSenior: boolean;
  carCount: number;
  hasDisability: boolean;
  needsStorage: boolean;
  hasMotorcycle: boolean;
  hasBoatRV: boolean;
  isMilitary?: boolean;
  /** Has an active/pending immigration matter (non-citizen) — steers USCIS / immigration-legal. */
  isImmigrant?: boolean;
  /** Relocating a business or self-employed — steers SBA / business-services. */
  isBusinessOwner?: boolean;
  currentPhase?: number;
  moveType?: string;
  daysUntilMove?: number;
  /** "RENT" | "OWN" | "OTHER" — drives renters vs home-insurance steering */
  ownership?: string;
  /**
   * The user's destination coordinates (from the selected/primary address).
   * Optional. When present alongside a geo-bearing provider's coordinates,
   * scoreProviders ranks nearer local providers higher via a deterministic
   * distance fold. Undefined coordinates simply skip the geo component.
   */
  latitude?: number | null;
  longitude?: number | null;
}

export interface Provider {
  id: string;
  name: string;
  slug?: string;
  category: string;
  subCategory?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  scope: string;
  states: string[];
  tags: string[];
  popularityScore: number;
  displayOrder?: number;
  userCount?: number;
  /** Whether this provider has an active affiliate offer (boolean only — the URL never leaves the click endpoint). */
  affiliateActive?: boolean;
  coverageModel?: "state" | "zip_prefix" | "polygon" | "live_address";
  coverageMatchLevel?: "available_at_address" | "exact" | "prefix" | "polygon" | "state" | "live_address";
  coverageNote?: string | null;
  coverageSourceUrl?: string | null;
  requiresAddressCheck?: boolean;
  requiresPolygonCheck?: boolean;
  /**
   * Set by an upstream authoritative address-level serviceability lookup
   * (e.g. the FCC National Broadband Map — see apps/web/src/lib/fcc-isp.ts).
   * When true, this provider is treated as AVAILABLE_AT_ADDRESS regardless of
   * the catalog-derived coverageMatchLevel, so confirmed-serviceable ISPs
   * surface with high confidence instead of "check availability". When the
   * FCC source is unavailable/unconfigured the field stays undefined and the
   * engine falls back to the existing catalog-based confidence — no crash.
   */
  fccServiceable?: boolean;
  /**
   * Representative geo coordinates for a GEO-BEARING local provider (e.g. the
   * centroid of its mapped service-area polygon, or a single physical location).
   * Optional: federal/national catalog providers and providers without mapped
   * geometry leave these undefined. When BOTH the provider and the user carry
   * finite coordinates, scoreProviders folds the great-circle distance into the
   * ranking so a nearer local provider outranks a farther one of equal standing.
   * The fold is deterministic and per-element, so it never breaks the
   * provably-transitive comparator.
   */
  latitude?: number | null;
  longitude?: number | null;
}

export interface RecommendationExplanation {
  urgencyTier: UrgencyTier;
  headline: string;
  reason: string;
  coverageConfidence: CoverageConfidence;
  coverageLabel: string;
  caveat?: string;
  manualConfirmationNote: string;
  recommendationUse: "MANUAL_TRACKING_CANDIDATE";
  deadline?: string;
  profileMatch?: string;
  communityNote?: string;
}

export interface ScoredProvider extends Provider {
  recommendationScore: number;
  urgencyTier: UrgencyTier;
  matchReasons: string[];
  explanation: RecommendationExplanation;
  /**
   * Coarse, deterministic distance bucket (lower = nearer) for geo-bearing
   * providers when the user has coordinates; a fixed sentinel otherwise. Stored
   * on the scored provider so the per-element sort key can break score ties by
   * proximity WITHOUT the comparator needing the user profile — keeping the
   * comparator a pure per-element field comparison (transitive by construction).
   */
  geoDistanceBucket: number;
}

export interface RecommendationCluster {
  tier: UrgencyTier;
  label: string;
  icon: string;
  color: string;
  description: string;
  providers: ScoredProvider[];
  completedCount: number;
  totalCount: number;
}

export interface RecommendationResult {
  clusters: RecommendationCluster[];
  allProviders: ScoredProvider[];
  nextCriticalActions: ScoredProvider[];
  stats: {
    total: number;
    critical: number;
    important: number;
    recommended: number;
    optional: number;
    completedCategories: string[];
    /**
     * Count of distinct CRITICAL provider categories the user has already
     * completed (i.e. dedup'd CRITICAL categories present in completedSet).
     * This is exactly the CRITICAL cluster's completedCount and EXCLUDES
     * optional/non-critical completed categories, so the dashboard readiness
     * ring is not inflated by gym/streaming completions.
     */
    completedCritical: number;
    missingCritical: string[];
  };
}

export interface RecommendationStateRuleContext {
  dmvRules?: string | null;
  voterRegistration?: string | null;
  taxInfo?: string | null;
}

export interface RecommendationContext {
  stateRule?: RecommendationStateRuleContext | null;
  /**
   * Optional scoring-weight overrides (e.g. sourced from RuntimeConfig for
   * deploy-free tuning / A-B tests). Only the provided keys are overridden;
   * everything else falls back to DEFAULT_SCORING_WEIGHTS.
   */
  weights?: Partial<ScoringWeights>;
}

const COVERAGE_SCORE_WEIGHT: Record<CoverageConfidence, number> = {
  AVAILABLE_AT_ADDRESS: 44,
  EXACT_ZIP: 36,
  ZIP_PREFIX: 28,
  MAPPED_SERVICE_AREA: 22,
  STATE_LEVEL: 8,
  NATIONAL_OR_FEDERAL: 2,
  ADDRESS_CHECK_REQUIRED: -8,
  UNKNOWN: -10,
};

const ADDRESS_SENSITIVE_COVERAGE_PENALTY: Partial<Record<CoverageConfidence, number>> = {
  STATE_LEVEL: -8,
  NATIONAL_OR_FEDERAL: -18,
  ADDRESS_CHECK_REQUIRED: -16,
  UNKNOWN: -20,
};

const MIN_RECOMMENDATION_SCORE = 20;
const ADDRESS_SENSITIVE_RECOMMENDABLE_COVERAGE = new Set<CoverageConfidence>([
  "AVAILABLE_AT_ADDRESS",
  "EXACT_ZIP",
  "ZIP_PREFIX",
  "MAPPED_SERVICE_AREA",
  "STATE_LEVEL",
  "ADDRESS_CHECK_REQUIRED",
]);

function getProviderCoverageConfidence(provider: Provider): CoverageConfidence {
  // An authoritative per-address serviceability confirmation (set by an
  // upstream FCC National Broadband Map lookup) wins over the catalog-derived
  // coverage tier. This is the only place the engine reads `fccServiceable`,
  // so when the FCC source is unavailable the field is simply undefined and
  // confidence falls back to the existing catalog logic.
  if (provider.fccServiceable === true) {
    return mapCoverageMatchToConfidence("available_at_address");
  }
  return mapCoverageMatchToConfidence(provider.coverageMatchLevel, {
    scope: provider.scope,
    coverageModel: provider.coverageModel,
    requiresAddressCheck: provider.requiresAddressCheck,
    requiresPolygonCheck: provider.requiresPolygonCheck,
  });
}

function hasRecommendableCoverage(provider: Provider): boolean {
  if (!isCoverageAddressSensitive(provider.category)) return true;
  return ADDRESS_SENSITIVE_RECOMMENDABLE_COVERAGE.has(getProviderCoverageConfidence(provider));
}

// ── Category Metadata ────────────────────────────────────────

export const CATEGORY_META: Record<string, { label: string; icon: string; order: number }> = {
  GOVERNMENT_POSTAL: { label: "Mail & Postal", icon: "📬", order: 1 },
  GOVERNMENT_TAX: { label: "Tax (IRS)", icon: "🧾", order: 2 },
  GOVERNMENT_DMV: { label: "DMV", icon: "🪪", order: 3 },
  GOVERNMENT_BENEFITS: { label: "Benefits", icon: "🏛️", order: 4 },
  GOVERNMENT_VOTER: { label: "Voter Registration", icon: "🗳️", order: 5 },
  GOVERNMENT_ID: { label: "Passport / ID", icon: "🪪", order: 6 },
  GOVERNMENT_HEALTH: { label: "Healthcare.gov", icon: "🏥", order: 7 },
  GOVERNMENT_EDUCATION: { label: "Education / FAFSA", icon: "🎓", order: 8 },
  EDUCATION_ONLINE: { label: "Online Learning", icon: "💻", order: 8.5 },
  GOVERNMENT_IMMIGRATION: { label: "Immigration", icon: "🌍", order: 9 },
  GOVERNMENT_HOUSING: { label: "Housing (HUD)", icon: "🏘️", order: 10 },
  GOVERNMENT_EMERGENCY: { label: "Emergency (FEMA)", icon: "🚨", order: 11 },
  GOVERNMENT_OTHER: { label: "Gov. Other", icon: "🏛️", order: 12 },
  UTILITY_ELECTRIC: { label: "Electric", icon: "⚡", order: 13 },
  UTILITY_GAS: { label: "Gas", icon: "🔥", order: 14 },
  UTILITY_WATER: { label: "Water", icon: "💧", order: 15 },
  UTILITY_INTERNET: { label: "Internet", icon: "🌐", order: 16 },
  UTILITY_PHONE: { label: "Phone", icon: "📱", order: 17 },
  UTILITY_CABLE: { label: "Cable / TV", icon: "📺", order: 18 },
  UTILITY_TRASH: { label: "Trash & Waste", icon: "🗑️", order: 19 },
  UTILITY_SEWER: { label: "Sewer", icon: "🚰", order: 20 },
  FINANCIAL_BANK: { label: "Banks", icon: "🏦", order: 21 },
  FINANCIAL_CREDIT_CARD: { label: "Credit Cards", icon: "💳", order: 22 },
  FINANCIAL_FINTECH: { label: "Payment Apps", icon: "💸", order: 22.5 },
  FINANCIAL_INSURANCE_AUTO: { label: "Auto Insurance", icon: "🚗", order: 23 },
  FINANCIAL_INSURANCE_HOME: { label: "Home Insurance", icon: "🏠", order: 24 },
  FINANCIAL_INSURANCE_RENTERS: { label: "Renters Insurance", icon: "🔑", order: 24.5 },
  FINANCIAL_INSURANCE_HEALTH: { label: "Health Insurance", icon: "🏥", order: 25 },
  FINANCIAL_MORTGAGE: { label: "Mortgage", icon: "🔑", order: 26 },
  FINANCIAL_LOAN: { label: "Loans", icon: "💰", order: 27 },
  FINANCIAL_INSURANCE_PET: { label: "Pet Insurance", icon: "🐾", order: 28 },
  FINANCIAL_INSURANCE_MOTORCYCLE: { label: "Motorcycle Ins.", icon: "🏍️", order: 29 },
  FINANCIAL_INSURANCE_BOAT: { label: "Boat Insurance", icon: "⛵", order: 30 },
  FINANCIAL_INSURANCE_RV: { label: "RV Insurance", icon: "🚐", order: 31 },
  FINANCIAL_INSURANCE_LIFE: { label: "Life Insurance", icon: "🛡️", order: 32 },
  FINANCIAL_INSURANCE_FLOOD: { label: "Flood Insurance", icon: "🌊", order: 33 },
  HOUSING_RENT: { label: "Rent / Mortgage", icon: "🏘️", order: 34 },
  HOUSING_MOVING: { label: "Moving", icon: "🚚", order: 35 },
  HOUSING_REAL_ESTATE: { label: "Real Estate", icon: "🏡", order: 36 },
  HOUSING_HOME_SERVICE: { label: "Home Services", icon: "🔧", order: 37 },
  HOUSING_STORAGE: { label: "Storage", icon: "📦", order: 38 },
  HOUSING_HOA: { label: "HOA", icon: "🏢", order: 39 },
  HOUSING_LAWN_CARE: { label: "Lawn Care", icon: "🌿", order: 40 },
  HOUSING_PEST_CONTROL: { label: "Pest Control", icon: "🐛", order: 41 },
  HOUSING_CLEANING: { label: "Cleaning", icon: "🧹", order: 42 },
  HOUSING_SECURITY: { label: "Home Security", icon: "🔒", order: 43 },
  SECURITY_IDENTITY: { label: "Identity Protection", icon: "🛡️", order: 43.5 },
  HEALTHCARE_DOCTORS: { label: "Doctors", icon: "🩺", order: 44 },
  HEALTHCARE_TELEMEDICINE: { label: "Telemedicine", icon: "💻", order: 44.5 },
  HEALTHCARE_DENTIST: { label: "Dentist", icon: "🦷", order: 45 },
  HEALTHCARE_PHARMACY: { label: "Pharmacy", icon: "💊", order: 46 },
  HEALTHCARE_VET: { label: "Veterinary", icon: "🐾", order: 47 },
  HEALTHCARE_SENIOR: { label: "Senior Care", icon: "👴", order: 48 },
  TRANSPORTATION_AUTO: { label: "Auto Services", icon: "🔧", order: 49 },
  TRANSPORTATION_TOLL: { label: "Toll Pass", icon: "🛣️", order: 50 },
  TRANSPORTATION_TRANSIT: { label: "Transit", icon: "🚌", order: 51 },
  TRANSPORTATION_PARKING: { label: "Parking", icon: "🅿️", order: 52 },
  TRANSPORTATION_RIDESHARE: { label: "Rideshare", icon: "🚕", order: 52.3 },
  TRANSPORTATION_OTHER: { label: "Car Rental & Other", icon: "🚗", order: 52.5 },
  KIDS_SCHOOL: { label: "Schools", icon: "🏫", order: 53 },
  KIDS_DAYCARE: { label: "Daycare", icon: "👶", order: 54 },
  KIDS_ACTIVITY: { label: "Kids Activities", icon: "🎨", order: 55 },
  FITNESS_GYM: { label: "Fitness & Gym", icon: "💪", order: 56 },
  FITNESS_STUDIO: { label: "Studio", icon: "🧘", order: 57 },
  SHOPPING_SUBSCRIPTION: { label: "Subscriptions", icon: "📦", order: 58 },
  SHOPPING_RETAIL: { label: "Shopping", icon: "🛒", order: 59 },
  GROCERY_DELIVERY: { label: "Grocery Delivery", icon: "🛒", order: 60 },
  LOCAL_DINING: { label: "Dining & Food", icon: "🍽️", order: 60.5 },
  PET_SERVICES: { label: "Pet Services", icon: "🐕", order: 61 },
  LEGAL_SERVICES: { label: "Legal", icon: "⚖️", order: 62 },
};

export const PROVIDER_CATEGORY_VALUES = [
  "GOVERNMENT_POSTAL",
  "GOVERNMENT_TAX",
  "GOVERNMENT_DMV",
  "GOVERNMENT_BENEFITS",
  "GOVERNMENT_VOTER",
  "GOVERNMENT_ID",
  "GOVERNMENT_HEALTH",
  "GOVERNMENT_EDUCATION",
  "EDUCATION_ONLINE",
  "GOVERNMENT_IMMIGRATION",
  "GOVERNMENT_HOUSING",
  "GOVERNMENT_EMERGENCY",
  "GOVERNMENT_OTHER",
  "UTILITY_ELECTRIC",
  "UTILITY_GAS",
  "UTILITY_WATER",
  "UTILITY_INTERNET",
  "UTILITY_PHONE",
  "UTILITY_CABLE",
  "UTILITY_TRASH",
  "UTILITY_SEWER",
  "FINANCIAL_BANK",
  "FINANCIAL_CREDIT_CARD",
  "FINANCIAL_FINTECH",
  "FINANCIAL_INSURANCE_AUTO",
  "FINANCIAL_INSURANCE_HOME",
  "FINANCIAL_INSURANCE_RENTERS",
  "FINANCIAL_INSURANCE_HEALTH",
  "FINANCIAL_MORTGAGE",
  "FINANCIAL_LOAN",
  "FINANCIAL_INSURANCE_PET",
  "FINANCIAL_INSURANCE_MOTORCYCLE",
  "FINANCIAL_INSURANCE_BOAT",
  "FINANCIAL_INSURANCE_RV",
  "FINANCIAL_INSURANCE_LIFE",
  "FINANCIAL_INSURANCE_FLOOD",
  "HOUSING_RENT",
  "HOUSING_MOVING",
  "HOUSING_REAL_ESTATE",
  "HOUSING_HOME_SERVICE",
  "HOUSING_STORAGE",
  "HOUSING_HOA",
  "HOUSING_LAWN_CARE",
  "HOUSING_PEST_CONTROL",
  "HOUSING_CLEANING",
  "HOUSING_SECURITY",
  "SECURITY_IDENTITY",
  "HEALTHCARE_DOCTORS",
  "HEALTHCARE_TELEMEDICINE",
  "HEALTHCARE_DENTIST",
  "HEALTHCARE_PHARMACY",
  "HEALTHCARE_VET",
  "HEALTHCARE_SENIOR",
  "TRANSPORTATION_AUTO",
  "TRANSPORTATION_TOLL",
  "TRANSPORTATION_TRANSIT",
  "TRANSPORTATION_PARKING",
  "TRANSPORTATION_RIDESHARE",
  "TRANSPORTATION_OTHER",
  "KIDS_SCHOOL",
  "KIDS_DAYCARE",
  "KIDS_ACTIVITY",
  "FITNESS_GYM",
  "FITNESS_STUDIO",
  "SHOPPING_SUBSCRIPTION",
  "SHOPPING_RETAIL",
  "GROCERY_DELIVERY",
  "LOCAL_DINING",
  "PET_SERVICES",
  "LEGAL_SERVICES",
] as const;

export const PROVIDER_CATEGORY_OPTIONS = PROVIDER_CATEGORY_VALUES.map((value) => ({
  value,
  label: CATEGORY_META[value]?.label || value,
  icon: CATEGORY_META[value]?.icon || "📋",
  order: CATEGORY_META[value]?.order ?? 999,
}));

const MERGED_DISPLAY_CATEGORY_KEY = "FINANCIAL";
const MERGED_DISPLAY_CATEGORY_META: Record<string, { label: string; icon: string; order: number }> = {
  [MERGED_DISPLAY_CATEGORY_KEY]: { label: "Financial", icon: "$", order: 21 },
};
const MERGED_DISPLAY_CATEGORY_ALIASES: Record<string, string> = {
  FINANCIAL_BANK: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_CREDIT_CARD: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_FINTECH: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_AUTO: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_HOME: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_RENTERS: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_HEALTH: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_MORTGAGE: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_LOAN: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_PET: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_MOTORCYCLE: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_BOAT: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_RV: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_LIFE: MERGED_DISPLAY_CATEGORY_KEY,
  FINANCIAL_INSURANCE_FLOOD: MERGED_DISPLAY_CATEGORY_KEY,
};

export function getMergedDisplayCategoryKey(category: string): string {
  return MERGED_DISPLAY_CATEGORY_ALIASES[category] || category;
}

export function getMergedDisplayCategoryOrder(category: string): number {
  const key = getMergedDisplayCategoryKey(category);
  return MERGED_DISPLAY_CATEGORY_META[key]?.order ?? getCategoryOrder(key);
}

export function getMergedDisplayCategoryLabel(category: string): string {
  const key = getMergedDisplayCategoryKey(category);
  return MERGED_DISPLAY_CATEGORY_META[key]?.label ?? getCategoryLabel(key);
}

export function getMergedDisplayCategoryIcon(category: string): string {
  const key = getMergedDisplayCategoryKey(category);
  return MERGED_DISPLAY_CATEGORY_META[key]?.icon ?? getCategoryIcon(key);
}

export function getMergedDisplaySubcategoryLabel(category: string): string | null {
  return getMergedDisplayCategoryKey(category) === category ? null : getCategoryLabel(category);
}

export function groupByMergedDisplayCategory<T extends { category: string }>(items: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const key = getMergedDisplayCategoryKey(item.category);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  return grouped;
}

// ── Urgency Tier Assignment ──────────────────────────────────

// CRITICAL: Without this, you can't legally live at new address or face penalties
const CRITICAL_CATEGORIES = new Set([
  "GOVERNMENT_POSTAL", "GOVERNMENT_TAX", "GOVERNMENT_DMV", "GOVERNMENT_IMMIGRATION",
  "GOVERNMENT_ID", "UTILITY_ELECTRIC", "UTILITY_WATER", "UTILITY_GAS",
  "FINANCIAL_INSURANCE_HOME", "FINANCIAL_INSURANCE_RENTERS", "FINANCIAL_INSURANCE_AUTO",
]);

// IMPORTANT: Major quality-of-life, should be done within first 30 days
const IMPORTANT_CATEGORIES = new Set([
  "GOVERNMENT_BENEFITS", "GOVERNMENT_VOTER", "GOVERNMENT_HEALTH",
  "UTILITY_INTERNET", "UTILITY_PHONE", "UTILITY_TRASH", "UTILITY_SEWER",
  "FINANCIAL_BANK", "FINANCIAL_FINTECH", "FINANCIAL_INSURANCE_HEALTH", "FINANCIAL_MORTGAGE",
  "HEALTHCARE_DOCTORS", "HEALTHCARE_TELEMEDICINE", "HEALTHCARE_PHARMACY", "HEALTHCARE_DENTIST",
  "KIDS_SCHOOL", "KIDS_DAYCARE", "TRANSPORTATION_TOLL",
  "HOUSING_SECURITY", "HOUSING_MOVING",
]);

// RECOMMENDED: Profile-dependent, good to have
const RECOMMENDED_CATEGORIES = new Set([
  "FINANCIAL_CREDIT_CARD", "FINANCIAL_LOAN", "FINANCIAL_INSURANCE_LIFE",
  "FINANCIAL_INSURANCE_PET", "FINANCIAL_INSURANCE_MOTORCYCLE", "FINANCIAL_INSURANCE_BOAT",
  "FINANCIAL_INSURANCE_FLOOD", "HEALTHCARE_VET", "HEALTHCARE_SENIOR",
  "TRANSPORTATION_TRANSIT", "TRANSPORTATION_AUTO", "TRANSPORTATION_PARKING",
  "HOUSING_HOA", "HOUSING_LAWN_CARE", "HOUSING_PEST_CONTROL", "HOUSING_CLEANING",
  "HOUSING_HOME_SERVICE", "HOUSING_STORAGE", "HOUSING_REAL_ESTATE",
  "KIDS_ACTIVITY", "FITNESS_GYM", "FITNESS_STUDIO",
  "GROCERY_DELIVERY", "PET_SERVICES", "LEGAL_SERVICES",
  "GOVERNMENT_EDUCATION", "GOVERNMENT_HOUSING", "GOVERNMENT_EMERGENCY",
]);

// Everything else → OPTIONAL

const URGENCY_TIER_WEIGHT: Record<UrgencyTier, number> = {
  CRITICAL: 100,
  IMPORTANT: 60,
  RECOMMENDED: 35,
  OPTIONAL: 10,
};

const URGENCY_TIER_META: Record<UrgencyTier, { label: string; icon: string; color: string; description: string }> = {
  CRITICAL: { label: "Must Do This Week", icon: "🔴", color: "#ef4444", description: "Without these, you may face legal issues or can't live at your new address" },
  IMPORTANT: { label: "First 30 Days", icon: "🟠", color: "#f59e0b", description: "Major quality-of-life services — set these up soon" },
  RECOMMENDED: { label: "Personalized For You", icon: "🟡", color: "#3b82f6", description: "Based on your profile and needs" },
  OPTIONAL: { label: "Nice to Have", icon: "⚪", color: "#6b7280", description: "Optional services you might want" },
};

// Categories whose urgency depends on profile relevance. When the predicate is
// false, the category is demoted to OPTIONAL so it doesn't crowd the high-urgency
// clusters — a car-less renter shouldn't see auto insurance under "Must Do This
// Week", nor a childless mover see school enrollment under "First 30 Days".
// Predicates return true when the category is RELEVANT to the profile.
// NOTE: GOVERNMENT_DMV is intentionally NOT gated on carCount — the DMV also
// handles state ID / license transfers that apply regardless of vehicle ownership.
// Predicates that read `ownership` only demote when ownership is known; an
// undefined ownership leaves both home/renters guidance at full urgency.
const TIER_RELEVANCE_GATE: Record<string, (p: UserProfile) => boolean> = {
  FINANCIAL_INSURANCE_AUTO: (p) => p.carCount > 0,
  TRANSPORTATION_TOLL: (p) => p.carCount > 0,
  TRANSPORTATION_AUTO: (p) => p.carCount > 0,
  TRANSPORTATION_PARKING: (p) => p.carCount > 0,
  KIDS_SCHOOL: (p) => p.hasChildren,
  KIDS_DAYCARE: (p) => p.hasChildren,
  KIDS_ACTIVITY: (p) => p.hasChildren,
  HEALTHCARE_VET: (p) => p.hasPets,
  FINANCIAL_INSURANCE_PET: (p) => p.hasPets,
  PET_SERVICES: (p) => p.hasPets,
  HEALTHCARE_SENIOR: (p) => p.hasSenior,
  FINANCIAL_INSURANCE_MOTORCYCLE: (p) => p.hasMotorcycle,
  FINANCIAL_INSURANCE_BOAT: (p) => p.hasBoatRV,
  FINANCIAL_INSURANCE_RV: (p) => p.hasBoatRV,
  HOUSING_STORAGE: (p) => p.needsStorage,
  FINANCIAL_INSURANCE_HOME: (p) => p.ownership !== "RENT",
  FINANCIAL_MORTGAGE: (p) => p.ownership !== "RENT",
  FINANCIAL_INSURANCE_RENTERS: (p) => p.ownership !== "OWN",
};

function getBaseUrgencyTier(category: string): UrgencyTier {
  if (CRITICAL_CATEGORIES.has(category)) return "CRITICAL";
  if (IMPORTANT_CATEGORIES.has(category)) return "IMPORTANT";
  if (RECOMMENDED_CATEGORIES.has(category)) return "RECOMMENDED";
  return "OPTIONAL";
}

function getUrgencyTier(category: string, profile: UserProfile): UrgencyTier {
  const baseTier = getBaseUrgencyTier(category);
  const gate = TIER_RELEVANCE_GATE[category];
  if (gate && !gate(profile)) return "OPTIONAL";
  return baseTier;
}

// ── Category Deadlines ───────────────────────────────────────

const CATEGORY_DEADLINES: Record<string, string> = {
  GOVERNMENT_DMV: "Most states require within 30-90 days of moving",
  GOVERNMENT_POSTAL: "Set up 2 weeks before your move",
  GOVERNMENT_TAX: "Update before next tax filing season",
  GOVERNMENT_VOTER: "Must register before election deadlines",
  GOVERNMENT_IMMIGRATION: "USCIS AR-11 required within 10 days of move",
  UTILITY_ELECTRIC: "Must be active on move-in day",
  UTILITY_WATER: "Must be active on move-in day",
  UTILITY_GAS: "Must be active on move-in day (if applicable)",
  FINANCIAL_INSURANCE_HOME: "Coverage must start from day 1 at new address",
  FINANCIAL_INSURANCE_AUTO: "Update within 30 days to maintain coverage",
  FINANCIAL_INSURANCE_HEALTH: "Moving is a qualifying life event — 60 day window",
  KIDS_SCHOOL: "Enroll before school year starts",
};

// ── Urgency Headlines ────────────────────────────────────────

const URGENCY_HEADLINES: Record<string, string> = {
  UTILITY_ELECTRIC: "⚡ No power = no livable home",
  UTILITY_WATER: "💧 Water is essential from day one",
  UTILITY_GAS: "🔥 Heating/cooking may depend on this",
  GOVERNMENT_POSTAL: "📬 Your mail won't follow you automatically",
  GOVERNMENT_DMV: "🪪 Driving with wrong state license is illegal",
  GOVERNMENT_TAX: "🧾 IRS needs your current address",
  GOVERNMENT_IMMIGRATION: "🌍 AR-11 is legally required within 10 days",
  FINANCIAL_INSURANCE_HOME: "🏠 Uninsured = financially exposed",
  FINANCIAL_INSURANCE_AUTO: "🚗 Lapsed coverage = illegal to drive",
  FINANCIAL_INSURANCE_HEALTH: "🏥 Don't miss the 60-day qualifying event window",
  FINANCIAL_BANK: "🏦 Update address for statements and fraud alerts",
  UTILITY_INTERNET: "🌐 Work-from-home? This is critical",
  KIDS_SCHOOL: "🏫 Enrollment deadlines are strict",
  HEALTHCARE_VET: "🐾 Some states require pet health certificates",
};

// ── Essential Category Weights ───────────────────────────────

const ESSENTIAL_CATEGORIES: Record<string, number> = {
  GOVERNMENT_POSTAL: 50, GOVERNMENT_TAX: 45, GOVERNMENT_IMMIGRATION: 40,
  GOVERNMENT_BENEFITS: 38, GOVERNMENT_DMV: 42, GOVERNMENT_VOTER: 30,
  GOVERNMENT_ID: 35, GOVERNMENT_HEALTH: 35,
  UTILITY_ELECTRIC: 48, UTILITY_WATER: 45, UTILITY_GAS: 40,
  UTILITY_INTERNET: 42, UTILITY_PHONE: 35, UTILITY_TRASH: 28, UTILITY_SEWER: 25,
  FINANCIAL_BANK: 40, FINANCIAL_CREDIT_CARD: 30,
  FINANCIAL_INSURANCE_AUTO: 35, FINANCIAL_INSURANCE_HEALTH: 42,
  FINANCIAL_INSURANCE_HOME: 35, FINANCIAL_MORTGAGE: 30,
  TRANSPORTATION_TOLL: 25, TRANSPORTATION_TRANSIT: 22,
  HOUSING_SECURITY: 28, HOUSING_MOVING: 35,
  GROCERY_DELIVERY: 15, HOUSING_CLEANING: 12,
};

// ── Tunable Scoring Weights ──────────────────────────────────
// Bundles the magic-number tables that drive scoring so they can be overridden
// at runtime (RuntimeConfig) without a deploy. scoreProviders merges any
// provided overrides over these defaults — passing none reproduces the
// hardcoded behaviour exactly.

export interface ScoringWeights {
  urgencyTier: Record<UrgencyTier, number>;
  coverageScore: Record<CoverageConfidence, number>;
  addressSensitivePenalty: Partial<Record<CoverageConfidence, number>>;
  essentialCategories: Record<string, number>;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  urgencyTier: URGENCY_TIER_WEIGHT,
  coverageScore: COVERAGE_SCORE_WEIGHT,
  addressSensitivePenalty: ADDRESS_SENSITIVE_COVERAGE_PENALTY,
  essentialCategories: ESSENTIAL_CATEGORIES,
};

function resolveScoringWeights(overrides?: Partial<ScoringWeights>): ScoringWeights {
  if (!overrides) return DEFAULT_SCORING_WEIGHTS;
  return {
    urgencyTier: { ...URGENCY_TIER_WEIGHT, ...overrides.urgencyTier },
    coverageScore: { ...COVERAGE_SCORE_WEIGHT, ...overrides.coverageScore },
    addressSensitivePenalty: { ...ADDRESS_SENSITIVE_COVERAGE_PENALTY, ...overrides.addressSensitivePenalty },
    essentialCategories: { ...ESSENTIAL_CATEGORIES, ...overrides.essentialCategories },
  };
}

// ── Tag → Profile Match ─────────────────────────────────────

const TAG_PROFILE_MAP: Record<string, (p: UserProfile) => { match: boolean; reason: string; weight: number }> = {
  kids: (p) => ({ match: p.hasChildren, reason: `You have ${p.childrenCount} child${p.childrenCount !== 1 ? "ren" : ""}`, weight: 20 }),
  children: (p) => ({ match: p.hasChildren, reason: "Recommended for families with children", weight: 18 }),
  education: (p) => ({ match: p.hasChildren, reason: "Education services for your kids", weight: 15 }),
  daycare: (p) => ({ match: p.hasChildren && p.childrenCount > 0, reason: "Childcare for your family", weight: 20 }),
  pet: (p) => ({ match: p.hasPets, reason: "You have pets", weight: 20 }),
  dog: (p) => ({ match: p.hasPets, reason: "Pet care services", weight: 18 }),
  cat: (p) => ({ match: p.hasPets, reason: "Pet care services", weight: 18 }),
  vet: (p) => ({ match: p.hasPets, reason: "Veterinary care for your pets", weight: 22 }),
  senior: (p) => ({ match: p.hasSenior, reason: "Senior in your household", weight: 20 }),
  medicare: (p) => ({ match: p.hasSenior, reason: "Medicare-related services", weight: 22 }),
  immigration: (p) => ({ match: p.isImmigrant || false, reason: "Immigration services for your move", weight: 22 }),
  visa: (p) => ({ match: p.isImmigrant || false, reason: "Visa / immigration status support", weight: 20 }),
  business: (p) => ({ match: p.isBusinessOwner || false, reason: "Business relocation services", weight: 20 }),
  car: (p) => ({ match: p.carCount > 0, reason: `You have ${p.carCount} car${p.carCount !== 1 ? "s" : ""}`, weight: 15 }),
  auto: (p) => ({ match: p.carCount > 0, reason: "Auto-related service", weight: 15 }),
  driving: (p) => ({ match: p.carCount > 0, reason: "Driving-related service", weight: 12 }),
  toll: (p) => ({ match: p.carCount > 0, reason: "Toll pass for your vehicle", weight: 18 }),
  storage: (p) => ({ match: p.needsStorage, reason: "Storage for your move", weight: 20 }),
  motorcycle: (p) => ({ match: p.hasMotorcycle, reason: "You have a motorcycle", weight: 18 }),
  boat: (p) => ({ match: p.hasBoatRV, reason: "You have a boat or RV", weight: 18 }),
  rv: (p) => ({ match: p.hasBoatRV, reason: "RV-related service", weight: 16 }),
  disability: (p) => ({ match: p.hasDisability, reason: "Accessibility services", weight: 20 }),
  essential: () => ({ match: true, reason: "Essential government service", weight: 10 }),
  government: () => ({ match: true, reason: "Government service", weight: 5 }),
  dmv: (p) => ({ match: p.carCount > 0, reason: "DMV for your vehicle registration", weight: 18 }),
  military: (p) => ({ match: p.isMilitary || false, reason: "Military benefit", weight: 20 }),
  veteran: (p) => ({ match: p.isMilitary || false, reason: "Veteran benefit", weight: 20 }),
  identity: () => ({ match: true, reason: "Identity protection", weight: 12 }),
  security: () => ({ match: true, reason: "Home security", weight: 10 }),
  dental: () => ({ match: true, reason: "Dental coverage", weight: 10 }),
  vision: () => ({ match: true, reason: "Vision coverage", weight: 10 }),
  investment: () => ({ match: true, reason: "Investment services", weight: 8 }),
  online: () => ({ match: true, reason: "Online service", weight: 5 }),
  grocery: () => ({ match: true, reason: "Grocery & food delivery", weight: 8 }),
  cleaning: () => ({ match: true, reason: "Home cleaning service", weight: 6 }),
  moving: () => ({ match: true, reason: "Moving service", weight: 15 }),
  legal: () => ({ match: true, reason: "Legal services", weight: 8 }),
  alarm: () => ({ match: true, reason: "Home security system", weight: 10 }),
};

// ── Phase Boost ──────────────────────────────────────────────

const PHASE_CATEGORY_BOOST: Record<number, Record<string, number>> = {
  0: { GOVERNMENT_POSTAL: 30, KIDS_SCHOOL: 20, HOUSING_STORAGE: 15, HEALTHCARE_VET: 10, HOUSING_MOVING: 25 },
  1: { UTILITY_ELECTRIC: 30, UTILITY_WATER: 25, UTILITY_GAS: 20, UTILITY_INTERNET: 25, FINANCIAL_INSURANCE_HOME: 20, HOUSING_SECURITY: 15 },
  2: { GOVERNMENT_TAX: 25, FINANCIAL_BANK: 20, GOVERNMENT_IMMIGRATION: 30, GOVERNMENT_BENEFITS: 15 },
  3: { GOVERNMENT_DMV: 30, FINANCIAL_INSURANCE_AUTO: 25, FINANCIAL_INSURANCE_HEALTH: 30, GOVERNMENT_VOTER: 15 },
  4: { HEALTHCARE_DOCTORS: 20, HEALTHCARE_PHARMACY: 15, KIDS_SCHOOL: 25, HEALTHCARE_DENTIST: 10, FITNESS_GYM: 8 },
  5: { HOUSING_HOME_SERVICE: 15, HOUSING_HOA: 10, HOUSING_LAWN_CARE: 8, HOUSING_PEST_CONTROL: 8, HOUSING_CLEANING: 10 },
};

// ── Geo Distance (true local ranking) ────────────────────────
// "Local" relevance used to be binary (state membership / ZIP prefix). For a
// geo-BEARING provider — one that carries representative coordinates (e.g. the
// centroid of its mapped service-area polygon) — and a user with known
// coordinates, we can do better: rank the genuinely-nearer provider higher.
//
// CRITICAL CONSTRAINT: the ranking comparator must stay a provably-transitive
// strict total order. We therefore NEVER compare distance pairwise. Instead we
// fold each provider's distance into a small, monotonic, per-element score
// adjustment (and a coarse per-element distance bucket carried in the sort key).
// Both are pure functions of the single provider, so the comparator remains a
// per-element field comparison — transitivity is preserved by construction.

const GEO_DISTANCE_MAX_BONUS = 12; // points added to a provider AT the user
const GEO_DISTANCE_FALLOFF_KM = 80; // distance at which the bonus decays to ~0

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Great-circle distance in km (haversine). Pure; deterministic. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // mean Earth radius, km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Distance in km between a user and a geo-bearing provider, or null when either
 * side lacks finite coordinates. A pure function of the two points.
 */
function providerDistanceKm(provider: Provider, profile: UserProfile): number | null {
  if (
    !isFiniteNumber(provider.latitude) ||
    !isFiniteNumber(provider.longitude) ||
    !isFiniteNumber(profile.latitude) ||
    !isFiniteNumber(profile.longitude)
  ) {
    return null;
  }
  return haversineKm(profile.latitude, profile.longitude, provider.latitude, provider.longitude);
}

/**
 * Monotonic, non-negative distance bonus: maxes out for a provider AT the
 * user's location and decays smoothly toward 0 by GEO_DISTANCE_FALLOFF_KM.
 * Returns 0 when distance is unknown so non-geo providers are unaffected.
 * Folding this into the additive score is order-independent (the score is a
 * per-element accumulator), so it does not affect comparator transitivity.
 */
function geoDistanceBonus(distanceKm: number | null): number {
  if (distanceKm === null) return 0;
  if (distanceKm <= 0) return GEO_DISTANCE_MAX_BONUS;
  const decayed = GEO_DISTANCE_MAX_BONUS * (1 - distanceKm / GEO_DISTANCE_FALLOFF_KM);
  return Math.max(0, decayed);
}

/**
 * Coarse, deterministic distance bucket used as a per-element tiebreaker in the
 * sort key (lower = nearer = ranks first). Providers without a known distance
 * get a fixed sentinel so they sort AFTER geo-located ones only at equal score,
 * never reordering non-geo providers among themselves. Buckets (rather than raw
 * float distance) keep the key stable against tiny floating-point jitter.
 */
const GEO_BUCKET_KM = 5; // ~5km granularity
const GEO_DISTANCE_BUCKET_SENTINEL = Number.MAX_SAFE_INTEGER;

function geoDistanceBucket(distanceKm: number | null): number {
  if (distanceKm === null) return GEO_DISTANCE_BUCKET_SENTINEL;
  return Math.floor(Math.max(0, distanceKm) / GEO_BUCKET_KM);
}

// ── Community Popularity Keying (robust) ─────────────────────
// The community-popularity map is produced upstream by aggregating adopted
// providers (apps/web/src/lib/community-popularity.ts groups Service rows by
// `providerId`), so the map is ALWAYS keyed by the provider's `id`. The previous
// lookup used a `map[id] || map[slug] || 0` chain whose slug fallback is the
// fragile part the audit flagged:
//   • Cross-namespace borrow: when a provider's `id` is absent, the chain reads
//     `map[slug]`. A slug that happens to equal a *different* provider's id then
//     silently borrows that other provider's popularity — a key collision bug.
//   • `|| 0` stops at the first *truthy* value, so a legitimate id-keyed 0 still
//     falls through to the slug branch.
// Since every real producer keys by id, the robust fix is to read the id key
// ONLY (no slug fallback, so no foreign-namespace read), via an own-property
// check so an explicit 0 is honoured, and to ignore non-finite/negative values.
function lookupCommunityPopularity(
  communityPopular: Record<string, number> | undefined,
  provider: Provider,
): number {
  if (!communityPopular) return 0;
  if (!Object.prototype.hasOwnProperty.call(communityPopular, provider.id)) return 0;
  const raw = communityPopular[provider.id];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
}

// ── Core Scoring Function ────────────────────────────────────

export function scoreProviders(
  providers: Provider[],
  profile: UserProfile,
  userState: string,
  communityPopular?: Record<string, number>,
  existingServiceNames?: Set<string>,
  context?: RecommendationContext,
): ScoredProvider[] {
  const weights = resolveScoringWeights(context?.weights);
  return providers
    .map((provider) => {
      let score = 0;
      const reasons: string[] = [];
      const tags = provider.tags || [];
      const addressSensitive = isCoverageAddressSensitive(provider.category);
      const coverageConfidence = getProviderCoverageConfidence(provider);
      const coveragePresentation = getCoverageConfidencePresentation(coverageConfidence);

      // 0. Urgency tier (primary sort signal)
      const urgencyTier = getUrgencyTier(provider.category, profile);
      score += weights.urgencyTier[urgencyTier];

      // 1. Base popularity (0-100 → 0-30 points)
      score += ((provider.popularityScore || 0) / 100) * 30;

      // 2. Essential category boost
      const essentialBoost = weights.essentialCategories[provider.category] || 0;
      if (essentialBoost > 0) {
        score += essentialBoost;
        if (essentialBoost >= 25) reasons.push("Essential service");
      }

      // 3. Phase-aware boost
      if (profile.currentPhase !== undefined && profile.currentPhase >= 0) {
        const phaseBoosts = PHASE_CATEGORY_BOOST[profile.currentPhase];
        if (phaseBoosts) {
          const phaseBoost = phaseBoosts[provider.category] || 0;
          if (phaseBoost > 0) {
            score += phaseBoost;
            reasons.push("Needed this phase");
          }
        }
      }

      // 4. State-specific boost
      if (provider.scope === "STATE" && provider.states?.includes(userState)) {
        score += addressSensitive ? 4 : 15;
        reasons.push(
          addressSensitive
            ? `Listed in ${userState}; confirm address availability`
            : `Listed in ${userState}`,
        );
      }

      const coverageScore =
        weights.coverageScore[coverageConfidence] +
        (addressSensitive ? weights.addressSensitivePenalty[coverageConfidence] || 0 : 0);
      score += coverageScore;

      if (coverageConfidence === "AVAILABLE_AT_ADDRESS") {
        reasons.unshift("Available at your address");
      } else if (coverageConfidence === "EXACT_ZIP") {
        reasons.push("Exact ZIP match");
      } else if (coverageConfidence === "ZIP_PREFIX") {
        reasons.push("Local ZIP-area match");
      } else if (coverageConfidence === "MAPPED_SERVICE_AREA") {
        reasons.push("Mapped service-area match");
      } else if (coverageConfidence === "STATE_LEVEL" && addressSensitive) {
        reasons.push("State-level listing; confirm service territory");
      } else if (coverageConfidence === "NATIONAL_OR_FEDERAL" && addressSensitive) {
        reasons.push("National listing; confirm destination availability");
      } else if (coverageConfidence === "ADDRESS_CHECK_REQUIRED") {
        reasons.push("Confirm availability by address");
      } else if (coverageConfidence === "UNKNOWN") {
        reasons.push("Coverage unverified");
      }

      if (addressSensitive && coveragePresentation.requiresCaveat) {
        reasons.push("Availability may vary by address");
      }

      // 4b. Ownership-aware steering: renters vs homeowners insurance
      if (profile.ownership === "RENT") {
        if (provider.category === "FINANCIAL_INSURANCE_RENTERS") {
          score += 20;
          reasons.unshift("You're renting — renters insurance is required");
        } else if (provider.category === "FINANCIAL_INSURANCE_HOME") {
          score -= 25;
        } else if (provider.category === "FINANCIAL_MORTGAGE") {
          score -= 30;
        }
      } else if (profile.ownership === "OWN") {
        if (provider.category === "FINANCIAL_INSURANCE_HOME") {
          score += 15;
          reasons.unshift("You own — keep homeowners insurance active");
        } else if (provider.category === "FINANCIAL_INSURANCE_RENTERS") {
          score -= 30;
        }
      }

      // 4c. Onboarding-signal category steering. Several rich onboarding signals
      // map to whole provider categories rather than individual provider tags, so
      // we boost the relevant categories here even when a specific provider in the
      // category lacks the matching tag. Boost-on-presence mirrors the ownership
      // block above; absence is handled by the negative-scoring pass below so a
      // non-matching profile doesn't see these crowd the personalized tier.
      if (profile.isMilitary) {
        if (provider.category === "GOVERNMENT_BENEFITS" || provider.category === "GOVERNMENT_HEALTH") {
          score += 18;
          if (!reasons.includes("Military / veteran benefit")) reasons.unshift("Military / veteran benefit");
        }
      }
      if (profile.isImmigrant) {
        if (provider.category === "GOVERNMENT_IMMIGRATION") {
          score += 22;
          reasons.unshift("Immigration services for your move");
        } else if (provider.category === "LEGAL_SERVICES") {
          score += 12;
          if (!reasons.includes("Immigration / legal support")) reasons.push("Immigration / legal support");
        }
      }
      if (profile.isBusinessOwner && provider.category === "GOVERNMENT_OTHER" && tags.includes("business")) {
        score += 16;
        reasons.unshift("Business relocation services");
      }
      if (profile.hasSenior && provider.category === "GOVERNMENT_HEALTH" && tags.includes("senior")) {
        score += 16;
        if (!reasons.includes("Medicare-related services")) reasons.push("Medicare-related services");
      }

      if (context?.stateRule && userState) {
        if (provider.category === "GOVERNMENT_DMV" && context.stateRule.dmvRules) {
          score += 18;
          reasons.unshift(`DMV rules available for ${userState}`);
        }
        if (provider.category === "GOVERNMENT_VOTER" && context.stateRule.voterRegistration) {
          score += 12;
          reasons.unshift(`Voter rules available for ${userState}`);
        }
        if (provider.category === "GOVERNMENT_TAX" && context.stateRule.taxInfo) {
          score += 14;
          reasons.unshift(`Tax guidance available for ${userState}`);
        }
      }

      // 5. Profile-based tag matching
      for (const tag of tags) {
        const matcher = TAG_PROFILE_MAP[tag];
        if (matcher) {
          const result = matcher(profile);
          if (result.match) {
            score += result.weight;
            if (!reasons.includes(result.reason)) reasons.push(result.reason);
          }
        }
      }

      // 6. Community popularity signal
      const communityScore = lookupCommunityPopularity(communityPopular, provider);
      if (communityScore > 0) {
        score += Math.min(20, communityScore);
        reasons.push("Popular in your area");
      }

      // 6b. True geo-local ranking. For a provider that carries representative
      // coordinates AND a user with known coordinates, add a monotonic proximity
      // bonus (nearer → larger) and remember the distance bucket for the sort
      // key's tiebreaker. Both are pure per-element functions of this provider,
      // so they never make the comparator depend on a *pair* — transitivity holds.
      const distanceKm = providerDistanceKm(provider, profile);
      const geoBonus = geoDistanceBonus(distanceKm);
      if (geoBonus > 0) {
        score += geoBonus;
        if (distanceKm !== null && distanceKm <= GEO_DISTANCE_FALLOFF_KM) {
          reasons.push("Near your new address");
        }
      }
      const geoBucket = geoDistanceBucket(distanceKm);

      if (typeof provider.displayOrder === "number" && provider.displayOrder > 0) {
        score += Math.max(0, 12 - Math.min(provider.displayOrder, 12));
      }

      // 7. Negative scoring for irrelevant providers
      const isKidRelated = tags.some((t) => ["kids", "children", "daycare", "education"].includes(t));
      if (isKidRelated && !profile.hasChildren) score -= 15;

      const isPetRelated = tags.some((t) => ["pet", "dog", "cat", "vet"].includes(t));
      if (isPetRelated && !profile.hasPets) score -= 15;

      const isSeniorRelated = tags.some((t) => ["senior", "medicare"].includes(t));
      if (isSeniorRelated && !profile.hasSenior) score -= 10;

      const isAutoRelated = tags.some((t) => ["car", "auto", "toll", "driving", "dmv"].includes(t));
      if (isAutoRelated && profile.carCount === 0) score -= 10;

      if (tags.includes("storage") && !profile.needsStorage) score -= 10;
      if (tags.includes("motorcycle") && !profile.hasMotorcycle) score -= 10;
      if (tags.some((t) => ["boat", "rv"].includes(t)) && !profile.hasBoatRV) score -= 10;

      // Military / veteran benefits are opt-in — deprioritize for non-military profiles.
      const isMilitaryRelated = tags.some((t) => ["military", "veteran", "veterans"].includes(t));
      if (isMilitaryRelated && !profile.isMilitary) score -= 10;

      // Business-relocation services are only relevant to business movers.
      if (tags.includes("business") && !profile.isBusinessOwner) score -= 10;

      // Immigration/visa SERVICES (legal, consulting) are deprioritized for
      // non-immigrants. The federal USCIS AR-11 address change is legally
      // required for any non-citizen and absence of the signal may just mean the
      // user did not disclose, so we never penalize GOVERNMENT_IMMIGRATION itself.
      const isImmigrationRelated = tags.some((t) => ["immigration", "visa"].includes(t));
      if (isImmigrationRelated && provider.category !== "GOVERNMENT_IMMIGRATION" && !profile.isImmigrant) {
        score -= 10;
      }

      // Build explanation
      const headline = URGENCY_HEADLINES[provider.category] || (urgencyTier === "CRITICAL" ? "⚠️ Required for your move" : "");
      const explanation: RecommendationExplanation = {
        urgencyTier,
        headline,
        reason: reasons.slice(0, 3).join(" · ") || getCategoryLabel(provider.category),
        coverageConfidence,
        coverageLabel: coveragePresentation.label,
        caveat: coveragePresentation.requiresCaveat ? coveragePresentation.description : undefined,
        manualConfirmationNote: "Confirm details and availability with the provider. LocateFlow recommendations are manual guidance only.",
        recommendationUse: "MANUAL_TRACKING_CANDIDATE",
        deadline: CATEGORY_DEADLINES[provider.category],
        profileMatch: reasons.find((r) => r.startsWith("You have") || r.includes("your")) || undefined,
        communityNote: provider.userCount && provider.userCount > 10
          ? `${provider.userCount.toLocaleString()} users in your area`
          : undefined,
      };

      return {
        ...provider,
        recommendationScore: Math.max(0, Math.round(score)),
        urgencyTier,
        matchReasons: reasons,
        explanation,
        geoDistanceBucket: geoBucket,
      };
    })
    .filter((p) => {
      // Filter out providers user already has
      if (existingServiceNames && existingServiceNames.has(p.name.toLowerCase())) return false;
      return true;
    })
    .sort(compareScoredProviders);
}

// ── Deterministic Ranking Key ────────────────────────────────
// The ranking comparator MUST be a strict total order. A previous version
// applied the coverage-rank tiebreaker only when EITHER operand was
// address-sensitive and compared both operands' coverage rank regardless of
// whether each was itself sensitive. That made the relation a property of the
// *pair* rather than of each element, so it was not provably transitive and
// V8's sort produced order-dependent (unstable) rankings.
//
// The fix computes ONE deterministic composite key per provider and compares
// those keys field by field. Coverage rank is folded in as a *per-element*
// component (address-sensitive providers carry their coverage rank; others
// carry a fixed sentinel so they rank purely on score, exactly as before),
// and a stable `id` terminal tiebreaker guarantees a strict total order so the
// result is independent of operand/input order.

const TIER_SORT_ORDER: Record<UrgencyTier, number> = {
  CRITICAL: 0,
  IMPORTANT: 1,
  RECOMMENDED: 2,
  OPTIONAL: 3,
};

interface ProviderSortKey {
  /** Ascending — lower tier index is more urgent. */
  tier: number;
  /**
   * Descending coverage rank for address-sensitive providers; a fixed sentinel
   * (-1, sorts after every real rank) for non-address-sensitive providers so
   * they are ordered purely by score within the tier — matching the prior
   * behaviour where the coverage branch never affected a pair of
   * non-address-sensitive providers.
   */
  coverageRank: number;
  /** Descending — higher score first. */
  score: number;
  /**
   * Ascending — nearer geo-bucket first. A per-element value precomputed during
   * scoring (sentinel MAX_SAFE_INTEGER when the user or provider lacks
   * coordinates), so geo-less providers fall through to displayOrder/popularity
   * exactly as before. Breaks score ties by proximity without ever comparing a
   * pair pairwise, keeping the comparator a strict, transitive total order.
   */
  geoDistanceBucket: number;
  /** Ascending — explicit positive displayOrder first, else MAX_SAFE_INTEGER. */
  displayOrder: number;
  /** Descending — higher popularity first. */
  popularity: number;
  /** Ascending stable tiebreaker — guarantees a strict total order. */
  id: string;
}

function getProviderSortKey(p: ScoredProvider): ProviderSortKey {
  const addressSensitive = isCoverageAddressSensitive(p.category);
  return {
    tier: TIER_SORT_ORDER[p.urgencyTier],
    coverageRank: addressSensitive
      ? getCoverageConfidencePresentation(getProviderCoverageConfidence(p)).rank
      : -1,
    score: p.recommendationScore,
    geoDistanceBucket:
      typeof p.geoDistanceBucket === "number" && Number.isFinite(p.geoDistanceBucket)
        ? p.geoDistanceBucket
        : Number.MAX_SAFE_INTEGER,
    displayOrder:
      typeof p.displayOrder === "number" && p.displayOrder > 0
        ? p.displayOrder
        : Number.MAX_SAFE_INTEGER,
    popularity: p.popularityScore || 0,
    id: p.id,
  };
}

function compareScoredProviders(a: ScoredProvider, b: ScoredProvider): number {
  const ka = getProviderSortKey(a);
  const kb = getProviderSortKey(b);
  // Primary: urgency tier (ascending).
  if (ka.tier !== kb.tier) return ka.tier - kb.tier;
  // Coverage rank (descending) — per-element, so transitive.
  if (ka.coverageRank !== kb.coverageRank) return kb.coverageRank - ka.coverageRank;
  // Score within tier (descending).
  if (ka.score !== kb.score) return kb.score - ka.score;
  // Geo proximity bucket (ascending — nearer first) — per-element, so transitive.
  if (ka.geoDistanceBucket !== kb.geoDistanceBucket) return ka.geoDistanceBucket - kb.geoDistanceBucket;
  // Explicit display order (ascending).
  if (ka.displayOrder !== kb.displayOrder) return ka.displayOrder - kb.displayOrder;
  // Popularity (descending).
  if (ka.popularity !== kb.popularity) return kb.popularity - ka.popularity;
  // Stable id tiebreaker (ascending) — makes the order strict & total.
  if (ka.id < kb.id) return -1;
  if (ka.id > kb.id) return 1;
  return 0;
}

// ── Cluster Builder ──────────────────────────────────────────

export function buildRecommendationClusters(
  scoredProviders: ScoredProvider[],
  completedCategories: string[] = [],
): RecommendationResult {
  const tiers: UrgencyTier[] = ["CRITICAL", "IMPORTANT", "RECOMMENDED", "OPTIONAL"];
  const completedSet = new Set(completedCategories.map((c) => c.toUpperCase()));

  const clusters: RecommendationCluster[] = tiers.map((tier) => {
    const meta = URGENCY_TIER_META[tier];
    const tierProviders = scoredProviders.filter((p) => p.urgencyTier === tier);

    // Deduplicate by category — show best provider per category in each tier
    const seenCategories = new Set<string>();
    const deduped = tierProviders.filter((p) => {
      if (seenCategories.has(p.category)) return false;
      seenCategories.add(p.category);
      return true;
    });

    const completedCount = deduped.filter((p) => completedSet.has(p.category)).length;
    // Filter out providers whose category the user already has a service for
    const pending = deduped.filter((p) => !completedSet.has(p.category));

    return {
      tier,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      description: meta.description,
      providers: pending,
      completedCount,
      totalCount: deduped.length,
    };
  });

  const criticalCluster = clusters.find((c) => c.tier === "CRITICAL");
  const allCritical = criticalCluster?.providers || [];
  const missingCritical = allCritical
    .filter((p) => !completedSet.has(p.category))
    .map((p) => p.category);

  const nextCriticalActions = allCritical.filter((p) => !completedSet.has(p.category)).slice(0, 3);

  return {
    clusters,
    allProviders: scoredProviders,
    nextCriticalActions,
    stats: {
      total: scoredProviders.length,
      critical: clusters[0]?.totalCount || 0,
      important: clusters[1]?.totalCount || 0,
      recommended: clusters[2]?.totalCount || 0,
      optional: clusters[3]?.totalCount || 0,
      completedCategories,
      // The CRITICAL cluster's completedCount is the count of dedup'd CRITICAL
      // categories already in completedSet — exactly the satisfied critical
      // slots, with no optional categories counted.
      completedCritical: criticalCluster?.completedCount || 0,
      missingCritical,
    },
  };
}

// ── Legacy-compatible helpers ─────────────────────────────────

export function getRecommendedProviders(
  allProviders: ScoredProvider[],
  limit: number = 10,
): ScoredProvider[] {
  const seenCategories = new Set<string>();
  const recommended: ScoredProvider[] = [];

  for (const provider of allProviders) {
    if (
      provider.matchReasons.length === 0 ||
      provider.recommendationScore <= MIN_RECOMMENDATION_SCORE ||
      !hasRecommendableCoverage(provider)
    ) {
      continue;
    }
    if (seenCategories.has(provider.category)) {
      continue;
    }
    seenCategories.add(provider.category);
    recommended.push(provider);
    if (recommended.length >= limit) break;
  }

  return recommended;
}

export function getCategoryOrder(category: string): number {
  return CATEGORY_META[category]?.order ?? 999;
}

export function getCategoryLabel(category?: string | null): string {
  if (!category) return "Other";
  return CATEGORY_META[category]?.label || category.replace(/_/g, " ").split(" ").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_META[category]?.icon || "📋";
}

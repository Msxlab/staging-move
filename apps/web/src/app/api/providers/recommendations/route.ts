import { NextRequest, NextResponse } from "next/server";
import { getProviderCoverageMetadata, zipCentroid, type ProviderCoverageModel } from "@locateflow/db";
import { CANCELED_MOVING_PLAN_STATUSES, getCurrentRelocationPhase, inferProviderCoverageModel } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import {
  scoreProviders,
  buildRecommendationClusters,
  getEssentialSetupCategories,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryOrder,
  type UserProfile,
  type Provider,
  type ScoredProvider,
  type UrgencyTier,
} from "@/lib/recommendation-engine";
import { getProviderMatchLevelFromDb, resolveEffectiveState, safeJsonArray, tierProvidersFromDb } from "@/lib/provider-matching";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { recordIntegrationOutcomes } from "@/lib/integration-telemetry";
import { getScoringWeightOverrides } from "@/lib/recommendation-weights";
import { getCommunityPopularity } from "@/lib/community-popularity";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";
import {
  enrichProviderServiceability,
  providerServiceabilityGatedMeta,
  type ServiceabilitySourceGap,
} from "@/lib/provider-serviceability";
import { requestHasPlanFeature } from "@/lib/request-entitlements";
import type { ProviderCoverageMetadata } from "@locateflow/db";

const GUIDE_LANE_PROVIDER_LIMIT = 8;
const GUIDE_SIGNAL_LIMIT = 6;

type RecommendationGuideAction = {
  kind: "add_provider" | "verify_address" | "review_state_rules" | "finish_saved";
  label: string;
  reason: string;
  category?: string;
  providerId?: string;
};

type RecommendationGuideLane = {
  key: "setup_first" | "best_matches" | "address_check" | "saved_for_later";
  title: string;
  description: string;
  providers: ScoredProvider[];
  action?: RecommendationGuideAction;
};

type RecommendationGuideCompletion = {
  score: number;
  completedCritical: number;
  missingCritical: number;
  missingLabels: string[];
  nextBestCategory: string | null;
};

type RecommendationGuideSetupCategory = {
  category: string;
  label: string;
  reason: string;
  urgency: UrgencyTier;
  providerId?: string;
  providerName?: string;
};

type RecommendationGuideSetupSection = {
  key: "move_in_essentials" | "household_specific" | "address_checks" | "finish_later";
  title: string;
  description: string;
  categories: RecommendationGuideSetupCategory[];
  providerCount: number;
  action?: RecommendationGuideAction;
};

type RecommendationGuideSetupPlan = {
  sections: RecommendationGuideSetupSection[];
  primaryNextCategory: string | null;
  primaryNextLabel: string | null;
  totalOpenCategories: number;
};

type RecommendationGuideDecisionModel = {
  title: string;
  factors: string[];
  learningSignals: string[];
  coverageWarnings: string[];
};

type ProfileSignalSource = {
  moveType?: string | null;
} | null;

function uniqueScoredProviders(providers: ScoredProvider[]): ScoredProvider[] {
  const seen = new Set<string>();
  const unique: ScoredProvider[] = [];
  for (const provider of providers) {
    if (!provider?.id || seen.has(provider.id)) continue;
    seen.add(provider.id);
    unique.push(provider);
  }
  return unique;
}

function categoryLabel(category: string): string {
  return getMergedDisplayCategoryLabel(category) || category.replace(/_/g, " ");
}

function providerNeedsAddressCheck(provider: ScoredProvider): boolean {
  const confidence = provider.explanation?.coverageConfidence;
  return (
    provider.requiresAddressCheck === true ||
    provider.coverageMatchLevel === "live_address" ||
    confidence === "ADDRESS_CHECK_REQUIRED" ||
    confidence === "STATE_LEVEL" ||
    confidence === "NATIONAL_OR_FEDERAL" ||
    confidence === "UNKNOWN"
  );
}

function buildProfileSignals(input: {
  profile: ProfileSignalSource;
  userProfile: UserProfile;
  regionLabel: string | null;
}): string[] {
  const { profile, userProfile, regionLabel } = input;
  const signals: string[] = [];
  if (regionLabel) signals.push(regionLabel);

  if (userProfile.ownership === "RENT") signals.push("Renter household");
  else if (userProfile.ownership === "OWN") signals.push("Owner household");

  const familyStatus = typeof userProfile.familyStatus === "string" ? userProfile.familyStatus.toUpperCase() : "";
  if (familyStatus === "FAMILY") signals.push("Family profile");
  else if (familyStatus === "COUPLE") signals.push("Couple profile");

  if (userProfile.hasChildren) {
    signals.push(userProfile.childrenCount > 0 ? `${userProfile.childrenCount} children` : "Has children");
  }
  if (userProfile.hasPets) {
    const petTypes = Array.isArray(userProfile.petTypes)
      ? userProfile.petTypes.filter((p) => typeof p === "string" && p.trim()).slice(0, 2)
      : [];
    signals.push(petTypes.length > 0 ? `Pets: ${petTypes.join(", ")}` : "Has pets");
  }
  if (userProfile.carCount > 0) signals.push(`${userProfile.carCount} vehicle${userProfile.carCount === 1 ? "" : "s"}`);
  if (userProfile.needsStorage) signals.push("Needs storage");
  if (userProfile.isMilitary || profile?.moveType === "MILITARY") signals.push("Military move");
  if (userProfile.isBusinessOwner) signals.push("Business relocation");
  if (userProfile.isImmigrant) signals.push("Immigration tasks");
  if (typeof userProfile.daysUntilMove === "number") {
    if (userProfile.daysUntilMove >= 0) signals.push(`Move in ${userProfile.daysUntilMove} days`);
    else signals.push("Move already started");
  }

  return uniqueStrings(signals).slice(0, GUIDE_SIGNAL_LIMIT);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    unique.push(clean);
  }
  return unique;
}

function uniqueCategories(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const clean = (value || "").trim().toUpperCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    unique.push(clean);
  }
  return unique.sort((a, b) => getMergedDisplayCategoryOrder(a) - getMergedDisplayCategoryOrder(b));
}

function buildRecommendationGuide(input: {
  scored: ScoredProvider[];
  nextCriticalActions: ScoredProvider[];
  regionGroups: Array<{ category: string; label: string; tier: UrgencyTier; providers: ScoredProvider[] }>;
  savedProviderIds: Set<string>;
  missingCritical: string[];
  completedCritical: number;
  completedCategories: string[];
  serviceCount: number;
  dismissedCount: number;
  profile: ProfileSignalSource;
  userProfile: UserProfile;
  regionLabel: string | null;
  stateRuleAvailable: boolean;
  coordinatesUsed: boolean;
  fccStatus?: string | null;
  electricStatus?: string | null;
}) {
  const setupFirst = uniqueScoredProviders(input.nextCriticalActions)
    .slice(0, GUIDE_LANE_PROVIDER_LIMIT);
  const bestMatches = uniqueScoredProviders(input.regionGroups.flatMap((group) => group.providers))
    .filter((provider) => !setupFirst.some((p) => p.id === provider.id))
    .slice(0, GUIDE_LANE_PROVIDER_LIMIT);
  const addressCheck = uniqueScoredProviders(input.scored)
    .filter((provider) => providerNeedsAddressCheck(provider))
    .filter((provider) => !setupFirst.some((p) => p.id === provider.id))
    .slice(0, GUIDE_LANE_PROVIDER_LIMIT);
  const savedProviders = input.savedProviderIds.size
    ? uniqueScoredProviders(input.scored)
        .filter((provider) => input.savedProviderIds.has(provider.id))
        .slice(0, GUIDE_LANE_PROVIDER_LIMIT)
    : [];

  const lanes: RecommendationGuideLane[] = [];
  if (setupFirst.length > 0) {
    lanes.push({
      key: "setup_first",
      title: "Set up first",
      description: "Critical services and move tasks matched to this address.",
      providers: setupFirst,
      action: providerToAddAction(setupFirst[0]),
    });
  }
  if (bestMatches.length > 0) {
    lanes.push({
      key: "best_matches",
      title: input.regionLabel ? `Best matches near ${input.regionLabel}` : "Best matches",
      description: "Top address-aware picks grouped by the services you still need.",
      providers: bestMatches,
      action: providerToAddAction(bestMatches[0]),
    });
  }
  if (addressCheck.length > 0) {
    lanes.push({
      key: "address_check",
      title: "Check by address",
      description: "These providers may fit the area, but availability should be confirmed before relying on them.",
      providers: addressCheck,
      action: {
        kind: "verify_address",
        label: `Check ${categoryLabel(addressCheck[0].category)}`,
        reason: addressCheck[0].explanation?.caveat || "Availability may vary by exact address.",
        category: addressCheck[0].category,
        providerId: addressCheck[0].id,
      },
    });
  }
  if (savedProviders.length > 0) {
    lanes.push({
      key: "saved_for_later",
      title: "Saved for later",
      description: "Providers you saved so you can finish setup without searching again.",
      providers: savedProviders,
      action: {
        kind: "finish_saved",
        label: "Finish saved setup",
        reason: "You saved these providers but have not added them as tracked services yet.",
        providerId: savedProviders[0].id,
        category: savedProviders[0].category,
      },
    });
  }

  const nextActions = uniqueGuideActions([
    ...setupFirst.slice(0, 3).map(providerToAddAction),
    ...(addressCheck[0]
      ? [{
          kind: "verify_address" as const,
          label: `Verify ${categoryLabel(addressCheck[0].category)}`,
          reason: addressCheck[0].explanation?.caveat || "Confirm address-level service before depending on it.",
          category: addressCheck[0].category,
          providerId: addressCheck[0].id,
        }]
      : []),
    ...(input.stateRuleAvailable
      ? [{
          kind: "review_state_rules" as const,
          label: "Review state rules",
          reason: "DMV, voter, or tax guidance is available for this destination state.",
        }]
      : []),
  ]).slice(0, 4);

  const essentialSetup = getEssentialSetupCategories(input.userProfile, input.completedCategories);
  const planMissingCritical = uniqueCategories([
    ...input.missingCritical,
    ...essentialSetup.critical,
  ]);
  const missingLabels = planMissingCritical.slice(0, 4).map(categoryLabel);
  const profileSignals = buildProfileSignals({
    profile: input.profile,
    userProfile: input.userProfile,
    regionLabel: input.regionLabel,
  });
  const completion = buildGuideCompletion({
    completedCritical: input.completedCritical,
    missingCritical: planMissingCritical,
  });
  const setupPlan = buildGuideSetupPlan({
    scored: input.scored,
    essentialCritical: essentialSetup.critical,
    essentialImportant: essentialSetup.important,
    addressCheck,
    savedProviders,
    userProfile: input.userProfile,
  });
  const decisionModel = buildGuideDecisionModel({
    hasCoordinates: input.coordinatesUsed,
    stateRuleAvailable: input.stateRuleAvailable,
    profileSignals,
    serviceCount: input.serviceCount,
    completedCategories: input.completedCategories,
    savedCount: input.savedProviderIds.size,
    dismissedCount: input.dismissedCount,
    addressCheckCount: addressCheck.length,
    fccStatus: input.fccStatus,
    electricStatus: input.electricStatus,
  });
  const summary = buildGuideSummary({
    regionLabel: input.regionLabel,
    missingLabels,
    lanes,
    profileSignals,
  });

  return {
    version: 1,
    source: "rules_with_api_evidence",
    summary,
    completion,
    setupPlan,
    decisionModel,
    profileSignals,
    nextActions,
    lanes,
    dataCoverage: {
      availableAtAddress: input.scored.filter((p) => p.explanation?.coverageConfidence === "AVAILABLE_AT_ADDRESS").length,
      exactZip: input.scored.filter((p) => p.explanation?.coverageConfidence === "EXACT_ZIP").length,
      zipPrefix: input.scored.filter((p) => p.explanation?.coverageConfidence === "ZIP_PREFIX").length,
      addressCheckRequired: input.scored.filter(providerNeedsAddressCheck).length,
    },
  };
}

function firstProviderForCategory(providers: ScoredProvider[], category: string): ScoredProvider | null {
  return providers.find((provider) => provider.category === category) || null;
}

function setupCategoryReason(category: string, userProfile: UserProfile, provider?: ScoredProvider | null): string {
  if (category === "FINANCIAL_INSURANCE_RENTERS") return "Renter profile: protect liability, belongings, and lease requirements.";
  if (category === "FINANCIAL_INSURANCE_HOME") return "Owner profile: keep property coverage aligned with the new address.";
  if (category === "FINANCIAL_MORTGAGE") return "Owner profile: mortgage and escrow records may need the new address.";
  if (category === "FINANCIAL_INSURANCE_AUTO") return `${Math.max(userProfile.carCount || 0, 1)} vehicle profile: update insurance for the new state.`;
  if (category === "TRANSPORTATION_TOLL" || category === "TRANSPORTATION_AUTO" || category === "TRANSPORTATION_PARKING") {
    return "Vehicle profile: driving, tolls, and parking may change after the move.";
  }
  if (category === "KIDS_SCHOOL" || category === "KIDS_DAYCARE" || category === "KIDS_ACTIVITY") {
    return userProfile.childrenCount > 0
      ? `${userProfile.childrenCount} child${userProfile.childrenCount === 1 ? "" : "ren"} on profile: handle school and childcare setup.`
      : "Family profile: handle school and childcare setup.";
  }
  if (category === "HEALTHCARE_VET" || category === "FINANCIAL_INSURANCE_PET" || category === "PET_SERVICES") {
    return "Pet profile: line up local care before the move settles in.";
  }
  if (category === "HEALTHCARE_SENIOR") return "Senior household signal: keep care and benefits continuity clear.";
  if (category === "HOUSING_STORAGE") return "Storage need selected during onboarding.";
  if (category === "GOVERNMENT_IMMIGRATION") return "Immigration status signal: address updates may be time-sensitive.";
  if (category === "GOVERNMENT_DMV") return "State move: ID, license, or registration rules may apply.";
  if (category === "GOVERNMENT_POSTAL") return "Mail forwarding should be set before the move.";
  if (category.startsWith("UTILITY_")) return "Move-in essential: confirm service before day one.";
  if (category === "FINANCIAL_BANK" || category === "FINANCIAL_CREDIT_CARD") return "Financial records should follow your new address.";
  return provider?.explanation?.reason || "Recommended by your address, move timing, and onboarding details.";
}

function setupCategory(
  category: string,
  urgency: UrgencyTier,
  providers: ScoredProvider[],
  userProfile: UserProfile,
): RecommendationGuideSetupCategory {
  const provider = firstProviderForCategory(providers, category);
  return {
    category,
    label: categoryLabel(category),
    reason: setupCategoryReason(category, userProfile, provider),
    urgency,
    providerId: provider?.id,
    providerName: provider?.name,
  };
}

function buildGuideSetupPlan(input: {
  scored: ScoredProvider[];
  essentialCritical: string[];
  essentialImportant: string[];
  addressCheck: ScoredProvider[];
  savedProviders: ScoredProvider[];
  userProfile: UserProfile;
}): RecommendationGuideSetupPlan {
  const sections: RecommendationGuideSetupSection[] = [];
  const critical = uniqueCategories(input.essentialCritical);
  const important = uniqueCategories(input.essentialImportant);
  const moveIn = uniqueCategories([...critical, ...important.slice(0, 4)])
    .slice(0, 8)
    .map((category) =>
      setupCategory(
        category,
        critical.includes(category) ? "CRITICAL" : "IMPORTANT",
        input.scored,
        input.userProfile,
      ),
    );
  if (moveIn.length > 0) {
    sections.push({
      key: "move_in_essentials",
      title: "Move-in essentials",
      description: "Services and records that should be ready before, or right after, move-in.",
      categories: moveIn,
      providerCount: moveIn.filter((item) => item.providerId).length,
      action: moveIn[0]
        ? {
            kind: "add_provider",
            label: `Add ${moveIn[0].label}`,
            reason: moveIn[0].reason,
            category: moveIn[0].category,
            providerId: moveIn[0].providerId,
          }
        : undefined,
    });
  }

  const householdCategories = uniqueCategories(
    input.scored
      .filter((provider) => {
        const reasons = provider.matchReasons || [];
        const profileReason = provider.explanation?.profileMatch || "";
        return (
          reasons.some((reason) =>
            /child|family|pet|vehicle|car|storage|senior|immigration|business|military/i.test(reason),
          ) ||
          /child|family|pet|vehicle|car|storage|senior|immigration|business|military/i.test(profileReason)
        );
      })
      .map((provider) => provider.category),
  )
    .filter((category) => !moveIn.some((item) => item.category === category))
    .slice(0, 6)
    .map((category) => setupCategory(category, "RECOMMENDED", input.scored, input.userProfile));
  if (householdCategories.length > 0) {
    sections.push({
      key: "household_specific",
      title: "Household-specific",
      description: "Extra setup surfaced from children, pets, vehicles, storage, business, or immigration answers.",
      categories: householdCategories,
      providerCount: householdCategories.filter((item) => item.providerId).length,
      action: householdCategories[0]
        ? {
            kind: "add_provider",
            label: `Add ${householdCategories[0].label}`,
            reason: householdCategories[0].reason,
            category: householdCategories[0].category,
            providerId: householdCategories[0].providerId,
          }
        : undefined,
    });
  }

  const addressCategories = uniqueCategories(input.addressCheck.map((provider) => provider.category))
    .slice(0, 5)
    .map((category) => setupCategory(category, "IMPORTANT", input.addressCheck, input.userProfile));
  if (addressCategories.length > 0) {
    sections.push({
      key: "address_checks",
      title: "Verify by address",
      description: "These providers may serve the area, but should be confirmed for the exact address.",
      categories: addressCategories,
      providerCount: addressCategories.filter((item) => item.providerId).length,
      action: addressCategories[0]
        ? {
            kind: "verify_address",
            label: `Verify ${addressCategories[0].label}`,
            reason: addressCategories[0].reason,
            category: addressCategories[0].category,
            providerId: addressCategories[0].providerId,
          }
        : undefined,
    });
  }

  const savedCategories = uniqueCategories(input.savedProviders.map((provider) => provider.category))
    .slice(0, 5)
    .map((category) => setupCategory(category, "RECOMMENDED", input.savedProviders, input.userProfile));
  if (savedCategories.length > 0) {
    sections.push({
      key: "finish_later",
      title: "Saved for later",
      description: "Providers you saved but have not finished tracking yet.",
      categories: savedCategories,
      providerCount: savedCategories.filter((item) => item.providerId).length,
      action: savedCategories[0]
        ? {
            kind: "finish_saved",
            label: `Finish ${savedCategories[0].label}`,
            reason: savedCategories[0].reason,
            category: savedCategories[0].category,
            providerId: savedCategories[0].providerId,
          }
        : undefined,
    });
  }

  const flat = sections.flatMap((section) => section.categories);
  return {
    sections,
    primaryNextCategory: flat[0]?.category || null,
    primaryNextLabel: flat[0]?.label || null,
    totalOpenCategories: uniqueCategories(flat.map((item) => item.category)).length,
  };
}

function buildGuideCompletion(input: {
  completedCritical: number;
  missingCritical: string[];
}): RecommendationGuideCompletion {
  const missingLabels = input.missingCritical.slice(0, 6).map(categoryLabel);
  const totalCritical = input.completedCritical + input.missingCritical.length;
  const score = totalCritical > 0 ? Math.round((input.completedCritical / totalCritical) * 100) : 100;
  return {
    score,
    completedCritical: input.completedCritical,
    missingCritical: input.missingCritical.length,
    missingLabels,
    nextBestCategory: input.missingCritical[0] || null,
  };
}

function buildGuideDecisionModel(input: {
  hasCoordinates: boolean;
  stateRuleAvailable: boolean;
  profileSignals: string[];
  serviceCount: number;
  completedCategories: string[];
  savedCount: number;
  dismissedCount: number;
  addressCheckCount: number;
  fccStatus?: string | null;
  electricStatus?: string | null;
}): RecommendationGuideDecisionModel {
  const factors = [
    "Move-in essentials are ranked before nice-to-have services.",
    "Already tracked service categories are removed from setup gaps.",
    "Coverage confidence decides whether a provider is a direct pick or an address-check candidate.",
  ];
  if (input.profileSignals.length > 0) {
    factors.push("Onboarding details tune the order, such as household type, pets, vehicles, move timing, and destination.");
  }
  if (input.stateRuleAvailable) {
    factors.push("Destination state rules can lift DMV, voter, tax, or compliance tasks.");
  }

  const learningSignals: string[] = [];
  if (input.serviceCount > 0) {
    learningSignals.push(`${input.serviceCount} tracked service${input.serviceCount === 1 ? "" : "s"} shape what is still missing.`);
  }
  if (input.completedCategories.length > 0) {
    learningSignals.push(`${input.completedCategories.length} completed categor${input.completedCategories.length === 1 ? "y" : "ies"} suppress duplicate recommendations.`);
  }
  if (input.profileSignals.length > 0) {
    learningSignals.push(`${input.profileSignals.length} profile signal${input.profileSignals.length === 1 ? "" : "s"} tune the recommendation order.`);
  }
  if (input.savedCount > 0) {
    learningSignals.push(`${input.savedCount} saved provider${input.savedCount === 1 ? "" : "s"} stay available as finish-later picks.`);
  }
  if (input.dismissedCount > 0) {
    learningSignals.push(`${input.dismissedCount} dismissed provider${input.dismissedCount === 1 ? "" : "s"} are hidden from this plan.`);
  }
  if (input.hasCoordinates) {
    learningSignals.push("Address coordinates improve local coverage and distance ranking.");
  }
  if (learningSignals.length === 0) {
    learningSignals.push("Add an address, move date, and profile details to make the plan sharper.");
  }

  const coverageWarnings: string[] = [];
  if (input.addressCheckCount > 0) {
    coverageWarnings.push(`${input.addressCheckCount} provider${input.addressCheckCount === 1 ? "" : "s"} should be verified at the exact address.`);
  }
  if (input.fccStatus && input.fccStatus !== "ok") {
    coverageWarnings.push(`Internet serviceability source: ${input.fccStatus}.`);
  }
  if (input.electricStatus && input.electricStatus !== "ok") {
    coverageWarnings.push(`Electric utility source: ${input.electricStatus}.`);
  }
  if (coverageWarnings.length === 0) {
    coverageWarnings.push("No major coverage caveats for the current recommendation set.");
  }

  return {
    title: "How this plan is ranked",
    factors,
    learningSignals,
    coverageWarnings,
  };
}

function providerToAddAction(provider: ScoredProvider): RecommendationGuideAction {
  return {
    kind: "add_provider",
    label: `Add ${categoryLabel(provider.category)}`,
    reason: provider.explanation?.reason || provider.matchReasons?.[0] || provider.name,
    category: provider.category,
    providerId: provider.id,
  };
}

function uniqueGuideActions(actions: RecommendationGuideAction[]): RecommendationGuideAction[] {
  const seen = new Set<string>();
  const unique: RecommendationGuideAction[] = [];
  for (const action of actions) {
    const key = `${action.kind}:${action.category || ""}:${action.providerId || ""}:${action.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(action);
  }
  return unique;
}

function buildGuideSummary(input: {
  regionLabel: string | null;
  missingLabels: string[];
  lanes: RecommendationGuideLane[];
  profileSignals: string[];
}): string {
  const place = input.regionLabel ? ` for ${input.regionLabel}` : "";
  if (input.missingLabels.length > 0) {
    return `Your setup${place} has ${input.missingLabels.length} priority area${input.missingLabels.length === 1 ? "" : "s"} to resolve: ${input.missingLabels.join(", ")}.`;
  }
  if (input.lanes.length > 0) {
    return `Your provider plan${place} is organized by priority, coverage confidence, and the profile details you shared.`;
  }
  if (input.profileSignals.length > 0) {
    return `Your provider plan is ready and tuned to ${input.profileSignals.slice(0, 3).join(", ")}.`;
  }
  return "Your provider plan is ready. Add an address or move details to make recommendations more precise.";
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function metadataStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function appendUniqueLimited(values: string[], next: string | null | undefined, limit = 12): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of [...values, next || ""]) {
    const clean = value.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

function sourceGapSeverity(gap: ServiceabilitySourceGap): "HIGH" | "MEDIUM" {
  return gap.category === "UTILITY_ELECTRIC" || gap.category === "UTILITY_INTERNET" ? "HIGH" : "MEDIUM";
}

async function recordProviderSourceGaps(
  gaps: ServiceabilitySourceGap[],
  context: {
    state: string | null | undefined;
    zip: string | null | undefined;
    addressId: string | null | undefined;
    latitude: number | null | undefined;
    longitude: number | null | undefined;
  },
): Promise<void> {
  if (gaps.length === 0) return;

  for (const gap of gaps.slice(0, 8)) {
    const now = new Date().toISOString();
    const title = `Source provider missing: ${gap.category} ${gap.name}`;
    const state = context.state || null;
    const zip = context.zip || null;
    const locationLabel = [state, zip].filter(Boolean).join(" ") || null;
    const baseMetadata = {
      source: gap.source,
      category: gap.category,
      providerName: gap.name,
      sourceProviderId: gap.sourceProviderId,
      evidenceUrl: gap.evidenceUrl,
      state,
      zip,
      addressId: context.addressId || null,
      latitude: context.latitude ?? null,
      longitude: context.longitude ?? null,
    };
    const existing = await prisma.providerGovernanceIssue.findFirst({
      where: {
        issueType: "SOURCE_PROVIDER_MISSING",
        status: "OPEN",
        title,
      },
      select: { id: true, metadata: true },
    });
    if (existing) {
      const previous = metadataRecord(existing.metadata);
      const previousCount = typeof previous.occurrenceCount === "number" && Number.isFinite(previous.occurrenceCount)
        ? previous.occurrenceCount
        : 1;
      await prisma.providerGovernanceIssue.update({
        where: { id: existing.id },
        data: {
          severity: sourceGapSeverity(gap),
          metadata: {
            ...previous,
            ...baseMetadata,
            occurrenceCount: previousCount + 1,
            firstSeen: typeof previous.firstSeen === "string" ? previous.firstSeen : now,
            lastSeen: now,
            states: appendUniqueLimited(metadataStringArray(previous.states), state),
            zips: appendUniqueLimited(metadataStringArray(previous.zips), zip),
            sampleAddressIds: appendUniqueLimited(metadataStringArray(previous.sampleAddressIds), context.addressId),
            sampleLocations: appendUniqueLimited(metadataStringArray(previous.sampleLocations), locationLabel),
          },
        },
      });
      continue;
    }

    await prisma.providerGovernanceIssue.create({
      data: {
        issueType: "SOURCE_PROVIDER_MISSING",
        status: "OPEN",
        severity: sourceGapSeverity(gap),
        title,
        description:
          `${gap.source} returned ${gap.name} for the requested location, but no matching active catalog provider was found. ` +
          "Review the official source, add/update the provider, and attach precise coverage before surfacing it as an actionable recommendation.",
        metadata: {
          ...baseMetadata,
          occurrenceCount: 1,
          firstSeen: now,
          lastSeen: now,
          states: appendUniqueLimited([], state),
          zips: appendUniqueLimited([], zip),
          sampleAddressIds: appendUniqueLimited([], context.addressId),
          sampleLocations: appendUniqueLimited([], locationLabel),
        },
      },
    });
  }
}

// Representative geo coordinate for a GEO-BEARING provider: the centroid of its
// mapped service-area polygon(s). Returned only when the provider has polygon
// metadata with points; otherwise null. This single point lets the shared
// recommendation engine rank a nearer local provider above a farther one when
// the user also has coordinates — without storing per-provider lat/lng in the
// catalog (the ServiceProvider model has none). The fold is deterministic, so
// it never affects the engine's provably-transitive comparator.
function providerGeoCentroid(
  metadata: ProviderCoverageMetadata | null | undefined,
): { latitude: number; longitude: number } | null {
  const polygons = metadata?.polygons;
  if (!polygons || polygons.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;
  for (const poly of polygons) {
    for (const point of poly.points) {
      if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
        sumLat += point.latitude;
        sumLng += point.longitude;
        count += 1;
      }
    }
  }
  if (count === 0) return null;
  return { latitude: sumLat / count, longitude: sumLng / count };
}

// GET /api/providers/recommendations — personalized, completion-aware recommendations
// Returns tiered clusters with "next critical actions" based on what user already has
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const scope = await resolveWorkspaceDataScope(request, userId);

    const rl = await enforceRateLimitPolicy(request, "provider_recommendations", {
      userId,
      routeId: "providers_recommendations",
    });
    if (!rl.success) {
      return NextResponse.json(
        { code: rl.policy.userFacingErrorCode, error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedAddressId = searchParams.get("addressId");
    const requestedState = searchParams.get("state")?.trim().toUpperCase();
    const requestedZip = searchParams.get("zip")?.trim();
    const requestedLatitudeParam = searchParams.get("lat");
    const requestedLongitudeParam = searchParams.get("lng");
    const requestedLatitude = requestedLatitudeParam !== null ? Number(requestedLatitudeParam) : null;
    const requestedLongitude = requestedLongitudeParam !== null ? Number(requestedLongitudeParam) : null;
    const queryLatitude = Number.isFinite(requestedLatitude) ? requestedLatitude : null;
    const queryLongitude = Number.isFinite(requestedLongitude) ? requestedLongitude : null;

    const [profile, addresses, services, movingPlan, recFeedback, savedProviders] = await Promise.all([
      prisma.profile.findUnique({ where: { userId } }).catch(() => null),
      prisma.address.findMany({
        where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
      }),
      prisma.service.findMany({
        where: activeTrackedServiceWhereForScope(
          { userId, workspaceId: scope.workspaceId },
          scope.memberRole === "CHILD" ? { userId } : {},
        ),
        select: { providerName: true, category: true, providerId: true },
      }),
      prisma.movingPlan.findFirst({
        where: scopedRecordWhere(
          scope,
          { deletedAt: null, status: { notIn: [...CANCELED_MOVING_PLAN_STATUSES] } },
          { childSelfOnly: true },
        ),
        orderBy: { moveDate: "asc" },
      }),
      // Active dismiss/snooze feedback — excluded from the recommendation clusters
      // so the engine stops re-surfacing what the user rejected. (Snoozes whose
      // `until` has passed are not loaded, so they auto-resurface.)
      prisma.recommendationFeedback
        .findMany({
          where: { userId, OR: [{ until: null }, { until: { gt: new Date() } }] },
          select: { providerId: true },
        })
        .catch(() => [] as Array<{ providerId: string }>),
      prisma.savedProvider
        .findMany({
          where: { userId },
          select: { providerId: true },
          orderBy: { createdAt: "desc" },
        })
        .catch(() => [] as Array<{ providerId: string }>),
    ]);

    const dismissedProviderIds = new Set(recFeedback.map((f) => f.providerId));
    const savedProviderIds = new Set(savedProviders.map((p) => p.providerId));

    const selectedAddress = addresses.find((a) => a.id === requestedAddressId);
    const primaryAddr = selectedAddress || addresses.find((a) => a.isPrimary) || addresses[0];
    const fallbackState = requestedState || primaryAddr?.state || "";
    const fallbackZip = requestedZip || primaryAddr?.zip || "";

    const effectiveState = resolveEffectiveState(fallbackState, fallbackZip);
    const hasRequestedLocationOverride = Boolean(requestedState || requestedZip);
    const requestMatchesPrimaryAddress = Boolean(
      primaryAddr &&
        (!requestedState || requestedState === primaryAddr.state?.trim().toUpperCase()) &&
        (!requestedZip || requestedZip === primaryAddr.zip?.trim()),
    );
    const canUseStoredAddressCoordinates = Boolean(selectedAddress) || !hasRequestedLocationOverride || requestMatchesPrimaryAddress;
    const hasQueryCoordinates = queryLatitude !== null && queryLongitude !== null;
    let fallbackLatitude = hasQueryCoordinates
      ? queryLatitude
      : canUseStoredAddressCoordinates
        ? primaryAddr?.latitude ?? null
        : null;
    let fallbackLongitude = hasQueryCoordinates
      ? queryLongitude
      : canUseStoredAddressCoordinates
        ? primaryAddr?.longitude ?? null
        : null;
    // No stored/queried coordinates but we have a ZIP → resolve its ZCTA centroid
    // (Census gazetteer) so distance-based provider ranking still works for ANY
    // address with a ZIP, instead of only those with geocoded lat/lng. This is the
    // finer alternative to the coarse 3-digit-prefix heuristic.
    if ((fallbackLatitude === null || fallbackLongitude === null) && fallbackZip) {
      const centroid = zipCentroid(fallbackZip);
      if (centroid) {
        fallbackLatitude = fallbackLatitude ?? centroid.latitude;
        fallbackLongitude = fallbackLongitude ?? centroid.longitude;
      }
    }

    const providers = await prisma.serviceProvider.findMany({
      where: {
        isActive: true,
        ...(effectiveState
          ? { OR: [{ scope: "FEDERAL" }, { coverages: { some: { state: effectiveState } } }] }
          : { scope: "FEDERAL" }),
        category: { not: "TRANSPORTATION_TRANSIT" },
      },
      include: {
        coverages: effectiveState ? { where: { state: effectiveState } } : false,
      },
    });

    const withCoverages = providers.map((p) => {
      const metadata = getProviderCoverageMetadata(p.slug);
      const zipCodes = safeJsonArray(p.zipCodes);
      // Resolution order: per-provider DB override (set by the admin coverage
      // editor) → curated seed metadata → zip-vs-state heuristic. The override
      // is what lets an admin change a provider's model without editing seed
      // code; it's null for every provider that has never been edited, so this
      // is a no-op for them.
      const overrideModel = (p as { coverageModel?: string | null }).coverageModel;
      const coverageModel: ProviderCoverageModel =
        (overrideModel as ProviderCoverageModel | undefined) ||
        metadata?.coverageModel ||
        inferProviderCoverageModel({ category: p.category, scope: p.scope, zipCodes });

      const geoCentroid = providerGeoCentroid(metadata);

      return {
        ...p,
        zipCodes,
        coverageModel,
        coverageNote: metadata?.note || null,
        coverageSourceUrl: metadata?.officialUrl || null,
        geoLatitude: geoCentroid?.latitude ?? null,
        geoLongitude: geoCentroid?.longitude ?? null,
        coverages: "coverages" in p && Array.isArray((p as { coverages?: unknown }).coverages)
          ? (p as unknown as { coverages: { state: string | null; zipPrefix: string | null; zipExact: string | null }[] }).coverages
          : [],
      };
    });

    const tiered = tierProvidersFromDb(withCoverages, {
      state: fallbackState,
      zip: fallbackZip,
      latitude: fallbackLatitude,
      longitude: fallbackLongitude,
    });

    const currentPhase = movingPlan?.moveDate
      ? getCurrentRelocationPhase(
          Math.floor((Date.now() - new Date(movingPlan.moveDate).getTime()) / (24 * 60 * 60 * 1000)),
        )
      : 0;

    // Days until the move (positive = upcoming, negative = past). Drives the
    // proximity scoring signal so time-sensitive setups rank higher as the move
    // nears. Undefined when there's no active move date.
    const daysUntilMove = movingPlan?.moveDate
      ? Math.ceil((new Date(movingPlan.moveDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : undefined;

    // A MILITARY/PCS move implies military affiliation even if the explicit
    // isMilitary flag wasn't toggled — fold both onboarding signals together so
    // VA / military benefits surface for either.
    const isMilitary = Boolean(profile?.isMilitary) || profile?.moveType === "MILITARY";

    // Addresses persist ownership as OWNER/RENTER/FAMILY/OTHER, but the scoring
    // engine's ownership gates compare against OWN/RENT. Normalize here so the
    // renters-vs-homeowners steering actually fires (it was previously a no-op
    // because "RENTER" never matched "RENT").
    const normalizeOwnership = (value?: string | null): string | undefined => {
      if (!value) return undefined;
      const upper = value.toUpperCase();
      if (upper === "OWNER" || upper === "OWN") return "OWN";
      if (upper === "RENTER" || upper === "RENT") return "RENT";
      return "OTHER";
    };

    const userProfile: UserProfile = {
      hasChildren: profile?.hasChildren || false,
      childrenCount: profile?.childrenCount || 0,
      hasPets: profile?.hasPets || false,
      hasSenior: profile?.hasSenior || false,
      carCount: profile?.carCount || 0,
      hasDisability: profile?.hasDisability || false,
      needsStorage: profile?.needsStorage || false,
      hasMotorcycle: profile?.hasMotorcycle || false,
      hasBoatRV: profile?.hasBoatRV || false,
      isMilitary,
      isImmigrant: profile?.isImmigrant || false,
      isBusinessOwner: profile?.isBusinessOwner || false,
      // Extended onboarding signals (audit: collected but previously ignored by
      // scoring — engine block 4d). petTypes persists as a JSON string ("[]"
      // default), so parse defensively with safeJsonArray; the rest pass
      // through as-is and the engine treats blank/absent values as no-signal.
      familyStatus: profile?.familyStatus || undefined,
      ageRange: profile?.ageRange || undefined,
      petTypes: safeJsonArray(profile?.petTypes),
      businessType: profile?.businessType || undefined,
      immigrationStatus: profile?.immigrationStatus || undefined,
      moveType: profile?.moveType || undefined,
      currentPhase,
      daysUntilMove,
      ownership: normalizeOwnership(primaryAddr?.ownership),
      // Destination coordinates drive true geo-local provider ranking in the
      // shared engine (nearer geo-bearing providers rank higher). Undefined
      // coordinates simply skip the geo component, so this is safe when the
      // address has no lat/lng.
      latitude: fallbackLatitude,
      longitude: fallbackLongitude,
    };

    const parsedProviders: Provider[] = tiered.providers.map((p) => {
      const zipCodes = Array.isArray((p as { zipCodes?: unknown }).zipCodes)
        ? (p as { zipCodes: string[] }).zipCodes
        : safeJsonArray(p.zipCodes);
      const coverageModel =
        p.coverageModel || inferProviderCoverageModel({ category: p.category, scope: p.scope, zipCodes });

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        subCategory: p.subCategory,
        description: p.description,
        website: p.website,
        phone: p.phone,
        logoUrl: p.logoUrl,
        scope: p.scope,
        states: safeJsonArray(p.states),
        zipCodes,
        tags: safeJsonArray(p.tags),
        popularityScore: p.popularityScore || 0,
        displayOrder: p.displayOrder || 0,
        userCount: p.userCount || 0,
        affiliateActive: Boolean((p as { affiliateActive?: boolean }).affiliateActive),
        coverageModel,
        coverageMatchLevel: getProviderMatchLevelFromDb(p, {
          state: fallbackState,
          zip: fallbackZip,
          latitude: fallbackLatitude,
          longitude: fallbackLongitude,
        }),
        coverageNote: ("coverageNote" in p ? (p as { coverageNote?: string | null }).coverageNote : null) || null,
        coverageSourceUrl: ("coverageSourceUrl" in p ? (p as { coverageSourceUrl?: string | null }).coverageSourceUrl : null) || null,
        // Representative geo coordinates (service-area polygon centroid) for
        // geo-bearing local providers. Null for federal/national/zip-only catalog
        // providers — the engine then skips the geo component for them.
        latitude: ("geoLatitude" in p ? (p as { geoLatitude?: number | null }).geoLatitude : null) ?? null,
        longitude: ("geoLongitude" in p ? (p as { geoLongitude?: number | null }).geoLongitude : null) ?? null,
        requiresAddressCheck: coverageModel === "live_address",
        requiresPolygonCheck: coverageModel === "polygon",
        fccProviderId: null,
        fccMaxDownloadMbps: null,
        fccMaxUploadMbps: null,
        fccTechnologyCodes: [],
        fccTechnologyLabel: "unknown",
        fccQualityBand: "unknown",
      };
    });

    const canUseDataChecked = await requestHasPlanFeature(request, userId, "addressValidation");
    const serviceability = canUseDataChecked
      ? await enrichProviderServiceability(parsedProviders, {
          latitude: fallbackLatitude,
          longitude: fallbackLongitude,
          forceCategories: ["UTILITY_ELECTRIC", "UTILITY_INTERNET"],
        })
      : providerServiceabilityGatedMeta(parsedProviders);
    await recordProviderSourceGaps(serviceability.sourceGaps, {
      state: effectiveState || requestedState || null,
      zip: fallbackZip || requestedZip || null,
      addressId: primaryAddr?.id || null,
      latitude: fallbackLatitude,
      longitude: fallbackLongitude,
    }).catch((error) => {
      console.warn("Failed to record provider source gaps:", error);
    });

    const existingNames = new Set(services.map((s) => (s.providerName || "").toLowerCase()));
    const completedCategories = [...new Set(services.map((s) => s.category).filter(Boolean))];

    const stateRule = effectiveState
      ? await prisma.stateRule.findUnique({ where: { stateCode: effectiveState } }).catch(() => null)
      : null;

    const scoringWeights = await getScoringWeightOverrides();

    const communityPopular = await getCommunityPopularity(effectiveState);

    const scored = scoreProviders(
      parsedProviders,
      userProfile,
      effectiveState || "",
      communityPopular,
      existingNames,
      {
        stateRule: stateRule ? {
          dmvRules: stateRule.dmvRules,
          voterRegistration: stateRule.voterRegistration,
          taxInfo: stateRule.taxInfo,
        } : null,
        weights: scoringWeights,
      }
    );
    const result = buildRecommendationClusters(scored, completedCategories, dismissedProviderIds);

    // ── #3a: region-grouped top picks ────────────────────────────
    // The user's own city is on their address, so we can head the recommendations
    // with their region and show the top FEW region-relevant providers PER category
    // (the scored list is coverage-ranked, so local providers float up) instead of
    // a single best-per-category or an undifferentiated dump. Focus on pending
    // CRITICAL + IMPORTANT categories — "present region-based, don't recommend
    // everything." Lower tiers stay in the normal clusters/full directory below.
    const REGION_GROUP_PER_CATEGORY = 3;
    const REGION_GROUP_TIERS = new Set<UrgencyTier>(["CRITICAL", "IMPORTANT"]);
    const TIER_RANK: Record<string, number> = { CRITICAL: 0, IMPORTANT: 1 };
    const regionCompletedSet = new Set(completedCategories.map((c) => (c || "").toUpperCase()));
    const regionByCategory = new Map<string, typeof scored>();
    for (const p of scored) {
      if (dismissedProviderIds.has(p.id)) continue;
      const cat = (p.category || "").toUpperCase();
      if (!cat || regionCompletedSet.has(cat) || !REGION_GROUP_TIERS.has(p.urgencyTier)) continue;
      const arr = regionByCategory.get(cat) ?? [];
      arr.push(p);
      regionByCategory.set(cat, arr);
    }
    const regionGroups = [...regionByCategory.entries()]
      .map(([category, providers]) => {
        const top = [...providers]
          .sort((a, b) => b.recommendationScore - a.recommendationScore)
          .slice(0, REGION_GROUP_PER_CATEGORY);
        return {
          category,
          label: getMergedDisplayCategoryLabel(category),
          tier: top[0]?.urgencyTier ?? ("IMPORTANT" as UrgencyTier),
          providers: top,
        };
      })
      .sort((a, b) => {
        const t = (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9);
        return t !== 0 ? t : getMergedDisplayCategoryOrder(a.category) - getMergedDisplayCategoryOrder(b.category);
      });

    const regionCity = primaryAddr?.city?.trim() || null;
    const regionState = (primaryAddr?.state?.trim().toUpperCase() || effectiveState) || null;
    const region = {
      city: regionCity,
      state: regionState,
      label: regionCity && regionState ? `${regionCity}, ${regionState}` : regionState || null,
    };

    const recommendationGuide = buildRecommendationGuide({
      scored,
      nextCriticalActions: Array.isArray(result.nextCriticalActions) ? result.nextCriticalActions : [],
      regionGroups,
      savedProviderIds,
      missingCritical: Array.isArray(result.stats?.missingCritical) ? result.stats.missingCritical : [],
      completedCritical: Number(result.stats?.completedCritical) || 0,
      completedCategories,
      serviceCount: services.length,
      dismissedCount: dismissedProviderIds.size,
      profile,
      userProfile,
      regionLabel: region.label,
      stateRuleAvailable: Boolean(stateRule?.dmvRules || stateRule?.voterRegistration || stateRule?.taxInfo),
      coordinatesUsed: fallbackLatitude !== null && fallbackLongitude !== null,
      fccStatus: serviceability.fcc.status,
      electricStatus: serviceability.electric.status,
    });

    // Fire-and-forget integration telemetry (synchronous in-process buffer —
    // never throws, never adds latency). Mirrors the fcc/electric statuses
    // reported in `meta` below so per-day IntegrationDailyStat counters track
    // how often each lookup is ok / not_configured / skipped / erroring.
    recordIntegrationOutcomes({
      fcc: serviceability.fcc.status,
      electric: serviceability.electric.status,
    });

    return NextResponse.json({
      ...result,
      region,
      regionGroups,
      savedProviderIds: [...savedProviderIds],
      recommendationGuide,
      meta: {
        state: effectiveState,
        requestedState: requestedState || null,
        requestedZip: requestedZip || null,
        zipMatchLevel: tiered.zipMatchLevel,
        addressCoordinatesUsed: fallbackLatitude !== null && fallbackLongitude !== null,
        coverageModels: {
          polygon: parsedProviders.filter((provider) => provider.coverageModel === "polygon").length,
          liveAddress: parsedProviders.filter((provider) => provider.coverageModel === "live_address").length,
          zipPrefix: parsedProviders.filter((provider) => provider.coverageModel === "zip_prefix").length,
        },
        // FCC ISP serviceability telemetry. `status` is one of the
        // FccLookupStatus values; "not_configured" is the default until the
        // owner sets FCC_BDC_ENABLED + FCC_BDC_API_KEY (see lib/fcc-isp.ts).
        // `confirmedCount` is how many internet providers FCC confirmed at the
        // address. Never user-facing copy — for dashboards / debugging only.
        fcc: serviceability.fcc,
        // Electric-utility serviceability telemetry, mirroring `fcc` above.
        // `status` is one of the ElectricLookupStatus values; "not_configured"
        // is the default until the owner sets ELECTRIC_LOOKUP_ENABLED +
        // OPENEI_API_KEY (see lib/electric-utility.ts). `confirmedCount` is how
        // many electric providers were confirmed at the address. Never
        // user-facing copy — for dashboards / debugging only.
        electric: serviceability.electric,
        sourceGaps: serviceability.sourceGaps,
        addressId: primaryAddr?.id || null,
        currentPhase,
        totalServices: services.length,
        completedCategories,
        moveDate: movingPlan?.moveDate || null,
        stateRule: stateRule ? {
          stateCode: stateRule.stateCode,
          stateName: stateRule.stateName,
          dmvRules: stateRule.dmvRules,
          voterRegistration: stateRule.voterRegistration,
          taxInfo: stateRule.taxInfo,
        } : null,
      },
    });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to generate recommendations:", error);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}

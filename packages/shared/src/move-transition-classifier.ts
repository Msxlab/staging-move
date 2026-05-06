import {
  compareCoverageConfidence,
  getCoverageConfidencePresentation,
  getMoveTransitionActionPresentation,
  isCoverageAddressSensitive,
  mapCoverageMatchToConfidence,
  type CoverageConfidence,
  type MoveTransitionActionType,
  type MoveTaskEffectType,
  type TaskSourceConfidence,
  type UserCustomProviderType,
} from "./provider-move-domain";
import { safeJsonArray, resolveEffectiveState } from "./provider-coverage";
import { isProviderResourceOnly, providerRequiresAddressCheck } from "./provider-integrity";

export interface MoveTransitionAddressInput {
  state?: string | null;
  zip?: string | null;
}

export interface MoveTransitionServiceInput {
  id?: string | null;
  name?: string | null;
  category: string;
  providerId?: string | null;
  customProviderId?: string | null;
  customProviderType?: UserCustomProviderType | string | null;
  providerName?: string | null;
}

export interface MoveTransitionProviderInput {
  id?: string | null;
  name: string;
  category: string;
  subCategory?: string | null;
  scope?: string | null;
  states?: string[] | string | null;
  tags?: string[] | string | null;
  coverageConfidence?: CoverageConfidence | null;
  coverageMatchLevel?: string | null;
  coverageModel?: string | null;
  requiresAddressCheck?: boolean | null;
  requiresPolygonCheck?: boolean | null;
  resourceOnly?: boolean | null;
  popularityScore?: number | null;
  trustStatus?: string | null;
  providerType?: UserCustomProviderType | string | null;
}

export interface MoveTransitionClassifierInput {
  service: MoveTransitionServiceInput;
  currentProvider?: MoveTransitionProviderInput | null;
  originAddress?: MoveTransitionAddressInput | null;
  destinationAddress?: MoveTransitionAddressInput | null;
  destinationProviderCandidates?: MoveTransitionProviderInput[] | null;
  stateRuleContext?: {
    hasDmvRules?: boolean | null;
    hasVoterRules?: boolean | null;
    hasUtilityInfo?: boolean | null;
    hasInsuranceRules?: boolean | null;
  } | null;
}

export interface MoveTransitionProviderRecommendation {
  id?: string | null;
  name: string;
  category: string;
  coverageConfidence: CoverageConfidence;
  coverageLabel: string;
  requiresAddressCheck: boolean;
  resourceOnly: boolean;
}

export interface MoveServiceTransitionPlan {
  serviceId?: string | null;
  serviceCategory: string;
  actionType: MoveTransitionActionType;
  actionLabel: string;
  confidence: TaskSourceConfidence;
  primaryReason: string;
  caveats: string[];
  suggestedNextStep: string;
  oldProviderAction?: MoveTransitionActionType;
  destinationProviderAction?: MoveTransitionActionType;
  secondaryActions: MoveTransitionActionType[];
  taskEffectType: MoveTaskEffectType;
  addressContext: "OLD_ADDRESS" | "NEW_ADDRESS" | "BOTH_ADDRESSES" | "GENERAL";
  destinationProviderCandidates: MoveTransitionProviderRecommendation[];
  userFacingCopy: string;
  adminExplanation: string;
}

const HIGH_CONFIDENCE_COVERAGE = new Set<CoverageConfidence>([
  "EXACT_ZIP",
  "ZIP_PREFIX",
  "MAPPED_SERVICE_AREA",
]);

const UTILITY_START_STOP_CATEGORIES = new Set([
  "UTILITY_ELECTRIC",
  "UTILITY_GAS",
  "UTILITY_WATER",
  "UTILITY_SEWER",
  "UTILITY_TRASH",
]);

function normalizeCategory(category: string | null | undefined): string {
  return (category || "").trim().toUpperCase();
}

function normalizeName(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeState(value: string | null | undefined): string | undefined {
  const clean = value?.trim().toUpperCase();
  return clean || undefined;
}

function getCandidateCoverageConfidence(
  candidate: MoveTransitionProviderInput,
): CoverageConfidence {
  return (
    candidate.coverageConfidence ||
    mapCoverageMatchToConfidence(candidate.coverageMatchLevel, {
      scope: candidate.scope,
      coverageModel: candidate.coverageModel,
      requiresAddressCheck: providerRequiresAddressCheck(candidate),
      requiresPolygonCheck: candidate.requiresPolygonCheck,
    })
  );
}

function providerCoversDestinationState(
  provider: MoveTransitionProviderInput | null | undefined,
  destinationState?: string,
): boolean {
  if (!provider || !destinationState) return false;
  if (provider.scope === "FEDERAL") return true;
  const states = safeJsonArray(provider.states).map((state) => state.toUpperCase());
  return states.includes(destinationState);
}

function isSameProvider(
  service: MoveTransitionServiceInput,
  provider: MoveTransitionProviderInput,
): boolean {
  if (service.providerId && provider.id && service.providerId === provider.id) {
    return true;
  }
  const serviceProviderName = normalizeName(service.providerName);
  return Boolean(serviceProviderName && serviceProviderName === normalizeName(provider.name));
}

function isFinancialAddressUpdate(category: string): boolean {
  return (
    category === "FINANCIAL_BANK" ||
    category === "FINANCIAL_CREDIT_CARD" ||
    category === "FINANCIAL_FINTECH"
  );
}

function isInsurance(category: string): boolean {
  return category.startsWith("FINANCIAL_INSURANCE");
}

function isGovernmentUpdate(category: string): boolean {
  return (
    category.startsWith("GOVERNMENT_DMV") ||
    category.startsWith("GOVERNMENT_VOTER") ||
    category.startsWith("GOVERNMENT_TAX") ||
    category.startsWith("GOVERNMENT_BENEFITS") ||
    category.startsWith("GOVERNMENT_HEALTH") ||
    category.startsWith("GOVERNMENT_IMMIGRATION")
  );
}

function isMailForwarding(category: string): boolean {
  return category === "GOVERNMENT_POSTAL";
}

function isSubscriptionAddressUpdate(category: string): boolean {
  return category.startsWith("SHOPPING_");
}

function isLocalOrMembership(category: string): boolean {
  return (
    category.startsWith("LOCAL_") ||
    category === "FITNESS_GYM" ||
    category === "TRANSPORTATION_PARKING" ||
    category === "HOUSING_HOA"
  );
}

function isHealthcareOrProfessional(category: string): boolean {
  return (
    category.startsWith("HEALTHCARE_") ||
    category.startsWith("LEGAL_") ||
    category === "PET_SERVICES" ||
    category === "KIDS_DAYCARE" ||
    category === "KIDS_SCHOOL"
  );
}

function isUserCustomService(
  service: MoveTransitionServiceInput,
  provider: MoveTransitionProviderInput | null,
): boolean {
  return Boolean(
    service.customProviderId ||
      service.customProviderType ||
      provider?.trustStatus === "USER_CUSTOM" ||
      provider?.providerType,
  );
}

function getTaskEffectType(actionType: MoveTransitionActionType): MoveTaskEffectType {
  if (actionType === "STOP_SERVICE" || actionType === "CANCEL_OR_CLOSE") {
    return "CLOSE_OLD_SERVICE";
  }
  if (actionType === "START_SERVICE" || actionType === "SHOP_PROVIDER" || actionType === "FIND_REPLACEMENT") {
    return "CREATE_DESTINATION_SERVICE";
  }
  if (actionType === "TRANSFER_SERVICE") return "UPDATE_SERVICE_ADDRESS";
  if (actionType === "UPDATE_ADDRESS") return "MARK_ADDRESS_UPDATED";
  if (actionType === "VERIFY_AVAILABILITY") {
    return "MARK_AVAILABILITY_VERIFIED_BY_USER";
  }
  return "NO_LOCAL_STATE_CHANGE";
}

function getAddressContext(
  actionType: MoveTransitionActionType,
): MoveServiceTransitionPlan["addressContext"] {
  if (actionType === "STOP_SERVICE" || actionType === "CANCEL_OR_CLOSE") {
    return "OLD_ADDRESS";
  }
  if (actionType === "START_SERVICE" || actionType === "FIND_REPLACEMENT" || actionType === "SHOP_PROVIDER") {
    return "NEW_ADDRESS";
  }
  if (actionType === "TRANSFER_SERVICE") return "BOTH_ADDRESSES";
  return "GENERAL";
}

function buildProviderRecommendation(
  provider: MoveTransitionProviderInput,
): MoveTransitionProviderRecommendation {
  const coverageConfidence = getCandidateCoverageConfidence(provider);
  return {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    coverageConfidence,
    coverageLabel: getCoverageConfidencePresentation(coverageConfidence).label,
    requiresAddressCheck:
      providerRequiresAddressCheck(provider) ||
      coverageConfidence === "ADDRESS_CHECK_REQUIRED",
    resourceOnly: isProviderResourceOnly(provider),
  };
}

function sortCandidates(
  candidates: MoveTransitionProviderInput[],
): MoveTransitionProviderInput[] {
  return [...candidates].sort((a, b) => {
    const byCoverage = compareCoverageConfidence(
      getCandidateCoverageConfidence(a),
      getCandidateCoverageConfidence(b),
    );
    if (byCoverage !== 0) return byCoverage;
    return (b.popularityScore || 0) - (a.popularityScore || 0);
  });
}

function buildPlan(
  input: {
    service: MoveTransitionServiceInput;
    actionType: MoveTransitionActionType;
    confidence: TaskSourceConfidence;
    primaryReason: string;
    suggestedNextStep: string;
    caveats?: string[];
    oldProviderAction?: MoveTransitionActionType;
    destinationProviderAction?: MoveTransitionActionType;
    secondaryActions?: MoveTransitionActionType[];
    candidates?: MoveTransitionProviderInput[];
    adminExplanation?: string;
  },
): MoveServiceTransitionPlan {
  const action = getMoveTransitionActionPresentation(input.actionType);
  const caveats = [
    ...(input.caveats || []),
    "Manual guidance only. LocateFlow does not update provider accounts or execute address changes.",
  ];
  const destinationProviderCandidates = (input.candidates || [])
    .slice(0, 5)
    .map(buildProviderRecommendation);

  return {
    serviceId: input.service.id,
    serviceCategory: normalizeCategory(input.service.category),
    actionType: input.actionType,
    actionLabel: action.label,
    confidence: input.confidence,
    primaryReason: input.primaryReason,
    caveats,
    suggestedNextStep: input.suggestedNextStep,
    oldProviderAction: input.oldProviderAction,
    destinationProviderAction: input.destinationProviderAction,
    secondaryActions: input.secondaryActions || [],
    taskEffectType: getTaskEffectType(input.actionType),
    addressContext: getAddressContext(input.actionType),
    destinationProviderCandidates,
    userFacingCopy: `${action.label}: ${input.suggestedNextStep}`,
    adminExplanation:
      input.adminExplanation ||
      `${input.primaryReason} This is classifier guidance, not automation.`,
  };
}

export function classifyMoveServiceTransition(
  input: MoveTransitionClassifierInput,
): MoveServiceTransitionPlan {
  const service = input.service;
  const category = normalizeCategory(service.category);
  const originState = resolveEffectiveState(
    normalizeState(input.originAddress?.state),
    input.originAddress?.zip,
  );
  const destinationState = resolveEffectiveState(
    normalizeState(input.destinationAddress?.state),
    input.destinationAddress?.zip,
  );
  const sameState = Boolean(originState && destinationState && originState === destinationState);
  const allCategoryCandidates = sortCandidates(
    (input.destinationProviderCandidates || []).filter(
      (candidate) => normalizeCategory(candidate.category) === category,
    ),
  );
  const categoryCandidates = allCategoryCandidates.filter(
    (candidate) => !isProviderResourceOnly(candidate),
  );
  const resourceCandidates = allCategoryCandidates.filter(isProviderResourceOnly);
  const sameProviderCandidate = categoryCandidates.find((candidate) =>
    isSameProvider(service, candidate),
  );
  const currentProvider = input.currentProvider || sameProviderCandidate || null;
  const userCustomService = isUserCustomService(service, currentProvider);
  const sameProviderConfidence = sameProviderCandidate
    ? getCandidateCoverageConfidence(sameProviderCandidate)
    : currentProvider && providerCoversDestinationState(currentProvider, destinationState)
      ? getCandidateCoverageConfidence(currentProvider)
      : "UNKNOWN";
  const strongCandidates = categoryCandidates.filter((candidate) =>
    HIGH_CONFIDENCE_COVERAGE.has(getCandidateCoverageConfidence(candidate)),
  );

  if (userCustomService && isHealthcareOrProfessional(category)) {
    return buildPlan({
      service,
      actionType: sameState ? "VERIFY_AVAILABILITY" : "FIND_REPLACEMENT",
      confidence: "MEDIUM",
      primaryReason: sameState
        ? "This user-added professional or healthcare provider may still be useful after a same-state move."
        : "This user-added professional or healthcare provider is location-sensitive and may need replacement near the destination.",
      suggestedNextStep: sameState
        ? "Confirm whether the provider still works for the destination address and update local notes."
        : "Find a destination provider if continuing care or local service is needed.",
      caveats: [
        "User-added providers are private records and are not source-verified catalog providers.",
      ],
    });
  }

  if (isMailForwarding(category)) {
    return buildPlan({
      service,
      actionType: "MAIL_FORWARDING",
      confidence: "MEDIUM",
      primaryReason: "Mail and postal services usually need a manual forwarding or mailing-address update.",
      suggestedNextStep: "Set up mail forwarding or update the mailing address directly.",
      caveats: ["No USPS connector or automatic mail-forwarding execution is included."],
    });
  }

  if (isGovernmentUpdate(category)) {
    return buildPlan({
      service,
      actionType: "GOVERNMENT_UPDATE",
      confidence: "MEDIUM",
      primaryReason: sameState
        ? "This government category still may require an address update after a same-state move."
        : "Interstate moves usually require destination-state government updates.",
      suggestedNextStep: "Use the destination state's official government instructions.",
      caveats: ["Confirm the official state process and deadline."],
    });
  }

  if (isInsurance(category)) {
    return buildPlan({
      service,
      actionType: "INSURANCE_REQUOTE",
      confidence: sameState ? "MEDIUM" : "HIGH",
      primaryReason: sameState
        ? "Insurance may still need an address update and coverage review."
        : "Interstate moves can change insurance coverage, pricing, and eligibility.",
      suggestedNextStep: "Contact the insurer to update the address and requote coverage.",
      secondaryActions: ["UPDATE_ADDRESS"],
    });
  }

  if (isFinancialAddressUpdate(category) || isSubscriptionAddressUpdate(category)) {
    return buildPlan({
      service,
      actionType: "UPDATE_ADDRESS",
      confidence: "HIGH",
      primaryReason: "This category is generally account-address based rather than service-territory based.",
      suggestedNextStep: "Update the mailing, billing, or account address manually.",
    });
  }

  if (isLocalOrMembership(category)) {
    return buildPlan({
      service,
      actionType: sameState ? "VERIFY_AVAILABILITY" : "CANCEL_OR_CLOSE",
      confidence: "MEDIUM",
      primaryReason: sameState
        ? "Local services may or may not still be useful after a same-state move."
        : "This service appears local or membership-based and may not apply at the destination.",
      suggestedNextStep: sameState
        ? "Confirm whether the service still applies after the move."
        : "Cancel or close the old service and look for a replacement if needed.",
      oldProviderAction: sameState ? undefined : "CANCEL_OR_CLOSE",
    });
  }

  if (sameProviderCandidate) {
    if (sameProviderConfidence === "EXACT_ZIP") {
      const actionType: MoveTransitionActionType = isCoverageAddressSensitive(category)
        ? "VERIFY_AVAILABILITY"
        : "TRANSFER_SERVICE";
      return buildPlan({
        service,
        actionType,
        confidence: "HIGH",
        primaryReason: "The current provider has the strongest available catalog match at the destination ZIP.",
        suggestedNextStep:
          actionType === "TRANSFER_SERVICE"
            ? "Ask the provider whether this service can be transferred to the destination address."
            : "Confirm address-level serviceability with the provider before planning a transfer.",
        secondaryActions: actionType === "TRANSFER_SERVICE" ? ["VERIFY_AVAILABILITY"] : [],
        candidates: [sameProviderCandidate],
      });
    }

    if (sameProviderConfidence === "ZIP_PREFIX" || sameProviderConfidence === "MAPPED_SERVICE_AREA") {
      return buildPlan({
        service,
        actionType: "VERIFY_AVAILABILITY",
        confidence: "MEDIUM",
        primaryReason: "The current provider has a partial destination coverage signal.",
        suggestedNextStep: "Verify destination address availability before assuming service can continue.",
        secondaryActions: ["TRANSFER_SERVICE"],
        candidates: [sameProviderCandidate],
      });
    }

    return buildPlan({
      service,
      actionType: "VERIFY_AVAILABILITY",
      confidence: "LOW",
      primaryReason: "The same provider is listed for the destination only through broad or unverified coverage.",
      suggestedNextStep: "Confirm directly with the provider before treating this as transferable.",
      candidates: [sameProviderCandidate],
    });
  }

  if (UTILITY_START_STOP_CATEGORIES.has(category)) {
    if (strongCandidates.length === 1) {
      return buildPlan({
        service,
        actionType: "START_SERVICE",
        confidence: "MEDIUM",
        primaryReason: "The old provider does not appear to cover the destination, and one stronger local candidate exists.",
        suggestedNextStep: "Stop the old service and contact the destination provider to start service.",
        oldProviderAction: "STOP_SERVICE",
        destinationProviderAction: "START_SERVICE",
        secondaryActions: ["VERIFY_AVAILABILITY"],
        candidates: strongCandidates,
      });
    }

    if (categoryCandidates.length > 1) {
      return buildPlan({
        service,
        actionType: "SHOP_PROVIDER",
        confidence: "MEDIUM",
        primaryReason: "The old provider does not appear to cover the destination, and multiple destination candidates exist.",
        suggestedNextStep: "Stop the old service and compare destination provider options using official sources.",
        oldProviderAction: "STOP_SERVICE",
        destinationProviderAction: "SHOP_PROVIDER",
        secondaryActions: ["VERIFY_AVAILABILITY"],
        candidates: categoryCandidates,
      });
    }

    if (resourceCandidates.length > 0 && categoryCandidates.length === 0) {
      return buildPlan({
        service,
        actionType: "FIND_REPLACEMENT",
        confidence: "LOW",
        primaryReason: "Only official resource or directory listings are available for this destination utility category.",
        suggestedNextStep: "Stop the old service and use the official resource to verify the correct destination provider for the exact address.",
        oldProviderAction: "STOP_SERVICE",
        secondaryActions: ["VERIFY_AVAILABILITY"],
        candidates: resourceCandidates,
        caveats: [
          "Resource-only listings are verification aids and should not be added as the biller unless the user confirms the actual provider.",
        ],
      });
    }

    return buildPlan({
      service,
      actionType: "FIND_REPLACEMENT",
      confidence: "LOW",
      primaryReason: "The old provider does not appear to cover the destination, and no catalog candidate is available.",
      suggestedNextStep: "Stop the old service and use official local or state sources to find the destination provider.",
      oldProviderAction: "STOP_SERVICE",
      candidates: categoryCandidates,
    });
  }

  if (category === "UTILITY_INTERNET" || category === "UTILITY_PHONE") {
    if (strongCandidates.length > 1) {
      return buildPlan({
        service,
        actionType: "SHOP_PROVIDER",
        confidence: "MEDIUM",
        primaryReason: "Multiple destination candidates exist for an address-sensitive service.",
        suggestedNextStep: "Compare provider availability and plans for the destination address.",
        secondaryActions: ["VERIFY_AVAILABILITY"],
        candidates: categoryCandidates,
      });
    }

    if (strongCandidates.length === 1) {
      return buildPlan({
        service,
        actionType: "VERIFY_AVAILABILITY",
        confidence: "MEDIUM",
        primaryReason: "A destination candidate exists, but internet and phone service are address-sensitive.",
        suggestedNextStep: "Run the provider's official address availability check.",
        candidates: strongCandidates,
      });
    }

    if (resourceCandidates.length > 0 && categoryCandidates.length === 0) {
      return buildPlan({
        service,
        actionType: "FIND_REPLACEMENT",
        confidence: "LOW",
        primaryReason: "Only official broadband or phone lookup resources are available for this destination.",
        suggestedNextStep: "Use the official lookup resource and then verify service at the exact address with the selected provider.",
        secondaryActions: ["VERIFY_AVAILABILITY"],
        candidates: resourceCandidates,
        caveats: [
          "Resource-only listings help with verification and should not be treated as confirmed service providers.",
        ],
      });
    }
  }

  if (categoryCandidates.length === 1) {
    return buildPlan({
      service,
      actionType: "START_SERVICE",
      confidence: "LOW",
      primaryReason: "One destination provider candidate exists, but coverage is not source-verified.",
      suggestedNextStep: "Confirm the provider is right for the destination before adding it as a service.",
      secondaryActions: ["VERIFY_AVAILABILITY"],
      candidates: categoryCandidates,
    });
  }

  if (categoryCandidates.length > 1) {
    return buildPlan({
      service,
      actionType: "SHOP_PROVIDER",
      confidence: "LOW",
      primaryReason: "Multiple destination provider candidates exist, but the catalog cannot choose for the user.",
      suggestedNextStep: "Compare candidates and confirm availability through official provider sources.",
      secondaryActions: ["VERIFY_AVAILABILITY"],
      candidates: categoryCandidates,
    });
  }

  return buildPlan({
    service,
    actionType: "FIND_REPLACEMENT",
    confidence: "LOW",
    primaryReason: "No destination provider candidate is available in the catalog.",
    suggestedNextStep: "Use official local or state sources to find the right destination provider.",
  });
}

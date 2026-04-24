export const PROVIDER_TRUST_STATUSES = [
  "LISTED",
  "UNVERIFIED",
  "USER_CUSTOM",
  "SOURCE_REVIEW_PENDING",
  "SOURCE_VERIFIED",
  "OFFICIAL_PARTNER",
] as const;

export type ProviderTrustStatus = (typeof PROVIDER_TRUST_STATUSES)[number];

export const COVERAGE_CONFIDENCE_LEVELS = [
  "EXACT_ZIP",
  "ZIP_PREFIX",
  "MAPPED_SERVICE_AREA",
  "STATE_LEVEL",
  "NATIONAL_OR_FEDERAL",
  "ADDRESS_CHECK_REQUIRED",
  "UNKNOWN",
] as const;

export type CoverageConfidence = (typeof COVERAGE_CONFIDENCE_LEVELS)[number];

export const MOVE_TRANSITION_ACTION_TYPES = [
  "STOP_SERVICE",
  "START_SERVICE",
  "TRANSFER_SERVICE",
  "UPDATE_ADDRESS",
  "VERIFY_AVAILABILITY",
  "SHOP_PROVIDER",
  "FIND_REPLACEMENT",
  "CANCEL_OR_CLOSE",
  "GOVERNMENT_UPDATE",
  "INSURANCE_REQUOTE",
  "MAIL_FORWARDING",
  "NO_ACTION",
] as const;

export type MoveTransitionActionType =
  (typeof MOVE_TRANSITION_ACTION_TYPES)[number];

export const TASK_SOURCE_CONFIDENCE_LEVELS = [
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNVERIFIED",
] as const;

export type TaskSourceConfidence =
  (typeof TASK_SOURCE_CONFIDENCE_LEVELS)[number];

export type Confidence = TaskSourceConfidence;

export const MOVE_TASK_STATUSES = [
  "SUGGESTED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DISMISSED",
  "REOPENED",
] as const;

export type MoveTaskStatus = (typeof MOVE_TASK_STATUSES)[number];

export const MOVE_TASK_SOURCES = [
  "CLASSIFIER",
  "USER",
  "ADMIN",
  "IMPORT",
  "SYSTEM",
] as const;

export type MoveTaskSource = (typeof MOVE_TASK_SOURCES)[number];

export const MOVE_TASK_EFFECT_TYPES = [
  "CLOSE_OLD_SERVICE",
  "CREATE_DESTINATION_SERVICE",
  "LINK_DESTINATION_PROVIDER",
  "UPDATE_SERVICE_ADDRESS",
  "MARK_ADDRESS_UPDATED",
  "MARK_AVAILABILITY_VERIFIED_BY_USER",
  "NO_LOCAL_STATE_CHANGE",
] as const;

export type MoveTaskEffectType = (typeof MOVE_TASK_EFFECT_TYPES)[number];

export const CURRENT_PRODUCT_COPY_KEYS = [
  "LISTED_PROVIDER",
  "USER_ADDED_PROVIDER",
  "AVAILABILITY_MAY_VARY",
  "CONFIRM_WITH_OFFICIAL_PROVIDER",
  "MANUAL_TRACKING_ONLY",
  "NO_AUTOMATIC_ACCOUNT_UPDATE",
  "TASK_COMPLETION_UPDATES_LOCATEFLOW_ONLY",
] as const;

export type CurrentProductCopyKey =
  (typeof CURRENT_PRODUCT_COPY_KEYS)[number];

export interface ProviderTrustPresentation {
  status: ProviderTrustStatus;
  label: string;
  description: string;
  canClaimVerified: boolean;
}

export interface CoverageConfidencePresentation {
  confidence: CoverageConfidence;
  label: string;
  description: string;
  rank: number;
  requiresCaveat: boolean;
}

export interface MoveTransitionActionPresentation {
  action: MoveTransitionActionType;
  label: string;
  description: string;
}

export interface MoveTaskStatusPresentation {
  status: MoveTaskStatus;
  label: string;
  description: string;
}

export interface MoveTaskSourcePresentation {
  source: MoveTaskSource;
  label: string;
  description: string;
}

export interface MoveTaskEffectPresentation {
  effect: MoveTaskEffectType;
  label: string;
  description: string;
}

export const DEFAULT_PROVIDER_TRUST_STATUS: ProviderTrustStatus = "LISTED";
export const DEFAULT_COVERAGE_CONFIDENCE: CoverageConfidence = "UNKNOWN";

const PROVIDER_TRUST_COPY: Record<ProviderTrustStatus, ProviderTrustPresentation> =
  {
    LISTED: {
      status: "LISTED",
      label: "Listed provider",
      description:
        "This provider is listed for manual tracking. Confirm details with the provider before acting.",
      canClaimVerified: false,
    },
    UNVERIFIED: {
      status: "UNVERIFIED",
      label: "Unverified listing",
      description:
        "This provider data has not been source-verified. Confirm details with the official provider.",
      canClaimVerified: false,
    },
    USER_CUSTOM: {
      status: "USER_CUSTOM",
      label: "User-added provider",
      description:
        "This is a private provider record added by the user for manual tracking.",
      canClaimVerified: false,
    },
    SOURCE_REVIEW_PENDING: {
      status: "SOURCE_REVIEW_PENDING",
      label: "Source review pending",
      description:
        "This listing needs official-source review before any verification claim can be made.",
      canClaimVerified: false,
    },
    SOURCE_VERIFIED: {
      status: "SOURCE_VERIFIED",
      label: "Source verified",
      description:
        "This status requires source-backed provider evidence. Availability may still vary by address.",
      canClaimVerified: true,
    },
    OFFICIAL_PARTNER: {
      status: "OFFICIAL_PARTNER",
      label: "Official partner",
      description:
        "This status requires approved partner data and should not be used for ordinary directory listings.",
      canClaimVerified: true,
    },
  };

const COVERAGE_CONFIDENCE_COPY: Record<
  CoverageConfidence,
  CoverageConfidencePresentation
> = {
  EXACT_ZIP: {
    confidence: "EXACT_ZIP",
    label: "Exact ZIP match",
    description:
      "The provider has catalog coverage for this ZIP. Confirm service at the exact address.",
    rank: 600,
    requiresCaveat: true,
  },
  ZIP_PREFIX: {
    confidence: "ZIP_PREFIX",
    label: "ZIP prefix match",
    description:
      "The provider has catalog coverage for the ZIP prefix. Availability may vary by address.",
    rank: 500,
    requiresCaveat: true,
  },
  MAPPED_SERVICE_AREA: {
    confidence: "MAPPED_SERVICE_AREA",
    label: "Mapped service area",
    description:
      "The provider has mapped service-area metadata. Confirm address-level availability.",
    rank: 400,
    requiresCaveat: true,
  },
  STATE_LEVEL: {
    confidence: "STATE_LEVEL",
    label: "State-level listing",
    description:
      "The provider is listed for this state. This is not proof of service at the address.",
    rank: 300,
    requiresCaveat: true,
  },
  NATIONAL_OR_FEDERAL: {
    confidence: "NATIONAL_OR_FEDERAL",
    label: "National listing",
    description:
      "The provider is listed nationally or federally. Address-specific services still require confirmation.",
    rank: 200,
    requiresCaveat: true,
  },
  ADDRESS_CHECK_REQUIRED: {
    confidence: "ADDRESS_CHECK_REQUIRED",
    label: "Address check required",
    description:
      "The provider requires an address-level availability check before relying on this listing.",
    rank: 100,
    requiresCaveat: true,
  },
  UNKNOWN: {
    confidence: "UNKNOWN",
    label: "Coverage unverified",
    description:
      "Coverage confidence is unknown. Confirm availability with the provider.",
    rank: 0,
    requiresCaveat: true,
  },
};

const MOVE_TASK_STATUS_COPY: Record<
  MoveTaskStatus,
  MoveTaskStatusPresentation
> = {
  SUGGESTED: {
    status: "SUGGESTED",
    label: "Suggested",
    description:
      "LocateFlow suggested this task from move context and provider data.",
  },
  ACCEPTED: {
    status: "ACCEPTED",
    label: "Accepted",
    description: "The user accepted this task as part of their move plan.",
  },
  IN_PROGRESS: {
    status: "IN_PROGRESS",
    label: "In progress",
    description: "The user is working on this task.",
  },
  COMPLETED: {
    status: "COMPLETED",
    label: "Completed",
    description:
      "The task is complete inside LocateFlow. No external provider update is implied.",
  },
  DISMISSED: {
    status: "DISMISSED",
    label: "Dismissed",
    description: "The user dismissed this task.",
  },
  REOPENED: {
    status: "REOPENED",
    label: "Reopened",
    description: "The task was reopened after being dismissed or completed.",
  },
};

const MOVE_TASK_SOURCE_COPY: Record<
  MoveTaskSource,
  MoveTaskSourcePresentation
> = {
  CLASSIFIER: {
    source: "CLASSIFIER",
    label: "Classifier",
    description: "Suggested by deterministic LocateFlow move logic.",
  },
  USER: {
    source: "USER",
    label: "User",
    description: "Created by the user.",
  },
  ADMIN: {
    source: "ADMIN",
    label: "Admin",
    description: "Created by an authorized admin operator.",
  },
  IMPORT: {
    source: "IMPORT",
    label: "Import",
    description: "Created from imported data.",
  },
  SYSTEM: {
    source: "SYSTEM",
    label: "System",
    description: "Created by LocateFlow system behavior.",
  },
};

const MOVE_TASK_EFFECT_COPY: Record<
  MoveTaskEffectType,
  MoveTaskEffectPresentation
> = {
  CLOSE_OLD_SERVICE: {
    effect: "CLOSE_OLD_SERVICE",
    label: "Close old service locally",
    description:
      "Marks the old service closed in LocateFlow only. The external provider is not changed.",
  },
  CREATE_DESTINATION_SERVICE: {
    effect: "CREATE_DESTINATION_SERVICE",
    label: "Create destination service",
    description:
      "Creates a LocateFlow service record for the destination address.",
  },
  LINK_DESTINATION_PROVIDER: {
    effect: "LINK_DESTINATION_PROVIDER",
    label: "Link destination provider",
    description:
      "Links a LocateFlow service or task to a listed or user-added provider.",
  },
  UPDATE_SERVICE_ADDRESS: {
    effect: "UPDATE_SERVICE_ADDRESS",
    label: "Update service address locally",
    description:
      "Updates LocateFlow local service state without updating any external provider account.",
  },
  MARK_ADDRESS_UPDATED: {
    effect: "MARK_ADDRESS_UPDATED",
    label: "Mark address update done",
    description:
      "Records that the user completed an address update outside LocateFlow.",
  },
  MARK_AVAILABILITY_VERIFIED_BY_USER: {
    effect: "MARK_AVAILABILITY_VERIFIED_BY_USER",
    label: "Mark user-confirmed availability",
    description:
      "Records user confirmation. It is not official source verification.",
  },
  NO_LOCAL_STATE_CHANGE: {
    effect: "NO_LOCAL_STATE_CHANGE",
    label: "No local state change",
    description: "Completing this task only updates the task status and notes.",
  },
};

const CURRENT_PRODUCT_COPY: Record<CurrentProductCopyKey, string> = {
  LISTED_PROVIDER: "Listed provider",
  USER_ADDED_PROVIDER: "User-added provider",
  AVAILABILITY_MAY_VARY: "Availability may vary by address.",
  CONFIRM_WITH_OFFICIAL_PROVIDER: "Confirm with the official provider.",
  MANUAL_TRACKING_ONLY: "Manual tracking only.",
  NO_AUTOMATIC_ACCOUNT_UPDATE: "No automatic account update.",
  TASK_COMPLETION_UPDATES_LOCATEFLOW_ONLY:
    "Task completion updates LocateFlow only.",
};

const MOVE_TRANSITION_ACTION_COPY: Record<
  MoveTransitionActionType,
  MoveTransitionActionPresentation
> = {
  STOP_SERVICE: {
    action: "STOP_SERVICE",
    label: "Stop old service",
    description: "Schedule or complete service stop at the origin address.",
  },
  START_SERVICE: {
    action: "START_SERVICE",
    label: "Start destination service",
    description: "Start or schedule service at the destination address.",
  },
  TRANSFER_SERVICE: {
    action: "TRANSFER_SERVICE",
    label: "Transfer service",
    description:
      "The same provider may support the destination, but the user must confirm.",
  },
  UPDATE_ADDRESS: {
    action: "UPDATE_ADDRESS",
    label: "Update address",
    description: "Update billing, mailing, or account address manually.",
  },
  VERIFY_AVAILABILITY: {
    action: "VERIFY_AVAILABILITY",
    label: "Verify availability",
    description:
      "Confirm destination address availability before relying on this provider.",
  },
  SHOP_PROVIDER: {
    action: "SHOP_PROVIDER",
    label: "Compare providers",
    description: "Compare destination provider candidates before choosing.",
  },
  FIND_REPLACEMENT: {
    action: "FIND_REPLACEMENT",
    label: "Find replacement",
    description:
      "No strong catalog candidate is available; use official sources for manual research.",
  },
  CANCEL_OR_CLOSE: {
    action: "CANCEL_OR_CLOSE",
    label: "Cancel or close",
    description: "Cancel a local membership or close a location-bound service.",
  },
  GOVERNMENT_UPDATE: {
    action: "GOVERNMENT_UPDATE",
    label: "Government update",
    description: "Complete the relevant state or government move update.",
  },
  INSURANCE_REQUOTE: {
    action: "INSURANCE_REQUOTE",
    label: "Requote insurance",
    description:
      "Update the policy address and review coverage or pricing for the destination.",
  },
  MAIL_FORWARDING: {
    action: "MAIL_FORWARDING",
    label: "Forward mail",
    description:
      "Set up manual mail forwarding or update mailing addresses. No connector execution is implied.",
  },
  NO_ACTION: {
    action: "NO_ACTION",
    label: "No action",
    description: "No move-specific action is currently recommended.",
  },
};

export function getProviderTrustPresentation(
  status: ProviderTrustStatus | null | undefined,
): ProviderTrustPresentation {
  return PROVIDER_TRUST_COPY[status || DEFAULT_PROVIDER_TRUST_STATUS];
}

export function getCoverageConfidencePresentation(
  confidence: CoverageConfidence | null | undefined,
): CoverageConfidencePresentation {
  return COVERAGE_CONFIDENCE_COPY[confidence || DEFAULT_COVERAGE_CONFIDENCE];
}

export function getMoveTransitionActionPresentation(
  action: MoveTransitionActionType,
): MoveTransitionActionPresentation {
  return MOVE_TRANSITION_ACTION_COPY[action];
}

export function getMoveTaskStatusPresentation(
  status: MoveTaskStatus,
): MoveTaskStatusPresentation {
  return MOVE_TASK_STATUS_COPY[status];
}

export function getMoveTaskSourcePresentation(
  source: MoveTaskSource,
): MoveTaskSourcePresentation {
  return MOVE_TASK_SOURCE_COPY[source];
}

export function getMoveTaskEffectPresentation(
  effect: MoveTaskEffectType,
): MoveTaskEffectPresentation {
  return MOVE_TASK_EFFECT_COPY[effect];
}

export function getCurrentProductCopy(key: CurrentProductCopyKey): string {
  return CURRENT_PRODUCT_COPY[key];
}

export function getManualTrackingDisclaimer(): string {
  return `${CURRENT_PRODUCT_COPY.MANUAL_TRACKING_ONLY} ${CURRENT_PRODUCT_COPY.NO_AUTOMATIC_ACCOUNT_UPDATE}`;
}

export function getProviderAvailabilityDisclaimer(): string {
  return `${CURRENT_PRODUCT_COPY.AVAILABILITY_MAY_VARY} ${CURRENT_PRODUCT_COPY.CONFIRM_WITH_OFFICIAL_PROVIDER}`;
}

export function getTaskCompletionDisclaimer(): string {
  return `${CURRENT_PRODUCT_COPY.TASK_COMPLETION_UPDATES_LOCATEFLOW_ONLY} ${CURRENT_PRODUCT_COPY.NO_AUTOMATIC_ACCOUNT_UPDATE}`;
}

export function mapCoverageMatchToConfidence(
  matchLevel?: string | null,
  options?: {
    scope?: string | null;
    coverageModel?: string | null;
    requiresAddressCheck?: boolean | null;
    requiresPolygonCheck?: boolean | null;
  },
): CoverageConfidence {
  if (options?.requiresAddressCheck) return "ADDRESS_CHECK_REQUIRED";
  if (matchLevel === "exact") return "EXACT_ZIP";
  if (matchLevel === "prefix") return "ZIP_PREFIX";
  if (matchLevel === "polygon" || options?.coverageModel === "polygon") {
    return "MAPPED_SERVICE_AREA";
  }
  if (matchLevel === "live_address" || options?.coverageModel === "live_address") {
    return "ADDRESS_CHECK_REQUIRED";
  }
  if (matchLevel === "state") {
    return options?.scope === "FEDERAL" ? "NATIONAL_OR_FEDERAL" : "STATE_LEVEL";
  }
  if (options?.scope === "FEDERAL") return "NATIONAL_OR_FEDERAL";
  if (options?.requiresPolygonCheck) return "MAPPED_SERVICE_AREA";
  return "UNKNOWN";
}

export function compareCoverageConfidence(
  a: CoverageConfidence | null | undefined,
  b: CoverageConfidence | null | undefined,
): number {
  return (
    getCoverageConfidencePresentation(b).rank -
    getCoverageConfidencePresentation(a).rank
  );
}

export function isCoverageAddressSensitive(
  category: string | null | undefined,
): boolean {
  const normalized = (category || "").toUpperCase();
  return (
    normalized.startsWith("UTILITY_") ||
    normalized.startsWith("TRANSPORTATION_") ||
    normalized.startsWith("HOUSING_HOME_SERVICE") ||
    normalized === "GROCERY_DELIVERY" ||
    normalized === "LOCAL_DINING" ||
    normalized === "LOCAL_MEMBERSHIP"
  );
}

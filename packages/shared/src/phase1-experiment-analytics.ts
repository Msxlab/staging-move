import {
  UX_AI_BRIEFING_EXPERIENCE_FLAG,
  UX_ONBOARDING_TEASER_FLAG,
  UX_TRUST_COPY_FLAG,
  type UxAiBriefingExperienceVariant,
  type UxOnboardingTeaserVariant,
  type UxTrustCopyVariant,
} from "./ux-experiments";

export const PHASE1_ANALYTICS_EVENTS = {
  AI_BRIEFING_VIEWED: "ai_briefing_viewed",
  AI_BRIEFING_ACTION_CLICKED: "ai_briefing_action_clicked",
  TRUST_COPY_SHOWN: "trust_copy_shown",
  ONBOARDING_TEASER_VIEWED: "onboarding_teaser_viewed",
  UPGRADE_CLICKED: "upgrade_clicked",
  // Monetization funnel (docs/ai/free-pivot/10 + 19 §9). Soft, consented funnel
  // signal only — hard revenue lives on ClickEvent/AffiliateConversion/Lead.
  // Keyed by `offer_key` (a slug, never a partner name → PII-safe).
  OFFER_VIEWED: "offer_viewed",
  OFFER_CLICKED: "offer_clicked",
  LEAD_SUBMITTED: "lead_submitted",
  CONCIERGE_INTEREST_CLICKED: "concierge_interest_clicked",
} as const;

export type Phase1AnalyticsEvent =
  (typeof PHASE1_ANALYTICS_EVENTS)[keyof typeof PHASE1_ANALYTICS_EVENTS];

export type Phase1AnalyticsMetadata = Record<string, string | number | boolean>;

export type BriefingState =
  | "content"
  | "fallback"
  | "gated"
  | "teaser"
  | "hidden"
  | "empty";
export type BriefingMode = "ai_generated" | "rule_based" | "gated_teaser" | "unknown";
export type BriefingActionType = "service_category" | "services" | "state_rule" | "plan" | "unknown";
export type TransitionActionType = "stop" | "start" | "transfer" | "cancel" | "update" | "unknown";
export type UpgradeSurface = "ai_briefing" | "onboarding_teaser" | "pro_showcase" | "subscription" | "unknown";
export type FeatureGate = "ai_briefing" | "onboarding_teaser" | "move_plan" | "pro_showcase" | "unknown";
export type PlanTier = "free" | "individual" | "family" | "pro" | "unknown";
export type PlatformName = "web" | "pwa" | "ios" | "android" | "unknown";

const COMMON_ALLOWED_KEYS = [
  "platform",
  "surface",
  "plan_tier",
  "workspace_role",
  "experiment_flag",
  "variant",
  "state",
  "source",
] as const;

const EVENT_ALLOWED_KEYS: Record<Phase1AnalyticsEvent, Set<string>> = {
  [PHASE1_ANALYTICS_EVENTS.AI_BRIEFING_VIEWED]: new Set([
    ...COMMON_ALLOWED_KEYS,
    "briefing_state",
    "briefing_mode",
  ]),
  [PHASE1_ANALYTICS_EVENTS.AI_BRIEFING_ACTION_CLICKED]: new Set([
    ...COMMON_ALLOWED_KEYS,
    "action_type",
    "briefing_mode",
  ]),
  [PHASE1_ANALYTICS_EVENTS.TRUST_COPY_SHOWN]: new Set([
    ...COMMON_ALLOWED_KEYS,
    "transition_action_type",
  ]),
  [PHASE1_ANALYTICS_EVENTS.ONBOARDING_TEASER_VIEWED]: new Set(COMMON_ALLOWED_KEYS),
  [PHASE1_ANALYTICS_EVENTS.UPGRADE_CLICKED]: new Set([
    ...COMMON_ALLOWED_KEYS,
    "upgrade_surface",
    "target_plan_tier",
    "feature_gate",
  ]),
  [PHASE1_ANALYTICS_EVENTS.OFFER_VIEWED]: new Set([
    ...COMMON_ALLOWED_KEYS,
    "offer_key",
    "category",
  ]),
  [PHASE1_ANALYTICS_EVENTS.OFFER_CLICKED]: new Set([
    ...COMMON_ALLOWED_KEYS,
    "offer_key",
    "category",
  ]),
  [PHASE1_ANALYTICS_EVENTS.LEAD_SUBMITTED]: new Set([
    ...COMMON_ALLOWED_KEYS,
    "offer_key",
    "category",
  ]),
  [PHASE1_ANALYTICS_EVENTS.CONCIERGE_INTEREST_CLICKED]: new Set([
    ...COMMON_ALLOWED_KEYS,
    "offer_key",
  ]),
};

const EVENT_NAMES = new Set<string>(Object.values(PHASE1_ANALYTICS_EVENTS));

const PLATFORM_VALUES = new Set(["web", "pwa", "ios", "android", "unknown"]);
const SURFACE_VALUES = new Set([
  "onboarding",
  "dashboard",
  "mobile_home",
  "moving_plan",
  "transition_workspace",
  "services",
  "settings_export",
  "notifications",
  "daily_digest",
  "pricing",
  "subscription",
  // High-intent monetization surfaces (offer/lead funnel — docs/ai/free-pivot/19 §6).
  "provider_detail",
  "recommendations",
  "movers",
  "move_task",
  "unknown",
]);
const PLAN_TIER_VALUES = new Set(["free", "individual", "family", "pro", "unknown"]);
const WORKSPACE_ROLE_VALUES = new Set(["owner", "admin", "member", "child", "view_only", "unknown"]);
const EXPERIMENT_FLAG_VALUES = new Set([
  UX_AI_BRIEFING_EXPERIENCE_FLAG,
  UX_TRUST_COPY_FLAG,
  UX_ONBOARDING_TEASER_FLAG,
  "ux_transition_workspace_v1",
  "ux_post_move_monitoring_v1",
  "none",
]);
const VARIANT_VALUES = new Set([
  "control",
  "variant",
  "source_explainer",
  "upgrade_teaser",
  "persistent_mobile",
  "read_only_board",
  "monitoring_card",
  "digest_link",
  "unknown",
]);
const SOURCE_VALUES = new Set([
  "direct",
  "dashboard",
  "briefing",
  "recommendation",
  "notification",
  "digest",
  "pricing",
  "export",
  "unknown",
]);
const BRIEFING_STATE_VALUES: ReadonlySet<string> = new Set([
  "content",
  "fallback",
  "gated",
  "teaser",
  "hidden",
  "empty",
]);
const BRIEFING_MODE_VALUES: ReadonlySet<string> = new Set([
  "ai_generated",
  "rule_based",
  "gated_teaser",
  "unknown",
]);
const BRIEFING_ACTION_TYPE_VALUES: ReadonlySet<string> = new Set([
  "service_category",
  "services",
  "state_rule",
  "plan",
  "unknown",
]);
const TRANSITION_ACTION_TYPE_VALUES: ReadonlySet<string> = new Set([
  "stop",
  "start",
  "transfer",
  "cancel",
  "update",
  "unknown",
]);
const UPGRADE_SURFACE_VALUES: ReadonlySet<string> = new Set([
  "ai_briefing",
  "onboarding_teaser",
  "pro_showcase",
  "subscription",
  "unknown",
]);
const FEATURE_GATE_VALUES: ReadonlySet<string> = new Set([
  "ai_briefing",
  "onboarding_teaser",
  "move_plan",
  "pro_showcase",
  "unknown",
]);

function enumValue<T extends string>(value: unknown, allowed: ReadonlySet<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function stateValue(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "unknown";
}

// offer_key / category are open-ended slugs (e.g. "concierge", "junk_removal",
// "utility_internet"). Lowercase + restrict to a slug charset so a partner name,
// URL, email, or free text can never leak into the soft event log.
function slugValue(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9_]{1,40}$/.test(normalized) ? normalized : "unknown";
}

function normalizeByKey(key: string, value: unknown): string | number | boolean | null {
  switch (key) {
    case "platform":
      return enumValue(value, PLATFORM_VALUES, "unknown");
    case "surface":
      return enumValue(value, SURFACE_VALUES, "unknown");
    case "plan_tier":
    case "target_plan_tier":
      return enumValue(value, PLAN_TIER_VALUES, "unknown");
    case "workspace_role":
      return enumValue(value, WORKSPACE_ROLE_VALUES, "unknown");
    case "experiment_flag":
      return enumValue(value, EXPERIMENT_FLAG_VALUES, "none");
    case "variant":
      return enumValue(value, VARIANT_VALUES, "unknown");
    case "state":
      return stateValue(value);
    case "source":
      return enumValue(value, SOURCE_VALUES, "unknown");
    case "briefing_state":
      return enumValue(value, BRIEFING_STATE_VALUES, "empty");
    case "briefing_mode":
      return enumValue(value, BRIEFING_MODE_VALUES, "unknown");
    case "action_type":
      return enumValue(value, BRIEFING_ACTION_TYPE_VALUES, "unknown");
    case "transition_action_type":
      return enumValue(value, TRANSITION_ACTION_TYPE_VALUES, "unknown");
    case "upgrade_surface":
      return enumValue(value, UPGRADE_SURFACE_VALUES, "unknown");
    case "feature_gate":
      return enumValue(value, FEATURE_GATE_VALUES, "unknown");
    case "offer_key":
    case "category":
      return slugValue(value);
    default:
      return null;
  }
}

export function isPhase1AnalyticsEvent(event: string): event is Phase1AnalyticsEvent {
  return EVENT_NAMES.has(event);
}

export function sanitizePhase1EventMetadata(
  event: string,
  metadata: unknown,
): Phase1AnalyticsMetadata | null {
  if (!isPhase1AnalyticsEvent(event) || !metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const allowed = EVENT_ALLOWED_KEYS[event];
  const safe: Phase1AnalyticsMetadata = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    const normalized = normalizeByKey(key, value);
    if (normalized !== null) safe[key] = normalized;
  }
  return Object.keys(safe).length > 0 ? safe : null;
}

export function normalizeTransitionActionType(actionType?: string | null): TransitionActionType {
  const raw = typeof actionType === "string" ? actionType.toUpperCase() : "";
  if (raw === "STOP" || raw === "STOP_SERVICE") return "stop";
  if (raw === "START" || raw === "START_SERVICE") return "start";
  if (raw === "TRANSFER" || raw === "TRANSFER_SERVICE") return "transfer";
  if (raw === "CANCEL" || raw === "CANCEL_OR_CLOSE") return "cancel";
  if (raw === "UPDATE" || raw === "UPDATE_ADDRESS") return "update";
  return "unknown";
}

export function platformFromRuntime(value?: string | null): PlatformName {
  if (value === "web" || value === "pwa" || value === "ios" || value === "android") return value;
  return "unknown";
}

export function buildAiBriefingViewedMetadata(input: {
  briefingState: BriefingState;
  briefingMode: BriefingMode;
  variant: UxAiBriefingExperienceVariant;
  platform?: PlatformName;
  surface?: "dashboard" | "mobile_home";
  planTier?: PlanTier;
}): Phase1AnalyticsMetadata {
  return sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.AI_BRIEFING_VIEWED, {
    platform: input.platform ?? "web",
    surface: input.surface ?? "dashboard",
    plan_tier: input.planTier ?? "unknown",
    experiment_flag: UX_AI_BRIEFING_EXPERIENCE_FLAG,
    variant: input.variant,
    briefing_state: input.briefingState,
    briefing_mode: input.briefingMode,
  }) ?? {};
}

export function buildAiBriefingActionClickedMetadata(input: {
  actionType: BriefingActionType;
  briefingMode: BriefingMode;
  variant: UxAiBriefingExperienceVariant;
  platform?: PlatformName;
  surface?: "dashboard" | "mobile_home";
}): Phase1AnalyticsMetadata {
  return sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.AI_BRIEFING_ACTION_CLICKED, {
    platform: input.platform ?? "web",
    surface: input.surface ?? "dashboard",
    source: "briefing",
    experiment_flag: UX_AI_BRIEFING_EXPERIENCE_FLAG,
    variant: input.variant,
    action_type: input.actionType,
    briefing_mode: input.briefingMode,
  }) ?? {};
}

export function buildTrustCopyShownMetadata(input: {
  transitionActionType?: string | null;
  variant: UxTrustCopyVariant;
  platform?: PlatformName;
}): Phase1AnalyticsMetadata {
  return sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.TRUST_COPY_SHOWN, {
    platform: input.platform ?? "web",
    surface: "moving_plan",
    experiment_flag: UX_TRUST_COPY_FLAG,
    variant: input.variant,
    transition_action_type: normalizeTransitionActionType(input.transitionActionType),
  }) ?? {};
}

export function buildOnboardingTeaserViewedMetadata(input: {
  planTier: PlanTier;
  variant: UxOnboardingTeaserVariant;
  platform?: PlatformName;
}): Phase1AnalyticsMetadata {
  return sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.ONBOARDING_TEASER_VIEWED, {
    platform: input.platform ?? "web",
    surface: "onboarding",
    plan_tier: input.planTier,
    experiment_flag: UX_ONBOARDING_TEASER_FLAG,
    variant: input.variant,
  }) ?? {};
}

export type OfferEventName =
  | typeof PHASE1_ANALYTICS_EVENTS.OFFER_VIEWED
  | typeof PHASE1_ANALYTICS_EVENTS.OFFER_CLICKED
  | typeof PHASE1_ANALYTICS_EVENTS.LEAD_SUBMITTED
  | typeof PHASE1_ANALYTICS_EVENTS.CONCIERGE_INTEREST_CLICKED;

/**
 * Build validated metadata for a monetization funnel event. `offerKey` is a slug
 * identifying the offer/placement (e.g. "concierge", "junk_removal", a partner
 * offer key) — never a partner display name. The result is allow-listed +
 * normalized, so it is safe to persist on the consented UserEvent log.
 */
export function buildOfferEventMetadata(
  event: OfferEventName,
  input: {
    offerKey: string;
    category?: string;
    surface?: string;
    platform?: PlatformName;
    source?: string;
  },
): Phase1AnalyticsMetadata {
  return sanitizePhase1EventMetadata(event, {
    platform: input.platform ?? "web",
    surface: input.surface ?? "unknown",
    source: input.source ?? "unknown",
    offer_key: input.offerKey,
    ...(input.category ? { category: input.category } : {}),
  }) ?? {};
}

export function buildUpgradeClickedMetadata(input: {
  upgradeSurface: UpgradeSurface;
  targetPlanTier: PlanTier;
  featureGate: FeatureGate;
  platform?: PlatformName;
  surface?: "dashboard" | "onboarding" | "subscription" | "pricing";
  variant?: UxAiBriefingExperienceVariant | UxOnboardingTeaserVariant | "unknown";
  experimentFlag?: typeof UX_AI_BRIEFING_EXPERIENCE_FLAG | typeof UX_ONBOARDING_TEASER_FLAG | "none";
}): Phase1AnalyticsMetadata {
  return sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.UPGRADE_CLICKED, {
    platform: input.platform ?? "web",
    surface: input.surface ?? "dashboard",
    experiment_flag: input.experimentFlag ?? "none",
    variant: input.variant ?? "unknown",
    upgrade_surface: input.upgradeSurface,
    target_plan_tier: input.targetPlanTier,
    feature_gate: input.featureGate,
  }) ?? {};
}

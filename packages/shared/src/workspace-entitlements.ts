/**
 * Plan → workspace feature matrix (doc 06 + D21 seats, D14 plan-limits).
 *
 * Pure, string-keyed (no dependency on the BillingPlan union, which gains
 * FAMILY/PRO in doc 62). Single source of truth for seat ceilings and which
 * capabilities a plan unlocks — consumed by seat enforcement, connector
 * tier-gating, and the pricing/upsell UI.
 */

export interface WorkspacePlanFeatures {
  /** Max non-suspended members (owner included). */
  seatLimit: number;
  /** Server-side automatic push connectors (real partner APIs). Pro. */
  apiConnectors: boolean;
  /** Deep-link / mailto / PDF connectors. Family and up. */
  manualConnectors: boolean;
  /** Partner Hub catalog UI. Pro. */
  partnerHub: boolean;
  /** Address labels (HOME/OFFICE/RENTAL/…). Family and up. */
  addressLabels: boolean;
  /** Advanced tax/property export. Pro. */
  advancedExport: boolean;
  /** USPS address validation / standardization / ZIP+4 (Tier 2). Paid plans. */
  addressValidation: boolean;
  /** AI move briefing (LLM situation summary on the dashboard). Family and up. */
  aiBriefing: boolean;
  /** Free preview subset of the New Home Dossier (flood / school / moving-day weather). */
  homeDossierPreview: boolean;
  /** New Home Dossier (flood / school district / move-day weather). Individual and up. */
  homeDossier: boolean;
  /** FMCSA-registered household-goods mover suggestions on the moving plan. Pro only. */
  moverSuggestions: boolean;
  /** VIN decode + NHTSA recall check on vehicle tasks. Individual and up. */
  vehicleCheck: boolean;
  /** Move-week weather/flood push + weekly digest email. Individual and up. */
  weatherDigest: boolean;
  /** Full Geoapify route/address map; lower tiers see the OSM preview/stylized fallback. Family and up. */
  realMap: boolean;
  /** New Home Dossier PDF export. Pro only. */
  dossierPdf: boolean;
  /** Neighborhood Intelligence dossier section (Census ACS area economics). Pro only. */
  neighborhoodIntel: boolean;
  /** Priority support queue/label. Pro only. */
  prioritySupport: boolean;
  /** Max concurrent (non-archived) move plans. Pro runs several at once. */
  concurrentPlanLimit: number;
}

// Owner-ratified tier ladder (2026-06-10): Free is a thin teaser tier; the
// data-checked recommendations, VIN check, weather/digest, dossier and AI
// live behind paid plans; AI is Family+Pro only (same experience — the cap
// is cost control, not a tier line); movers, dossier-PDF, multi-plan,
// neighborhood intel, and priority support are Pro-only so Pro is meaningfully
// differentiated.
const FEATURES: Record<string, WorkspacePlanFeatures> = {
  PRO: { seatLimit: 10, apiConnectors: true, manualConnectors: true, partnerHub: true, addressLabels: true, advancedExport: true, addressValidation: true, aiBriefing: true, homeDossierPreview: true, homeDossier: true, moverSuggestions: true, vehicleCheck: true, weatherDigest: true, realMap: true, dossierPdf: true, neighborhoodIntel: true, prioritySupport: true, concurrentPlanLimit: 3 },
  FAMILY: { seatLimit: 6, apiConnectors: false, manualConnectors: true, partnerHub: false, addressLabels: true, advancedExport: false, addressValidation: true, aiBriefing: true, homeDossierPreview: true, homeDossier: true, moverSuggestions: false, vehicleCheck: true, weatherDigest: true, realMap: true, dossierPdf: false, neighborhoodIntel: false, prioritySupport: false, concurrentPlanLimit: 1 },
  INDIVIDUAL: { seatLimit: 1, apiConnectors: false, manualConnectors: true, partnerHub: false, addressLabels: false, advancedExport: false, addressValidation: true, aiBriefing: false, homeDossierPreview: true, homeDossier: true, moverSuggestions: false, vehicleCheck: true, weatherDigest: true, realMap: false, dossierPdf: false, neighborhoodIntel: false, prioritySupport: false, concurrentPlanLimit: 1 },
  FREE_TRIAL: { seatLimit: 1, apiConnectors: false, manualConnectors: false, partnerHub: false, addressLabels: false, advancedExport: false, addressValidation: false, aiBriefing: false, homeDossierPreview: true, homeDossier: false, moverSuggestions: false, vehicleCheck: false, weatherDigest: false, realMap: false, dossierPdf: false, neighborhoodIntel: false, prioritySupport: false, concurrentPlanLimit: 1 },
};

const DEFAULT_FEATURES: WorkspacePlanFeatures = FEATURES.FREE_TRIAL;

/** Feature set for a plan; falls back to the Free Trial floor for unknowns. */
export function planFeatures(plan: string | null | undefined): WorkspacePlanFeatures {
  if (!plan) return DEFAULT_FEATURES;
  return FEATURES[plan] ?? DEFAULT_FEATURES;
}

/** Seat ceiling for a plan (owner + members). */
export function seatLimitForPlan(plan: string | null | undefined): number {
  return planFeatures(plan).seatLimit;
}

/** Members beyond the plan's seat limit after a downgrade (D2 overflow). */
export function overflowCount(plan: string | null | undefined, activeMembers: number): number {
  return Math.max(0, activeMembers - seatLimitForPlan(plan));
}

/**
 * FINITE concurrent-active-moving-plan abuse ceiling for the consumer-free
 * (CONSUMER_FREE flag ON) path (H4). Under the truly-free pivot every account
 * resolves to PRO, whose tier `concurrentPlanLimit` is 3 — which would dead-end
 * the whole base at the 4th active move. This raises that gate to a high but
 * FINITE value so a real consumer is never blocked, while a pathological account
 * (dozens of simultaneously-active moves) still trips. Single source of truth
 * shared by the web moving-plan create gate; the flag-OFF path keeps the real
 * per-tier `planFeatures(plan).concurrentPlanLimit` (3 for PRO, 1 otherwise)
 * EXACTLY as today.
 */
export const CONSUMER_FREE_CONCURRENT_PLAN_LIMIT = 25;

/**
 * Concurrent-active-moving-plan ceiling, selecting the consumer-free finite
 * abuse cap when the flag is ON and the real per-tier limit otherwise. Pure:
 * callers pass the resolved flag (never read ambient env in shared code). Flag
 * OFF (default) → identical to `planFeatures(plan).concurrentPlanLimit`.
 */
export function concurrentPlanLimitForPlan(
  plan: string | null | undefined,
  consumerFree: boolean,
): number {
  return consumerFree
    ? CONSUMER_FREE_CONCURRENT_PLAN_LIMIT
    : planFeatures(plan).concurrentPlanLimit;
}

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
}

const FEATURES: Record<string, WorkspacePlanFeatures> = {
  PRO: { seatLimit: 10, apiConnectors: true, manualConnectors: true, partnerHub: true, addressLabels: true, advancedExport: true, addressValidation: true },
  FAMILY: { seatLimit: 6, apiConnectors: false, manualConnectors: true, partnerHub: false, addressLabels: true, advancedExport: false, addressValidation: true },
  INDIVIDUAL: { seatLimit: 1, apiConnectors: false, manualConnectors: true, partnerHub: false, addressLabels: false, advancedExport: false, addressValidation: true },
  FREE_TRIAL: { seatLimit: 1, apiConnectors: false, manualConnectors: false, partnerHub: false, addressLabels: false, advancedExport: false, addressValidation: false },
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

/**
 * Onboarding data-quality score (design bundle-3, onb-core.jsx `.ob-quality`).
 *
 * A single HONEST profile-completeness number (0-100) shown under the
 * onboarding coach: "Data quality N%". It measures only how much of their own
 * setup the user has filled in — the signals the recommendation/checklist
 * engines genuinely personalize on (household profile, address, kept
 * providers, destination + date). It is NOT a prediction, a gamified streak,
 * or an accuracy claim about the data itself.
 *
 * Pure + framework-free so it is unit-testable (onboarding-data-quality.test.ts)
 * and the screen can recompute it cheaply on every keystroke.
 */

export interface OnboardingDataQualityState {
  /** First AND last name entered (step 0 requireds). */
  hasName: boolean;
  /** Optional age-range chip picked (step 0). */
  hasAgeRange: boolean;
  /**
   * Count of household signals the user switched on (children, pets, senior,
   * storage, motorcycle, boat/RV, vehicles…). Each one genuinely adds
   * checklist/recommendation tailoring, with diminishing returns past a few.
   */
  householdSignals: number;
  /** Street, city, state and ZIP all present on the primary address (step 1). */
  hasAddress: boolean;
  /** Providers the user KEPT on the services step (step 2). */
  providersKept: number;
  /** Destination state entered on the move step (step 3). */
  hasDestinationState: boolean;
  /** Move date picked on the move step (step 3). */
  hasMoveDate: boolean;
}

/** Everyone starts here — signing up at all is already usable signal. */
export const DATA_QUALITY_BASE = 35;

// Per-signal weights. They sum (at their caps) to exactly 100 with the base:
// 35 + 8 + 4 + 8 + 15 + 18 + 8 + 4 = 100.
const NAME_POINTS = 8;
const AGE_RANGE_POINTS = 4;
const HOUSEHOLD_POINTS_EACH = 2;
const HOUSEHOLD_SIGNALS_CAP = 4; // → max 8
const ADDRESS_POINTS = 15;
const PROVIDER_POINTS_EACH = 3;
const PROVIDERS_KEPT_CAP = 6; // → max 18
const DESTINATION_POINTS = 8;
const MOVE_DATE_POINTS = 4;

/** Defensive count sanitizer: non-finite / negative → 0, fractional → floor. */
function sanitizeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/**
 * Map the onboarding state to an honest 0-100 completeness score.
 *
 * Properties callers can rely on (covered by the unit tests):
 *   - empty state scores exactly DATA_QUALITY_BASE;
 *   - the score only ever GROWS as the user keeps/fills more (monotonic);
 *   - repeated signals saturate at their caps (no infinite farming);
 *   - the result is an integer clamped to [DATA_QUALITY_BASE, 100].
 */
export function computeOnboardingDataQuality(state: OnboardingDataQualityState): number {
  let score = DATA_QUALITY_BASE;
  if (state.hasName) score += NAME_POINTS;
  if (state.hasAgeRange) score += AGE_RANGE_POINTS;
  score += Math.min(sanitizeCount(state.householdSignals), HOUSEHOLD_SIGNALS_CAP) * HOUSEHOLD_POINTS_EACH;
  if (state.hasAddress) score += ADDRESS_POINTS;
  score += Math.min(sanitizeCount(state.providersKept), PROVIDERS_KEPT_CAP) * PROVIDER_POINTS_EACH;
  if (state.hasDestinationState) score += DESTINATION_POINTS;
  if (state.hasMoveDate) score += MOVE_DATE_POINTS;
  return Math.min(100, Math.round(score));
}

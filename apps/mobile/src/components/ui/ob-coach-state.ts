/**
 * Pure helpers for the onboarding AI-coach ("why accurate data matters")
 * collapse state + per-step copy lookup. Kept free of React / AsyncStorage so
 * the logic is unit-testable (see ob-coach-state.test.ts) and shared between
 * the ObCoach component and the onboarding screen.
 *
 * Owner decision (design bundle-3, onb-core.jsx OBCoach): the coach is open by
 * default on a user's FIRST onboarding, dismissible via × to a small "!" badge
 * that reopens it, and the collapsed state is remembered per user. The design
 * models this as ONE boolean shared across steps (useFlow's single `coachOpen`),
 * not a per-step map — dismissing it once quiets it everywhere.
 */

/** AsyncStorage key prefix — versioned so a future shape change can migrate. */
export const OB_COACH_COLLAPSED_PREFIX = "locateflow.onboarding.coachCollapsed.v1";

/**
 * Per-user storage key. Anonymous / not-yet-hydrated sessions share the bare
 * prefix so a dismissal before the auth store hydrates still sticks for the
 * device — better than flashing the coach back open mid-onboarding.
 */
export function coachStorageKey(userId?: string | null): string {
  const id = (userId ?? "").trim();
  return id ? `${OB_COACH_COLLAPSED_PREFIX}.${id}` : OB_COACH_COLLAPSED_PREFIX;
}

/**
 * Parse the persisted collapse flag. Only the exact serialized "1" counts as
 * collapsed — anything else (null, garbage, legacy values) falls back to the
 * first-run default of OPEN, which is the safe direction (the coach is meant
 * to teach; re-showing it is annoying-at-worst, hiding it loses the message).
 */
export function parseCoachCollapsed(raw: string | null | undefined): boolean {
  return raw === "1";
}

/** Serialize the collapse flag for AsyncStorage. */
export function serializeCoachCollapsed(collapsed: boolean): "1" | "0" {
  return collapsed ? "1" : "0";
}

/** Onboarding step order — mirrors STEP_KEYS in app/onboarding.tsx. */
export const COACH_STEP_SLUGS = ["profile", "address", "services", "moving"] as const;

export type CoachStepSlug = (typeof COACH_STEP_SLUGS)[number];

export interface CoachCopyKeys {
  /** i18n key for the short uppercase eyebrow line. */
  eyebrowKey: string;
  /** i18n key for the one-or-two sentence honest explainer. */
  bodyKey: string;
}

/**
 * Map a step index (0-3) to its coach copy i18n keys. Out-of-range indices
 * return null so callers can simply skip rendering the coach rather than
 * showing a raw translation key.
 */
export function coachCopyKeys(stepIndex: number): CoachCopyKeys | null {
  const slug = Number.isInteger(stepIndex) ? COACH_STEP_SLUGS[stepIndex] : undefined;
  if (!slug) return null;
  return {
    eyebrowKey: `onboarding.coach_eyebrow_${slug}`,
    bodyKey: `onboarding.coach_body_${slug}`,
  };
}

/**
 * Feature-flag names for the monetization rollout (docs/ai/free-pivot/10 + 19 §10).
 *
 * All are read through the DB `FeatureFlag` (fail-CLOSED: unknown/absent → off),
 * so new revenue surfaces stay dark until an operator turns them on. Client
 * surfaces receive the resolved boolean prop-drilled from the server (never read
 * a flag in client code). Rollout order (lowest risk first): surface what's
 * already built → compliance → generic Partner → lead-gen → billing → insurance.
 */

/** Surface the already-built affiliate/sponsored systems (R2): move-task offer,
 *  kind=provider sponsored slot, mobile affiliate CTA parity. */
export const OFFERS_AFFILIATE_FLAG = "offers_affiliate_v1";

/** Generic Partner onboarding for cleaning + junk removal (no FMCSA). */
export const OFFERS_CLEANING_JUNK_FLAG = "offers_cleaning_junk_v1";

/** Generalize MOVER_REGISTRATION_ENABLED → category-agnostic partner registration. */
export const PARTNER_REGISTRATION_FLAG = "partner_registration_v1";

/** Lead-gen marketplace for moving quotes (Lead model + form + routing + CPL). */
export const OFFERS_MOVING_QUOTES_FLAG = "offers_moving_quotes_v1";

/** Regulated renters/home insurance offers (state-eligibility + licensing gating). */
export const OFFERS_RENTERS_INSURANCE_FLAG = "offers_renters_insurance_v1";

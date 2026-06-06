/**
 * USPS address validation (Tier 2) — shared contract between the web API, the
 * web UI, and the mobile app. The actual USPS call lives server-side; this file
 * is only the wire types so every layer agrees on the shape.
 *
 * Design rule: validation NEVER blocks saving an address. When it's off (no
 * credentials, feature flag off, or the user's plan isn't entitled) the response
 * is `{ enabled: false, status: "UNAVAILABLE" }` and the UI shows nothing.
 */

export interface AddressValidationInput {
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
}

export interface ValidatedAddress {
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string; // 5-digit ZIP
  zipPlus4: string | null; // the +4 add-on when USPS returns it
  /** USPS DPV (Delivery Point Validation) confirmation when present; null if unknown. */
  deliverable: boolean | null;
}

export type AddressValidationStatus =
  // A standardized match identical to what the user typed.
  | "VALIDATED"
  // A standardized match that DIFFERS from the input — surface as a suggestion.
  | "CORRECTED"
  // USPS could not match the address — let the user keep their input.
  | "NO_MATCH"
  // Feature unavailable (no creds / flag off / not entitled / USPS error). The
  // single fail-open status — the UI renders nothing and the save proceeds.
  | "UNAVAILABLE";

export interface AddressValidationResponse {
  /** Whether validation is even offered to this user (entitled + configured). */
  enabled: boolean;
  status: AddressValidationStatus;
  /** The standardized address for VALIDATED/CORRECTED; null otherwise. */
  suggestion: ValidatedAddress | null;
  /** True when `suggestion` differs from the submitted address (i.e. CORRECTED). */
  changed: boolean;
  /** Optional human-readable note (e.g. a USPS footnote); never an error to act on. */
  message?: string | null;
}

/** The always-safe "feature not available" response. */
export const ADDRESS_VALIDATION_UNAVAILABLE: AddressValidationResponse = {
  enabled: false,
  status: "UNAVAILABLE",
  suggestion: null,
  changed: false,
};

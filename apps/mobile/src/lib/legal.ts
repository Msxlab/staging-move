import {
  getDefaultLegalConsents,
  type LegalConsentState,
} from "@locateflow/shared";

export {
  LEGAL_CONSENT_EVENT,
  ONBOARDING_COMPLETED_EVENT,
  LEGAL_CONSENT_DOCUMENTS,
  LEGAL_CONSENT_STORAGE_KEY,
  LEGAL_CONSENT_VERSION,
  LEGAL_DISCLAIMER_DOCUMENT,
  LEGAL_TERMS_DOCUMENT,
  getDefaultLegalConsents,
  hasRequiredLegalConsents,
  createAcceptedLegalConsents,
  type LegalConsentDocument,
  type LegalConsentDocumentKey,
  type LegalConsentState,
} from "@locateflow/shared";

let pendingLegalConsents: LegalConsentState | null = null;

export function getPendingLegalConsents(): LegalConsentState | null {
  return pendingLegalConsents ? getDefaultLegalConsents(pendingLegalConsents) : null;
}

export function setPendingLegalConsents(consents: LegalConsentState | null) {
  pendingLegalConsents = consents ? getDefaultLegalConsents(consents) : null;
}

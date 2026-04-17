import {
  LEGAL_CONSENT_STORAGE_KEY,
  getDefaultLegalConsents,
  type LegalConsentState,
} from "../../../../packages/shared/src/legal";

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
} from "../../../../packages/shared/src/legal";

export function readPendingLegalConsentsFromSession(): LegalConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LEGAL_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return getDefaultLegalConsents(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writePendingLegalConsentsToSession(consents: LegalConsentState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(getDefaultLegalConsents(consents)));
}

export function clearPendingLegalConsentsFromSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(LEGAL_CONSENT_STORAGE_KEY);
}

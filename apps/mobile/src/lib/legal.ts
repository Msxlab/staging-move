import {
  getDefaultLegalConsents,
  type LegalConsentState,
} from "@locateflow/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
let hydratePromise: Promise<LegalConsentState | null> | null = null;

const PENDING_LEGAL_CONSENTS_STORAGE_KEY = "locateflow.pendingLegalConsents";

export function getPendingLegalConsents(): LegalConsentState | null {
  return pendingLegalConsents ? getDefaultLegalConsents(pendingLegalConsents) : null;
}

export async function setPendingLegalConsents(consents: LegalConsentState | null): Promise<void> {
  pendingLegalConsents = consents ? getDefaultLegalConsents(consents) : null;
  if (pendingLegalConsents) {
    await AsyncStorage.setItem(
      PENDING_LEGAL_CONSENTS_STORAGE_KEY,
      JSON.stringify(pendingLegalConsents),
    ).catch(() => {});
  } else {
    await AsyncStorage.removeItem(PENDING_LEGAL_CONSENTS_STORAGE_KEY).catch(() => {});
  }
}

export async function hydratePendingLegalConsents(): Promise<LegalConsentState | null> {
  if (pendingLegalConsents) return getPendingLegalConsents();
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_LEGAL_CONSENTS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<LegalConsentState>;
      pendingLegalConsents = getDefaultLegalConsents(parsed);
      return getPendingLegalConsents();
    } catch {
      await AsyncStorage.removeItem(PENDING_LEGAL_CONSENTS_STORAGE_KEY).catch(() => {});
      return null;
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

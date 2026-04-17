export const COOKIE_CONSENT_STORAGE_KEY = "locateflow_cookie_consent";
export const COOKIE_CONSENT_COOKIE_NAME = "cookie_consent";
export const COOKIE_CONSENT_CHANGE_EVENT = "locateflow:cookie-consent-change";

export type CookieConsentStatus = "accepted" | "declined" | null;

export function parseCookieConsentStatus(value: string | null | undefined): CookieConsentStatus {
  return value === "accepted" || value === "declined" ? value : null;
}

export function getStoredCookieConsent(): CookieConsentStatus {
  if (typeof window === "undefined") return null;
  return parseCookieConsentStatus(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
}

export function hasAnalyticsConsent(status?: CookieConsentStatus): boolean {
  return (status ?? getStoredCookieConsent()) === "accepted";
}

export function setStoredCookieConsent(status: "accepted" | "declined") {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, status);
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${status}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent<CookieConsentStatus>(COOKIE_CONSENT_CHANGE_EVENT, { detail: status }));
}

export function subscribeToCookieConsentChanges(listener: (status: CookieConsentStatus) => void) {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<CookieConsentStatus>).detail;
    listener(parseCookieConsentStatus(detail));
  };

  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handler);
}

export const LEGAL_ENTITY_PLACEHOLDER = "[Legal entity name to be finalized]";
export const COMPANY_ADDRESS_PLACEHOLDER =
  "[Mailing address to be finalized before production launch]";

export const LEGAL_INFO = {
  productName: "LocateFlow",
  legalEntityName:
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() ||
    LEGAL_ENTITY_PLACEHOLDER,
  companyAddress:
    process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() ||
    COMPANY_ADDRESS_PLACEHOLDER,
  lastUpdated: "May 1, 2026",
  lastUpdatedIso: "2026-05-01",
} as const;

function publicEmail(envName: string, fallback: string) {
  return process.env[envName]?.trim() || fallback;
}

export const LEGAL_CONTACTS = {
  support: publicEmail("NEXT_PUBLIC_SUPPORT_EMAIL", "support@locateflow.com"),
  privacy: publicEmail("NEXT_PUBLIC_PRIVACY_EMAIL", "privacy@locateflow.com"),
  legal: publicEmail("NEXT_PUBLIC_LEGAL_NOTICE_EMAIL", "legal@locateflow.com"),
  billing: publicEmail("NEXT_PUBLIC_BILLING_EMAIL", "billing@locateflow.com"),
  security: publicEmail("NEXT_PUBLIC_SECURITY_EMAIL", "security@locateflow.com"),
  dpa: publicEmail("NEXT_PUBLIC_DPA_EMAIL", "privacy@locateflow.com"),
} as const;

export const CONTACT_CONFIGURATION_NOTE =
  "Role-based email addresses are shown so users have a real contact path; production operators should confirm or override them with NEXT_PUBLIC_* contact environment variables before full public launch.";

export const STORE_PURCHASE_DISTINCTION =
  "Web subscriptions are billed through Stripe. iOS subscriptions are managed by Apple App Store, and Android subscriptions are managed by Google Play. Store purchases, cancellations, renewals, and refund requests may be controlled by the applicable store rules.";

export const POLICY_ROUTES = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookie-policy" },
  { label: "Disclaimer", href: "/disclaimer" },
  { label: "Billing Policy", href: "/billing-policy" },
  { label: "Refund Policy", href: "/refund" },
  { label: "Acceptable Use Policy", href: "/acceptable-use" },
  { label: "Data Processing Addendum", href: "/dpa" },
  { label: "Security", href: "/security" },
  { label: "California Privacy Notice", href: "/ccpa-privacy-notice" },
  { label: "Contact", href: "/contact" },
] as const;

export function mailto(email: string, subject?: string) {
  const suffix = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return `mailto:${email}${suffix}`;
}

export function displayLegalEntityName() {
  return LEGAL_INFO.legalEntityName === LEGAL_ENTITY_PLACEHOLDER
    ? LEGAL_INFO.productName
    : LEGAL_INFO.legalEntityName;
}

export function displayCompanyAddress() {
  return LEGAL_INFO.companyAddress === COMPANY_ADDRESS_PLACEHOLDER
    ? null
    : LEGAL_INFO.companyAddress;
}

export function policyLastUpdatedLabel() {
  return `Last updated: ${LEGAL_INFO.lastUpdated}`;
}

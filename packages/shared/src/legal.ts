export const LEGAL_CONSENT_VERSION = "2026-03-13";
export const LEGAL_CONSENT_EVENT = "LEGAL_CONSENT_ACCEPTED";
export const ONBOARDING_COMPLETED_EVENT = "ONBOARDING_COMPLETED";
export const LEGAL_CONSENT_STORAGE_KEY = "locateflow_pending_legal_consents";

export type LegalConsentDocumentKey = "terms" | "disclaimer";

export interface LegalConsentDocumentSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalConsentDocument {
  key: LegalConsentDocumentKey;
  title: string;
  shortTitle: string;
  route: string;
  checkboxLabel: string;
  summary: string;
  highlights: string[];
  sections: LegalConsentDocumentSection[];
}

export interface LegalConsentState {
  termsAccepted: boolean;
  disclaimerAccepted: boolean;
  termsVersion: string;
  disclaimerVersion: string;
  acceptedAt?: string;
}

export const LEGAL_TERMS_DOCUMENT: LegalConsentDocument = {
  key: "terms",
  title: "LocateFlow Terms of Use",
  shortTitle: "Terms of Use",
  route: "/terms",
  checkboxLabel: "I accept the LocateFlow Terms of Use.",
  summary:
    "LocateFlow is a relocation organization platform that helps users track addresses, services, move planning, documents, reminders, and provider research across the United States.",
  highlights: [
    "LocateFlow is an organizational software product, not a law firm, tax preparer, insurance broker, lender, government agency, or regulated advisor.",
    "You are responsible for the accuracy, completeness, legality, and authority of every address, provider, billing, household, custom-provider, move-task, and document record you enter or upload.",
    "Any provider, state-rule, timing, pricing, migration, or recommendation information shown in the product must be independently reviewed before you rely on it.",
    "To the maximum extent permitted by applicable U.S. federal, state, and local law, LocateFlow disclaims warranties and limits liability for losses connected to user-entered information, missed deadlines, third-party services, or reliance on product suggestions.",
  ],
  sections: [
    {
      heading: "Service scope",
      paragraphs: [
        "LocateFlow is intended to help individuals and households organize relocation-related workflows, including address records, service-provider lists, moving tasks, reminders, and supporting documents.",
        "The platform is designed for personal planning and internal household coordination. It is not offered as a legal filing service, regulated brokerage, public-record certification tool, or commercial data resale product.",
      ],
    },
    {
      heading: "User account and lawful use",
      paragraphs: [
        "You agree to use LocateFlow only for lawful purposes and only with data that you have the right to enter, manage, store, or share through the product.",
        "You are responsible for your account credentials, the actions taken through your account, and any collaborators or household members you authorize to access shared information.",
      ],
    },
    {
      heading: "No professional or government advice",
      paragraphs: [
        "LocateFlow does not provide legal, tax, financial, insurance, housing, healthcare, or compliance advice. Product content is informational and operational only.",
        "You must verify every filing requirement, eligibility rule, cost, coverage term, notice period, state deadline, and provider instruction directly with the relevant government body, carrier, bank, landlord, employer, or licensed professional.",
      ],
    },
    {
      heading: "Data handling and operational use",
      paragraphs: [
        "LocateFlow may process, store, display, and secure the information you submit only as reasonably necessary to operate account, relocation, service-management, document, reminder, analytics, support, and security features.",
        "LocateFlow does not sell user-entered relocation data for commercial advertising purposes and does not intentionally copy your data outside normal product operations, backup, logging, fraud prevention, support, and security workflows.",
      ],
    },
    {
      heading: "Individual access and subscriptions",
      paragraphs: [
        "LocateFlow currently offers Individual access. Free Access is cardless, does not automatically charge, and ends on the date shown in the account. Free Trial requires a payment method and is attached to Individual Annual.",
        "For a Free Trial, checkout shows the trial length, first annual charge date and amount, renewal interval, cancellation method, and policy links before the user agrees. Paid Individual Annual renews yearly unless renewal is canceled online in Settings.",
        "Cancellation during a Free Trial prevents the first annual charge. Cancellation after a paid annual charge turns off renewal while paid access continues through the current paid period unless support or an admin-approved action says otherwise.",
      ],
    },
    {
      heading: "Third-party services and availability",
      paragraphs: [
        "The product may reference third-party providers, payment processors, authentication vendors, storage systems, mapping services, or public resources. Those third parties operate independently and may change, fail, or impose their own terms.",
        "LocateFlow does not guarantee uninterrupted access, perfect availability, or error-free results. Maintenance, outages, data-entry mistakes, stale public information, or third-party failures may affect the service.",
      ],
    },
    {
      heading: "Warranty disclaimer and liability limits",
      paragraphs: [
        "LocateFlow is provided on an 'as is' and 'as available' basis to the fullest extent permitted by law. No warranty is made that the platform is complete, current, accurate, legally sufficient, or fit for a particular compliance outcome.",
        "To the fullest extent permitted by law, LocateFlow will not be liable for indirect, incidental, consequential, exemplary, punitive, or special damages, or for penalties, missed filings, service interruptions, denied applications, identity issues, billing disputes, or migration losses arising from your data, your decisions, or third-party conduct.",
      ],
    },
  ],
};

export const LEGAL_DISCLAIMER_DOCUMENT: LegalConsentDocument = {
  key: "disclaimer",
  title: "User-Entered Data and Legal Risk Disclaimer",
  shortTitle: "Legal Disclaimer",
  route: "/disclaimer",
  checkboxLabel: "I understand that all data I enter remains my responsibility and I accept the legal disclaimer.",
  summary:
    "LocateFlow stores and organizes user-entered relocation information for convenience only. The user, not LocateFlow, remains responsible for verifying and lawfully using every piece of information entered into the system.",
  highlights: [
    "Addresses, provider names, billing details, move tasks, move timelines, custom-provider records, and uploaded files may be incomplete, outdated, or incorrect because they depend on user entry and third-party systems.",
    "LocateFlow does not guarantee compliance with U.S. federal, state, county, city, agency, utility, insurance, tax, or licensing rules and is not responsible for missed filings, penalties, denials, service lapses, or other legal consequences.",
    "We collect only the information reasonably needed to operate accounts, addresses, services, moving plans, reminders, documents, security, analytics, and support. That data is not sold or licensed for commercial marketing use.",
    "Even so, you remain solely responsible for reviewing, correcting, updating, backing up, and lawfully relying on your own information and decisions.",
  ],
  sections: [
    {
      heading: "What data we collect and why",
      paragraphs: [
        "LocateFlow may collect account identifiers, names, emails, profile preferences, addresses, move-planning details, provider selections, user-created custom providers, move tasks, billing notes, uploaded files, reminders, and activity logs in order to operate the product and secure the platform.",
        "This information is used to provide features such as provider recommendations, relocation checklists, move tasks, service tracking, reminders, document management, troubleshooting, abuse prevention, and product reliability improvements.",
      ],
    },
    {
      heading: "No legal, tax, financial, insurance, or healthcare advice",
      paragraphs: [
        "LocateFlow does not replace licensed counsel, certified public accountants, enrolled agents, insurance producers, healthcare professionals, or lenders.",
        "Nothing in the product should be treated as a legal opinion, filing instruction, government approval, eligibility determination, tax position, insurance recommendation, medical recommendation, or binding compliance advice.",
      ],
    },
    {
      heading: "User verification duty",
      paragraphs: [
        "You are solely responsible for confirming that every address, account number, provider record, bill amount, due date, contract term, filing deadline, document, and service instruction is accurate before taking action.",
        "If information is wrong, stale, incomplete, duplicated, or entered without authority, the responsibility for correcting it and for any resulting outcome remains with the user.",
      ],
    },
    {
      heading: "Third-party provider and public-source risk",
      paragraphs: [
        "Provider listings, websites, phone numbers, state rules, and relocation suggestions may be sourced from public information, seed data, or external systems that can change without notice.",
        "LocateFlow is not responsible for provider conduct, pricing changes, service quality, application outcomes, account lockouts, fraud, denials, network outages, or any third-party statement or omission.",
      ],
    },
    {
      heading: "No sale of data and limited copying",
      paragraphs: [
        "LocateFlow does not sell user-entered relocation data for commercial advertising or broker-style resale purposes.",
        "Copies of data may still exist in operational databases, encrypted backups, logs, fraud-prevention systems, customer-support workflows, and disaster-recovery systems as reasonably necessary to run and protect the service.",
      ],
    },
    {
      heading: "User responsibility and risk allocation",
      paragraphs: [
        "To the maximum extent permitted by law, you accept responsibility for the content you submit, the actions you take based on that content, and any loss, claim, penalty, dispute, or compliance issue arising from inaccurate or unauthorized data entered through your account.",
        "If you need legally reliable advice or legally binding outcomes, you must consult the relevant government agency or a qualified licensed professional before acting.",
      ],
    },
  ],
};

export const LEGAL_CONSENT_DOCUMENTS = [LEGAL_TERMS_DOCUMENT, LEGAL_DISCLAIMER_DOCUMENT] as const;

export function getDefaultLegalConsents(overrides: Partial<LegalConsentState> = {}): LegalConsentState {
  return {
    termsAccepted: false,
    disclaimerAccepted: false,
    termsVersion: LEGAL_CONSENT_VERSION,
    disclaimerVersion: LEGAL_CONSENT_VERSION,
    acceptedAt: overrides.acceptedAt,
    ...overrides,
  };
}

export function hasRequiredLegalConsents(consents: Partial<LegalConsentState> | null | undefined): consents is LegalConsentState {
  return Boolean(consents?.termsAccepted && consents?.disclaimerAccepted);
}

export function createAcceptedLegalConsents(overrides: Partial<LegalConsentState> = {}): LegalConsentState {
  return getDefaultLegalConsents({
    ...overrides,
    termsAccepted: true,
    disclaimerAccepted: true,
    acceptedAt: overrides.acceptedAt || new Date().toISOString(),
  });
}

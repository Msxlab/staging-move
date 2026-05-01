export const LEGAL_CONSENT_VERSION = "2026-05-01";
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
  title: "LocateFlow Terms of Service",
  shortTitle: "Terms of Service",
  route: "/terms",
  checkboxLabel: "I accept the LocateFlow Terms of Service.",
  summary:
    "LocateFlow is a SaaS relocation organization tool for addresses, service-provider records, moving tasks, reminders, documents, budgets, subscription access, and provider research.",
  highlights: [
    "LocateFlow is an organizational software product, not a law firm, tax preparer, insurance broker, lender, government agency, or regulated advisor.",
    "You are responsible for the accuracy, completeness, legality, and authority of every address, provider, billing, household, move-task, support, and document record you enter or upload.",
    "Provider, state-rule, timing, pricing, migration, checklist, and recommendation information must be independently verified before you rely on it.",
    "Subscription terms, trial length, price, renewal date, cancellation method, and refund eligibility are controlled by checkout, the Billing Policy, the Refund Policy, and store rules when applicable.",
  ],
  sections: [
    {
      heading: "1. Service scope",
      paragraphs: [
        "LocateFlow helps individuals and permitted professional users organize relocation-related workflows, including address records, service-provider lists, moving tasks, reminders, budget records, support communications, subscription access, and supporting documents.",
        "LocateFlow is not a provider marketplace, legal filing service, regulated brokerage, public-record certification tool, payment card processor, or commercial data resale product. Completing a task in LocateFlow does not update an external provider account unless the product screen expressly says a supported integration performed that action.",
      ],
    },
    {
      heading: "2. Eligibility and authority",
      paragraphs: [
        "You must be at least 18 years old, or the age of majority where you live, and able to enter a binding agreement. If you use LocateFlow for a household, client, or other person, you represent that you have authority to enter and manage that information.",
        "You agree to use LocateFlow only for lawful purposes and only with data that you have the right to enter, manage, store, or share through the product.",
      ],
    },
    {
      heading: "3. Account responsibility",
      paragraphs: [
        "You are responsible for your account credentials, account activity, and the accuracy of the information entered through your account. Notify LocateFlow if you believe your account has been compromised.",
        "You are responsible for collaborators, household members, employees, contractors, or other users you authorize to access information through your account.",
      ],
    },
    {
      heading: "4. Acceptable use and user content",
      paragraphs: [
        "Your use of LocateFlow must comply with the Acceptable Use Policy. You may not abuse support channels, misuse provider data, attempt unauthorized access, scrape the service, submit malicious content, commit payment abuse, or use LocateFlow to harass, impersonate, defraud, or collect data without a lawful basis.",
        "You retain responsibility for the content you enter, upload, submit in support tickets, or send through the product. You grant LocateFlow the limited rights needed to host, display, process, transmit, secure, troubleshoot, back up, and provide the service.",
      ],
    },
    {
      heading: "5. Billing, trials, renewals, and refunds",
      paragraphs: [
        "LocateFlow may offer Free Access, Free Trial, Individual Annual, Individual Monthly, promotional, beta, or campaign-based offers. Trial length, today's due amount, payment method requirements, price, first charge date, renewal interval, and cancellation method are shown at checkout or in the applicable store purchase screen before purchase.",
        "Web purchases are processed by Stripe. iOS purchases may be processed by Apple App Store, and Android purchases may be processed by Google Play. Store purchases, cancellations, renewals, receipts, and refunds may be controlled by the applicable store rules.",
        "Paid subscriptions renew automatically unless canceled before renewal. Cancellation stops future billing where supported, but it does not automatically refund past charges. Refund requests are governed by the Refund Policy, the offer shown at checkout, legal requirements, and applicable store rules.",
      ],
    },
    {
      heading: "6. Provider and recommendation disclaimer",
      paragraphs: [
        "Provider listings, directory information, scores, recommendations, public resources, state guidance, and checklist suggestions may be incomplete, outdated, unavailable, or wrong. LocateFlow does not guarantee provider availability, quality, price, licensing, insurance, coverage, eligibility, performance, or outcome.",
        "You must independently verify provider details, legal obligations, timing, cancellation requirements, deposits, refunds, government deadlines, and professional advice with the provider, agency, licensed professional, or authoritative source before acting.",
      ],
    },
    {
      heading: "7. No professional advice",
      paragraphs: [
        "LocateFlow does not provide legal, tax, financial, insurance, real estate, healthcare, immigration, government, or moving professional advice. Product content is informational and operational only.",
        "Budget estimates, moving checklists, provider suggestions, document labels, reminders, and deadline guidance are not advice and should not be treated as complete, current, or legally sufficient.",
      ],
    },
    {
      heading: "8. Third-party services and availability",
      paragraphs: [
        "The product may rely on or reference third-party providers, payment processors, app stores, authentication vendors, storage systems, email providers, push notification providers, analytics tools, mapping services, public resources, and error-monitoring providers. Those third parties operate independently and may change, fail, or impose their own terms.",
        "LocateFlow does not guarantee uninterrupted access, perfect availability, or error-free results. Maintenance, outages, data-entry mistakes, stale public information, third-party failures, beta features, or unsupported integrations may affect the service.",
      ],
    },
    {
      heading: "9. Suspension and termination",
      paragraphs: [
        "LocateFlow may suspend, limit, or terminate access if we reasonably believe you violated these Terms, the Acceptable Use Policy, law, payment obligations, security requirements, or another user's rights.",
        "You may stop using LocateFlow at any time. Some records may be retained as described in the Privacy Policy, Billing Policy, Refund Policy, security logs, backups, audit records, legal records, or payment processor records.",
      ],
    },
    {
      heading: "10. Warranty disclaimer",
      paragraphs: [
        "LocateFlow is provided on an 'as is' and 'as available' basis to the fullest extent permitted by law. No warranty is made that the platform is complete, current, accurate, legally sufficient, uninterrupted, secure, error-free, or fit for a particular compliance, provider, billing, relocation, or financial outcome.",
      ],
    },
    {
      heading: "11. Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by law, LocateFlow will not be liable for indirect, incidental, consequential, exemplary, punitive, or special damages, or for penalties, missed filings, service interruptions, denied applications, identity issues, billing disputes, provider conduct, stale public information, migration losses, or reliance on product suggestions.",
        "Any liability cap, mandatory carve-outs, venue, governing law, arbitration, class-waiver, and consumer-law terms must be finalized by legal counsel before full public paid launch.",
      ],
    },
    {
      heading: "12. Indemnity",
      paragraphs: [
        "To the extent permitted by law, you agree to defend and hold LocateFlow harmless from claims arising from your unlawful use, unauthorized data, user content, support messages, payment abuse, provider-data misuse, breach of these Terms, or violation of another person's rights. This clause requires attorney review before full public paid launch.",
      ],
    },
    {
      heading: "13. Changes to the service or Terms",
      paragraphs: [
        "LocateFlow may change the service, features, policies, pricing, and these Terms. When changes are material, LocateFlow will use reasonable efforts to provide notice through the product, email, checkout, or public policy pages.",
        "Continued use after an effective update means you accept the updated Terms to the extent permitted by law.",
      ],
    },
    {
      heading: "14. Order of precedence and contact",
      paragraphs: [
        "These Terms govern general use of LocateFlow. The Privacy Policy governs personal data practices; the Billing Policy governs subscription billing; the Refund Policy governs refund requests; the DPA governs applicable business-customer processing terms; and the Acceptable Use Policy governs prohibited conduct. If documents conflict, the more specific policy controls its subject matter unless legal counsel finalizes a different order.",
        "Legal entity details, mailing address, support, privacy, billing, legal notice, security, and DPA contact channels are listed on the public Contact page. Governing law and venue must be finalized by legal counsel before full public paid launch.",
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
    "LocateFlow is not a provider marketplace and does not guarantee provider availability, quality, pricing, licensing, insurance, ratings, or performance.",
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
        "LocateFlow is not a provider marketplace, broker, insurer, utility, government agency, mover, or regulated advisor. We do not guarantee provider availability, quality, pricing, licensing, insurance, service territory, ratings, response time, or performance.",
        "LocateFlow is not responsible for provider conduct, pricing changes, service quality, application outcomes, account lockouts, fraud, denials, network outages, or any third-party statement or omission.",
      ],
    },
    {
      heading: "Recommendations, rankings, and estimates",
      paragraphs: [
        "Recommendations, rankings, confidence notes, budget estimates, reminders, and checklist suggestions are informational and may be based on user-entered data, location context, seed data, public sources, or product rules.",
        "They are not endorsements, guarantees, financial advice, legal advice, insurance advice, real estate advice, or instructions from a provider or government agency.",
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

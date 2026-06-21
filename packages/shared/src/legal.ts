export const LEGAL_CONSENT_VERSION = "2026-06-10";
export const LEGAL_CONSENT_EVENT = "LEGAL_CONSENT_ACCEPTED";
export const ONBOARDING_COMPLETED_EVENT = "ONBOARDING_COMPLETED";
export const LEGAL_CONSENT_STORAGE_KEY = "locateflow_pending_legal_consents";
export const PROVIDER_ACCOUNT_UNCHANGED_COPY =
  "Completing a task in Move does not update an external provider account unless the product screen expressly says a supported integration performed that action.";
export const MOVE_BRIEFING_NOT_ADVICE_COPY =
  "A read on your own data — not legal/tax advice; verify timing with your provider/state.";

export const GOVERNMENT_INFO_DISCLAIMER_COPY =
  "Move is not a government agency and is not affiliated with or endorsed by any government entity. Verify government deadlines and requirements on official .gov sources before acting.";

export type GovernmentInfoSourceId = "dmv" | "voter" | "tax";

export interface GovernmentInfoSourceLink {
  id: GovernmentInfoSourceId;
  label: string;
  url: string;
}

export const GOVERNMENT_INFO_SOURCE_LINKS = [
  {
    id: "dmv",
    label: "State motor vehicle services (USA.gov)",
    url: "https://www.usa.gov/state-motor-vehicle-services",
  },
  {
    id: "voter",
    label: "Voter registration (Vote.gov)",
    url: "https://vote.gov/register",
  },
  {
    id: "tax",
    label: "State and local taxes (USA.gov)",
    url: "https://www.usa.gov/state-taxes",
  },
] as const satisfies readonly GovernmentInfoSourceLink[];

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
  title: "Move Terms of Service",
  shortTitle: "Terms of Service",
  route: "/terms",
  checkboxLabel: "I accept the Move Terms of Service.",
  summary:
    "Move is a SaaS relocation organization tool for addresses, service-provider records, moving tasks, reminders, documents, budgets, subscription access, and provider research.",
  highlights: [
    "Move is an organizational software product, not a law firm, tax preparer, insurance broker, lender, government agency, or regulated advisor.",
    "You are responsible for the accuracy, completeness, legality, and authority of every address, provider, billing, household, move-task, support, and document record you enter or upload.",
    "Provider, state-rule, timing, pricing, migration, checklist, and recommendation information must be independently verified before you rely on it.",
    "Subscription terms, trial length, price, renewal date, cancellation method, and refund eligibility are controlled by checkout, the Billing Policy, the Refund Policy, and store rules when applicable.",
  ],
  sections: [
    {
      heading: "1. Service scope",
      paragraphs: [
        "Move helps individuals and permitted professional users organize relocation-related workflows, including address records, service-provider lists, moving tasks, reminders, budget records, support communications, subscription access, and supporting documents.",
        `Move is not a provider marketplace, legal filing service, regulated brokerage, public-record certification tool, payment card processor, or commercial data resale product. ${PROVIDER_ACCOUNT_UNCHANGED_COPY}`,
      ],
    },
    {
      heading: "2. Eligibility and authority",
      paragraphs: [
        "You must be at least 18 years old, or the age of majority where you live, and able to enter a binding agreement. If you use Move for a household, client, or other person, you represent that you have authority to enter and manage that information.",
        "You agree to use Move only for lawful purposes and only with data that you have the right to enter, manage, store, or share through the product.",
      ],
    },
    {
      heading: "3. Account responsibility",
      paragraphs: [
        "You are responsible for your account credentials, account activity, and the accuracy of the information entered through your account. Notify Move if you believe your account has been compromised.",
        "You are responsible for collaborators, household members, employees, contractors, or other users you authorize to access information through your account.",
      ],
    },
    {
      heading: "4. Acceptable use and user content",
      paragraphs: [
        "Your use of Move must comply with the Acceptable Use Policy. You may not abuse support channels, misuse provider data, attempt unauthorized access, scrape the service, submit malicious content, commit payment abuse, or use Move to harass, impersonate, defraud, or collect data without a lawful basis.",
        "You retain responsibility for the content you enter, upload, submit in support tickets, or send through the product. You grant Move the limited rights needed to host, display, process, transmit, secure, troubleshoot, back up, and provide the service.",
      ],
    },
    {
      heading: "5. Billing, trials, renewals, and refunds",
      paragraphs: [
        "Move may offer Free Access, Free Trial, Individual Annual, Individual Monthly, promotional, beta, or campaign-based offers. Trial length, today's due amount, payment method requirements, price, first charge date, renewal interval, and cancellation method are shown at checkout or in the applicable store purchase screen before purchase.",
        "Web purchases are processed by Stripe. iOS purchases may be processed by Apple App Store, and Android purchases may be processed by Google Play. Store purchases, cancellations, renewals, receipts, and refunds may be controlled by the applicable store rules.",
        "Paid subscriptions renew automatically unless canceled before renewal. Cancellation stops future billing where supported, but it does not automatically refund past charges. Refund requests are governed by the Refund Policy, the offer shown at checkout, legal requirements, and applicable store rules.",
      ],
    },
    {
      heading: "6. Provider and recommendation disclaimer",
      paragraphs: [
        "Provider listings, directory information, scores, recommendations, public resources, state guidance, and checklist suggestions may be incomplete, outdated, unavailable, or wrong. Move does not guarantee provider availability, quality, price, licensing, insurance, coverage, eligibility, performance, or outcome.",
        "You must independently verify provider details, legal obligations, timing, cancellation requirements, deposits, refunds, government deadlines, and professional advice with the provider, agency, licensed professional, or authoritative source before acting.",
        "Mover directory. Move may display a directory of household-goods movers built from public FMCSA (Federal Motor Carrier Safety Administration) registration data, including USDOT numbers and related safety information. This data is shown for verification convenience only. A listing is not an endorsement, recommendation, ranking guarantee, or statement about a mover's quality, and accuracy and currency follow the federal source, which may lag real-world changes. Verify any mover directly through FMCSA's official tools before hiring.",
        "Sponsored placements. Directory and recommendation surfaces may include clearly labeled sponsored placements. A sponsored placement is always marked as sponsored, appears separately from organic results, and never changes, boosts, or reorders organic rankings or recommendations. Payment never buys a better organic position.",
      ],
    },
    {
      heading: "7. No professional advice",
      paragraphs: [
        "Move does not provide legal, tax, financial, insurance, real estate, healthcare, immigration, government, or moving professional advice. Product content is informational and operational only.",
        "Budget estimates, moving checklists, provider suggestions, document labels, reminders, and deadline guidance are not advice and should not be treated as complete, current, or legally sufficient.",
      ],
    },
    {
      heading: "8. Third-party services and availability",
      paragraphs: [
        "The product may rely on or reference third-party providers, payment processors, app stores, authentication vendors, storage systems, email providers, push notification providers, analytics tools, mapping services, public resources, and error-monitoring providers. Those third parties operate independently and may change, fail, or impose their own terms.",
        "Public-data lookups and AI features. When you save an address, Move may send only that location's coordinates or area identifiers — or, for vehicle lookups, only the VIN you enter — to public and government data services such as FEMA, EPA, NCES, NWS, FCC, DOE/OpenEI, HUD, NLR/AFDC, and NHTSA to retrieve informational context like flood zone, hazard index, school district, broadband availability, air quality, water system, electric utility, housing-market context, nearby EV charging, weather, and recall data. Move-briefing text may be generated by a third-party AI provider using only coarse, de-identified signals. Your name, email, and account data are never sent to those services. These outputs are informational only, are not professional advice, and are not insurance, lending, legal, or safety determinations; their accuracy follows the public sources. The Privacy Policy describes these data flows in detail.",
        "Move does not guarantee uninterrupted access, perfect availability, or error-free results. Maintenance, outages, data-entry mistakes, stale public information, third-party failures, beta features, or unsupported integrations may affect the service.",
      ],
    },
    {
      heading: "9. Suspension and termination",
      paragraphs: [
        "Move may suspend, limit, or terminate access if we reasonably believe you violated these Terms, the Acceptable Use Policy, law, payment obligations, security requirements, or another user's rights.",
        "You may stop using Move at any time. Some records may be retained as described in the Privacy Policy, Billing Policy, Refund Policy, security logs, backups, audit records, legal records, or payment processor records.",
      ],
    },
    {
      heading: "10. Warranty disclaimer",
      paragraphs: [
        "To the fullest extent permitted by applicable law, the service is provided on an \"as is\" and \"as available\" basis, with all faults and without warranty of any kind. Move expressly disclaims all warranties, whether express, implied, statutory, or otherwise, including any implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement, and any warranties arising from course of dealing or usage of trade.",
        "Move does not warrant that: (i) the service will be uninterrupted, timely, secure, or error-free; (ii) any provider listing, directory entry, score, recommendation, ranking, state rule, deadline, budget estimate, checklist, or other information is accurate, complete, current, or fit for any purpose; or (iii) any result obtained from the service will meet your requirements.",
        "Move is an organizational software product, not professional advice. Nothing in the service constitutes legal, tax, financial, insurance, real estate, immigration, healthcare, government, or moving-professional advice, and Move does not act as your broker, agent, or representative with any provider or agency. You must independently verify provider details, pricing, licensing, insurance, eligibility, timing, cancellation requirements, and government deadlines directly with the relevant provider, agency, or a qualified licensed professional before acting. Completing a task in Move does not change or update any external provider or government account unless a product screen expressly states that a supported integration performed that action.",
        "Some jurisdictions do not allow the exclusion of certain implied warranties, so some of the above exclusions may not apply to you.",
      ],
    },
    {
      heading: "11. Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by applicable law, in no event will Move, or its officers, directors, employees, agents, suppliers, or licensors, be liable to you for any indirect, incidental, consequential, exemplary, punitive, or special damages, or for any lost profits, lost revenue, lost data, lost goodwill, business interruption, or cost of substitute services, arising out of or relating to your use of, or inability to use, the service — even if Move has been advised of the possibility of such damages, and regardless of the theory of liability (contract, tort including negligence, strict liability, or otherwise). This includes, without limitation, damages arising from missed filings or deadlines, denied or delayed applications, service lapses or lockouts, identity or account issues, billing disputes, provider conduct or pricing, stale or inaccurate public or provider information, data-entry errors, migration losses, or your reliance on any recommendation, ranking, estimate, checklist, reminder, or other product output.",
        "Move's total cumulative liability for all claims arising out of or relating to the service or these Terms will not exceed the greater of (i) the total fees you actually paid to Move for the service in the twelve (12) months immediately preceding the event giving rise to the claim, or (ii) one hundred U.S. dollars (US$100).",
        "These limitations apply to the maximum extent permitted by law and survive termination. Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above may not apply to you; in that case, Move's liability is limited to the smallest amount permitted by law.",
      ],
    },
    {
      heading: "12. Indemnification",
      paragraphs: [
        "To the fullest extent permitted by applicable law, you agree to defend, indemnify, and hold harmless Move and its officers, directors, employees, agents, suppliers, and licensors from and against any and all claims, demands, actions, liabilities, damages, losses, penalties, and expenses (including reasonable attorneys' fees and costs) arising out of or related to: (i) your use or misuse of the service; (ii) your violation of these Terms, the Acceptable Use Policy, or any applicable law or regulation; (iii) any content or data you enter, upload, or transmit through the service, including data you lacked the right or authority to use; (iv) your infringement or violation of any third party's rights, including privacy, publicity, or intellectual-property rights; and (v) your interactions with, applications to, or reliance on any provider, agency, or third party.",
        "Move reserves the right, at your expense, to assume the exclusive defense and control of any matter subject to indemnification by you, in which case you agree to cooperate with Move's defense of that claim. You will not settle any matter that imposes liability or admissions on Move without Move's prior written consent. This section survives termination of these Terms.",
      ],
    },
    {
      heading: "13. Binding arbitration and class-action waiver",
      paragraphs: [
        "Please read this section carefully — it affects your legal rights, including your right to a jury trial and to participate in a class action.",
        "Agreement to arbitrate. You and Move agree that any dispute, claim, or controversy arising out of or relating to the service or these Terms (a \"Dispute\") will be resolved by final and binding individual arbitration, rather than in court, except as set out in this section. The arbitration will be administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules, and may be conducted by telephone, video, written submissions, or in person in the county and state of your residence, at your election where the rules allow.",
        "Small-claims carve-out. Either party may instead bring an individual claim in small-claims court if the claim qualifies and stays in that court. Either party may also seek injunctive or other equitable relief in court to protect intellectual-property or unauthorized-access rights.",
        "Class-action waiver. You and Move each agree that you may bring claims against the other only in your individual capacity, and not as a plaintiff or class member in any purported class, collective, consolidated, or representative proceeding. In plain terms: you are giving up the right to participate in a class action, and disputes between you and Move will be handled one-on-one. The arbitrator may not consolidate more than one person's claims and may not preside over any form of representative or class proceeding.",
        "30-day opt-out. You may opt out of this arbitration agreement within thirty (30) days of first accepting these Terms (or of the date this section first applies to you) by sending written notice to legal@locateflow.com stating your name, the email associated with your account, and a clear statement that you wish to opt out of arbitration. Opting out does not affect any other part of these Terms.",
        "Severability of this section. If the class-action waiver above is found unenforceable as to a particular claim, that claim (and only that claim) will proceed in court; the remainder of this arbitration agreement survives.",
      ],
    },
    {
      heading: "14. Governing law and venue",
      paragraphs: [
        "These Terms and any Dispute are governed by the laws of the State of Delaware, United States, without regard to its conflict-of-laws rules, and by applicable U.S. federal law (including the Federal Arbitration Act for the arbitration section). The United Nations Convention on Contracts for the International Sale of Goods does not apply.",
        "Subject to the Binding Arbitration section above, any Dispute not subject to arbitration will be brought exclusively in the state or federal courts located in the State of Delaware, United States, and you and Move consent to the personal jurisdiction of, and venue in, those courts. Nothing in this section limits either party's right to bring a qualifying claim in small-claims court.",
      ],
    },
    {
      heading: "15. Force majeure",
      paragraphs: [
        "Move will not be liable or in breach for any delay or failure to perform resulting from causes beyond its reasonable control, including acts of God, natural disasters, fire, flood, epidemic or pandemic, war, terrorism, civil unrest, government action or order, labor disputes, power or telecommunications failures, internet or hosting-provider outages, third-party service or payment-processor failures, cyberattacks, or denial-of-service events. During a force-majeure event, Move's affected obligations are suspended for the duration of the event, and Move will use commercially reasonable efforts to resume performance. A force-majeure event does not excuse your obligation to pay amounts already due.",
      ],
    },
    {
      heading: "16. Severability and entire agreement",
      paragraphs: [
        "Severability. If any provision of these Terms is held invalid, illegal, or unenforceable by a court or arbitrator of competent jurisdiction, that provision will be enforced to the maximum extent permissible and, to the extent it cannot be, will be severed; the remaining provisions will remain in full force and effect. The class-action waiver in the Binding Arbitration section is governed by its own severability rule and is not subject to this general provision.",
        "Entire agreement. These Terms, together with the Privacy Policy, Disclaimer, Billing Policy, Refund Policy, Acceptable Use Policy, and (where applicable) the Data Processing Addendum and any order or checkout terms, constitute the entire agreement between you and Move regarding the service and supersede all prior or contemporaneous understandings, agreements, representations, and warranties, whether written or oral, on that subject. Where these documents conflict, the more specific policy controls its subject matter, except as a court or arbitrator finalizes a different order. No waiver of any term is a continuing waiver, and Move's failure to enforce a provision is not a waiver of its right to do so later. You may not assign these Terms without Move's consent; Move may assign them in connection with a merger, acquisition, or sale of assets.",
      ],
    },
    {
      heading: "17. Copyright complaints (DMCA)",
      paragraphs: [
        "Move respects intellectual-property rights and responds to clear notices of alleged copyright infringement under the U.S. Digital Millennium Copyright Act (DMCA). If you believe content available through the service infringes a copyright you own or control, send a written notice to Move's Designated Copyright Agent that includes: (i) your physical or electronic signature; (ii) identification of the copyrighted work claimed to be infringed; (iii) identification of the allegedly infringing material and information reasonably sufficient to locate it; (iv) your contact information (name, address, telephone, email); (v) a statement that you have a good-faith belief the use is not authorized by the copyright owner, its agent, or the law; and (vi) a statement, under penalty of perjury, that the information in the notice is accurate and that you are authorized to act on the owner's behalf.",
        "Send DMCA notices to Move's Designated Copyright Agent at legal@locateflow.com. Mailing-address details for the Designated Copyright Agent are available on the public Contact page.",
        "Move may remove or disable access to allegedly infringing material and, in appropriate circumstances, terminate the accounts of repeat infringers. A user whose content was removed may submit a counter-notice as permitted by the DMCA.",
      ],
    },
    {
      heading: "18. Changes to the service or Terms",
      paragraphs: [
        "Move may change the service, features, policies, pricing, and these Terms. When changes are material, Move will use reasonable efforts to provide notice through the product, email, checkout, or public policy pages.",
        "Continued use after an effective update means you accept the updated Terms to the extent permitted by law.",
      ],
    },
    {
      heading: "19. Order of precedence and contact",
      paragraphs: [
        "These Terms govern general use of Move. The Privacy Policy governs personal data practices; the Billing Policy governs subscription billing; the Refund Policy governs refund requests; the DPA governs applicable business-customer processing terms; and the Acceptable Use Policy governs prohibited conduct. If documents conflict, the more specific policy controls its subject matter unless legal counsel finalizes a different order.",
        "Legal entity details, mailing address, support, privacy, billing, legal notice, security, and DPA contact channels are listed on the public Contact page.",
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
    "Move stores and organizes user-entered relocation information for convenience only. The user, not Move, remains responsible for verifying and lawfully using every piece of information entered into the system.",
  highlights: [
    "Addresses, provider names, billing details, move tasks, move timelines, custom-provider records, and uploaded files may be incomplete, outdated, or incorrect because they depend on user entry and third-party systems.",
    "Move does not guarantee compliance with U.S. federal, state, county, city, agency, utility, insurance, tax, or licensing rules and is not responsible for missed filings, penalties, denials, service lapses, or other legal consequences.",
    "Move is not a provider marketplace and does not guarantee provider availability, quality, pricing, licensing, insurance, ratings, or performance.",
    "Even so, you remain solely responsible for reviewing, correcting, updating, backing up, and lawfully relying on your own information and decisions.",
  ],
  sections: [
    {
      heading: "What data we collect and why",
      paragraphs: [
        "Move may collect account identifiers, names, emails, profile preferences, addresses, move-planning details, provider selections, user-created custom providers, move tasks, billing notes, uploaded files, reminders, and activity logs in order to operate the product and secure the platform.",
        "This information is used to provide features such as provider recommendations, relocation checklists, move tasks, service tracking, reminders, document management, troubleshooting, abuse prevention, and product reliability improvements.",
        "When you save an address, its coordinates or area identifiers — never your name, email, or account details — may be sent to public and government data services (FEMA, EPA, NCES, NWS, FCC, DOE/OpenEI, HUD, NLR/AFDC) to retrieve informational context such as flood zone, school district, broadband, air quality, utility, housing-market, nearby EV charging, and weather data; a VIN you enter is sent only to NHTSA for vehicle and recall details. Move-briefing text may be generated by a third-party AI provider using only coarse, de-identified signals (state-level location, household shape, approximate days to move). These results are informational only and are described further in the Privacy Policy.",
      ],
    },
    {
      heading: "No legal, tax, financial, insurance, or healthcare advice",
      paragraphs: [
        "Move does not replace licensed counsel, certified public accountants, enrolled agents, insurance producers, healthcare professionals, or lenders.",
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
        "Move is not a provider marketplace, broker, insurer, utility, government agency, mover, or regulated advisor. We do not guarantee provider availability, quality, pricing, licensing, insurance, service territory, ratings, response time, or performance.",
        "Move is not responsible for provider conduct, pricing changes, service quality, application outcomes, account lockouts, fraud, denials, network outages, or any third-party statement or omission.",
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
        "Move does not sell user-entered relocation data for commercial advertising or broker-style resale purposes.",
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

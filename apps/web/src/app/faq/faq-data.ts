export type FaqCopy = { q: string; plain: string };

export const faqCopyGroups: Array<{ title: string; items: FaqCopy[] }> = [
  {
    title: "Product scope",
    items: [
      {
        q: "What does LocateFlow do?",
        plain:
          "LocateFlow helps organize addresses, service-provider records, moving tasks, reminders, documents, budgets, exports, and support workflows. It does not replace providers or agencies.",
      },
      {
        q: "Is LocateFlow a provider marketplace?",
        plain:
          "No. LocateFlow is an organizational tool and provider research aid. It does not sell provider services, guarantee availability, or act as a broker.",
      },
      {
        q: "Are providers guaranteed or endorsed?",
        plain:
          "No. Provider listings, recommendations, ratings, and public-source information may be incomplete, outdated, or unavailable. Users must verify details independently.",
      },
      {
        q: "Does LocateFlow provide legal, financial, insurance, tax, real estate, or moving advice?",
        plain:
          "No. LocateFlow provides informational organization tools and suggestions only. Users should consult authoritative sources or licensed professionals.",
      },
      {
        q: "What is included in the free plan?",
        plain:
          "The free plan organizes your home: up to 3 addresses, unlimited providers and services, and bill and renewal reminders. When you have a move planned, the free plan shows a preview of your personalized plan — your countdown and top critical steps. Creating and tracking the full move plan (checklist, state guide, provider migration, and move tasks) requires the Individual, Family, or Pro plan.",
      },
    ],
  },
  {
    title: "Billing, trials, and refunds",
    items: [
      {
        q: "How does billing work?",
        plain:
          "Web subscriptions are billed through Stripe. iOS purchases may be managed by Apple App Store and Android purchases by Google Play.",
      },
      {
        q: "How do free trials and promotions work?",
        plain:
          "Trial length, price, renewal date, and payment method requirements are shown at checkout before purchase. Some offers require a payment method and renew automatically unless canceled.",
      },
      {
        q: "How do I cancel?",
        plain:
          "Supported web subscriptions can be canceled in Settings or the Stripe portal. App Store and Google Play subscriptions must be managed through the applicable store.",
      },
      {
        q: "Are refunds available?",
        plain:
          "Refund eligibility depends on the Refund Policy, the checkout offer, legal requirements, and store rules for mobile purchases.",
      },
      {
        q: "How do App Store and Google Play subscriptions work?",
        plain:
          "Store purchases may be billed, renewed, canceled, and refunded through Apple or Google under their own rules.",
      },
    ],
  },
  {
    title: "Data, privacy, and cookies",
    items: [
      {
        q: "What data does LocateFlow collect?",
        plain:
          "LocateFlow may collect account, profile, address, service, moving, budget, support, billing, device, analytics, push, consent, audit, and security data.",
      },
      {
        q: "Can I export or delete my data?",
        plain:
          "Export and deletion tools are available in settings. Some backups, billing records, audit logs, legal records, security logs, and processor records may be retained when needed.",
      },
      {
        q: "How do cookies and analytics work?",
        plain:
          "Web analytics is consent-gated. Necessary cookies and storage may still be used for security and product operation.",
      },
      {
        q: "How are mobile push notifications controlled?",
        plain:
          "Push notifications depend on app, device, and notification preferences. Push tokens may be stored to deliver notifications when enabled.",
      },
      {
        q: "Is LocateFlow GDPR or CCPA certified?",
        plain:
          "No certification is claimed. LocateFlow provides privacy tools and California privacy rights workflows where applicable, but legal compliance positioning requires counsel review.",
      },
    ],
  },
  {
    title: "Support and security",
    items: [
      {
        q: "How do I contact support, privacy, billing, legal, or security?",
        plain:
          "Use the Contact page for support, billing, privacy, legal notices, security reports, and DPA inquiries.",
      },
      {
        q: "How does LocateFlow protect account data?",
        plain:
          "LocateFlow uses access controls, TLS, password hashing, rate limits, logging, and security procedures. It does not claim perfect security or a certification.",
      },
    ],
  },
];

export function faqSchemaItems() {
  return faqCopyGroups.flatMap((group) =>
    group.items.map((item) => ({
      question: item.q,
      answer: item.plain,
    })),
  );
}

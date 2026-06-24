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
        q: "What is included? Is it really free?",
        plain:
          "LocateFlow is 100% free — every feature is included for everyone, with no subscription, no payments, and no credit card. That covers the full personalized move plan, checklist, state guide, provider migration, move tasks, the complete Home Dossier, reminders, budgets, and exports. A few generous fair-use limits keep it fast and free for everyone; they are abuse safeguards, not a prompt to pay. LocateFlow stays free through affiliate and referral commissions when you choose a provider through us — at no cost to you.",
      },
    ],
  },
  {
    title: "Cost and affiliate disclosure",
    items: [
      {
        q: "How does LocateFlow make money if it's free?",
        plain:
          "LocateFlow earns referral or affiliate commissions when you choose certain providers or services through the app. The partner pays us, at no extra cost to you, and it never affects the price you pay or how we rank or recommend providers. There is no consumer subscription or charge.",
      },
      {
        q: "Do I need a credit card or a subscription?",
        plain:
          "No. There is no credit card, no subscription, and no trial that ends. You sign up and use every feature for free.",
      },
      {
        q: "Will I ever be charged?",
        plain:
          "No. LocateFlow does not charge consumers. Because there is nothing to bill, there is nothing to cancel or refund. Our Billing Policy and Refund Policy are retained only in case paid plans are reintroduced in the future.",
      },
      {
        q: "Does choosing a recommended provider cost extra?",
        plain:
          "No. When you choose a provider through LocateFlow, you pay that provider their normal price. Any commission is paid to us by the partner, at no extra cost to you, and it never affects how we rank or recommend providers.",
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

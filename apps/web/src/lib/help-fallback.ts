export interface HelpArticleFallback {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  category: string;
  tags: string;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
}

export interface FaqFallback {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export const FALLBACK_HELP_ARTICLES: HelpArticleFallback[] = [
  {
    id: "fallback-getting-started",
    slug: "getting-started",
    title: "Getting started",
    excerpt: "Set up your profile, first address, services, and optional moving plan.",
    category: "Getting Started",
    tags: JSON.stringify(["onboarding", "addresses", "services"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Start by completing onboarding, adding your current address, and deciding whether to track providers now or later. Provider selection is optional; you can continue without listed providers and add local/custom providers from Services.",
  },
  {
    id: "fallback-providers-vs-services",
    slug: "providers-vs-services",
    title: "Providers vs. services",
    excerpt: "Understand the difference between directory entries and your tracked accounts.",
    category: "Core Concepts",
    tags: JSON.stringify(["providers", "services"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Providers are listed directory entries or private custom entries, such as a utility, bank, dentist, or gym. Services are your actual tracked accounts tied to an address. Adding a provider creates a local LocateFlow service record; it does not contact or update the provider.",
  },
  {
    id: "fallback-moving-tasks",
    slug: "moving-tasks",
    title: "How moving tasks work",
    excerpt: "Moving tasks are local checklist items for you to complete manually.",
    category: "Moving",
    tags: JSON.stringify(["moving", "tasks"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Moving tasks help you track what to do before and after a move. Completing a task updates LocateFlow only. You still confirm deadlines, availability, account changes, and official requirements directly with the relevant provider or agency.",
  },
  {
    id: "fallback-provider-disclaimer",
    slug: "listed-providers-unverified",
    title: "Listed providers are unverified",
    excerpt: "Provider listings are directory guidance, not availability guarantees.",
    category: "Providers",
    tags: JSON.stringify(["providers", "coverage"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Provider data is listed directory guidance. A provider appearing for a state or category does not guarantee address-level availability. Confirm coverage, pricing, eligibility, and account actions directly with the provider before acting.",
  },
  {
    id: "fallback-account-security",
    slug: "account-security",
    title: "Account and security basics",
    excerpt: "Use Settings to manage passwords, sessions, and account access.",
    category: "Account",
    tags: JSON.stringify(["account", "security"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Use Settings to review account details, security options, and active sessions. If you signed up with Google, use account security to add a password only while signed in.",
  },
  {
    id: "fallback-export-delete",
    slug: "export-delete-data",
    title: "Export or delete your data",
    excerpt: "Download your account data or request account deletion from Settings.",
    category: "Privacy",
    tags: JSON.stringify(["export", "delete", "privacy"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Data export and account deletion controls are available from Settings. Export your data before deletion if you need a copy of supported records. Some backups, billing records, audit logs, legal records, and security records may be retained when needed.",
  },
  {
    id: "fallback-billing-basics",
    slug: "billing-basics",
    title: "Billing basics",
    excerpt: "Current billing flows are available from Settings when configured.",
    category: "Billing",
    tags: JSON.stringify(["billing", "subscription"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Billing and subscription controls appear in Settings when the payment environment is configured. Export/delete data controls remain available regardless of subscription state.",
  },
  {
    id: "fallback-support-contact",
    slug: "support-contact",
    title: "Contact support",
    excerpt: "Open a support ticket from the Support page after signing in.",
    category: "Support",
    tags: JSON.stringify(["support"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "If you need account-specific help, sign in and open a support ticket from Support. Include the page you were on, what you expected, and any non-sensitive error message you saw.",
  },
];

export const FALLBACK_FAQS: FaqFallback[] = [
  {
    id: "fallback-faq-providers-services",
    category: "Core Concepts",
    question: "What is the difference between Providers and Services?",
    answer: "Providers are directory or custom entries. Services are your own tracked accounts tied to an address.",
  },
  {
    id: "fallback-faq-provider-availability",
    category: "Providers",
    question: "Does a listed provider mean it is available at my address?",
    answer: "No. Listings are unverified directory guidance. Confirm availability and account actions directly with the provider.",
  },
  {
    id: "fallback-faq-skip-providers",
    category: "Onboarding",
    question: "Can I continue if no providers are listed?",
    answer: "Yes. Provider selection is optional. You can continue onboarding and add a local/custom provider later from Services.",
  },
  {
    id: "fallback-faq-moving-tasks",
    category: "Moving",
    question: "Does LocateFlow complete provider tasks for me?",
    answer: "No. LocateFlow tracks local checklist progress only; you complete external provider or agency steps yourself.",
  },
  {
    id: "fallback-faq-export-delete",
    category: "Privacy",
    question: "Can I export or delete my data?",
    answer: "Yes. Use Settings to export supported data or start account deletion. Some backups, billing records, audit logs, legal records, and security records may be retained when needed.",
  },
];

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { JsonLd, breadcrumbSchema, faqPageSchema } from "@/components/seo/json-ld";
import { absoluteUrl, createPublicPageMetadata, SITE_URL } from "@/lib/seo";
import { LEGAL_CONTACTS, mailto, policyLastUpdatedLabel } from "@/lib/legal-info";

export const metadata = createPublicPageMetadata({
  title: "Frequently Asked Questions",
  description:
    "Billing, trials, refunds, privacy, cookies, provider recommendations, mobile subscriptions, and security answers for LocateFlow.",
  path: "/faq",
});

type Faq = { q: string; a: ReactNode; plain: string };

const groups: Array<{ title: string; items: Faq[] }> = [
  {
    title: "Product scope",
    items: [
      {
        q: "What does LocateFlow do?",
        plain: "LocateFlow helps organize addresses, service-provider records, moving tasks, reminders, documents, budgets, exports, and support workflows. It does not replace providers or agencies.",
        a: "LocateFlow helps organize addresses, service-provider records, moving tasks, reminders, documents, budgets, exports, and support workflows. It does not replace providers or agencies.",
      },
      {
        q: "Is LocateFlow a provider marketplace?",
        plain: "No. LocateFlow is an organizational tool and provider research aid. It does not sell provider services, guarantee availability, or act as a broker.",
        a: (
          <>
            No. LocateFlow is an organizational tool and provider research aid. It does not sell provider services, guarantee availability, or act as a broker. See the{" "}
            <Link href="/disclaimer" className="underline">Disclaimer</Link>.
          </>
        ),
      },
      {
        q: "Are providers guaranteed or endorsed?",
        plain: "No. Provider listings, recommendations, ratings, and public-source information may be incomplete, outdated, or unavailable. Users must verify details independently.",
        a: "No. Provider listings, recommendations, ratings, and public-source information may be incomplete, outdated, or unavailable. You must verify price, availability, licensing, insurance, coverage, and performance directly with the provider.",
      },
      {
        q: "Does LocateFlow provide legal, financial, insurance, tax, real estate, or moving advice?",
        plain: "No. LocateFlow provides informational organization tools and suggestions only. Users should consult authoritative sources or licensed professionals.",
        a: "No. LocateFlow provides informational organization tools and suggestions only. Consult the relevant provider, agency, or licensed professional before relying on deadlines, costs, eligibility rules, or legal obligations.",
      },
    ],
  },
  {
    title: "Billing, trials, and refunds",
    items: [
      {
        q: "How does billing work?",
        plain: "Web subscriptions are billed through Stripe. iOS purchases may be managed by Apple App Store and Android purchases by Google Play.",
        a: (
          <>
            Web subscriptions are billed through Stripe. iOS purchases may be managed by Apple App Store and Android purchases by Google Play. See the{" "}
            <Link href="/billing-policy" className="underline">Billing Policy</Link>.
          </>
        ),
      },
      {
        q: "How do free trials and promotions work?",
        plain: "Trial length, price, renewal date, and payment method requirements are shown at checkout before purchase. Some offers require a payment method and renew automatically unless canceled.",
        a: "Trial length, price, renewal date, and payment method requirements are shown at checkout before purchase. Some offers require a payment method and renew automatically unless canceled.",
      },
      {
        q: "How do I cancel?",
        plain: "Supported web subscriptions can be canceled in Settings or the Stripe portal. App Store and Google Play subscriptions must be managed through the applicable store.",
        a: "Supported web subscriptions can be canceled in Settings or the Stripe portal. App Store and Google Play subscriptions must be managed through the applicable store. Cancellation stops future renewal where supported but does not automatically refund previous charges.",
      },
      {
        q: "Are refunds available?",
        plain: "Refund eligibility depends on the Refund Policy, the checkout offer, legal requirements, and store rules for mobile purchases.",
        a: (
          <>
            Refund eligibility depends on the <Link href="/refund" className="underline">Refund Policy</Link>, the checkout offer, legal requirements, and Apple App Store or Google Play rules for store purchases.
          </>
        ),
      },
      {
        q: "How do App Store and Google Play subscriptions work?",
        plain: "Store purchases may be billed, renewed, canceled, and refunded through Apple or Google under their own rules.",
        a: "Store purchases may be billed, renewed, canceled, and refunded through Apple or Google under their own rules. LocateFlow may show status in the app, but the store may control receipts, cancellation, and refunds.",
      },
    ],
  },
  {
    title: "Data, privacy, and cookies",
    items: [
      {
        q: "What data does LocateFlow collect?",
        plain: "LocateFlow may collect account, profile, address, service, moving, budget, support, billing, device, analytics, push, consent, audit, and security data.",
        a: (
          <>
            LocateFlow may collect account, profile, address, service, moving, budget, support, billing, device, analytics, push, consent, audit, and security data. See the{" "}
            <Link href="/privacy" className="underline">Privacy Policy</Link>.
          </>
        ),
      },
      {
        q: "Can I export or delete my data?",
        plain: "Export and deletion tools are available in settings. Some backups, billing records, audit logs, legal records, security logs, and processor records may be retained when needed.",
        a: "Export and deletion tools are available in settings. Some backups, billing records, audit logs, legal records, security logs, and processor records may be retained when needed.",
      },
      {
        q: "How do cookies and analytics work?",
        plain: "Web analytics is consent-gated. Necessary cookies and storage may still be used for security and product operation.",
        a: (
          <>
            Web analytics is consent-gated. Necessary cookies and storage may still be used for security and product operation. See the{" "}
            <Link href="/cookie-policy" className="underline">Cookie Policy</Link>.
          </>
        ),
      },
      {
        q: "How are mobile push notifications controlled?",
        plain: "Push notifications depend on app, device, and notification preferences. Push tokens may be stored to deliver notifications when enabled.",
        a: "Push notifications depend on app, device, and notification preferences. Push tokens may be stored to deliver notifications when enabled. You can adjust preferences in app settings and device settings.",
      },
      {
        q: "Is LocateFlow GDPR or CCPA certified?",
        plain: "No certification is claimed. LocateFlow provides privacy tools and California privacy rights workflows where applicable, but legal compliance positioning requires counsel review.",
        a: (
          <>
            LocateFlow does not claim privacy certification. It provides privacy tools and California privacy workflows where applicable. See the{" "}
            <Link href="/ccpa-privacy-notice" className="underline">California Privacy Notice</Link>.
          </>
        ),
      },
    ],
  },
  {
    title: "Support and security",
    items: [
      {
        q: "How do I contact support, privacy, billing, legal, or security?",
        plain: "Use the Contact page for support, billing, privacy, legal notices, security reports, and DPA inquiries.",
        a: (
          <>
            Use the <Link href="/contact" className="underline">Contact page</Link> or email support at{" "}
            <a href={mailto(LEGAL_CONTACTS.support, "LocateFlow support request")} className="underline">{LEGAL_CONTACTS.support}</a>.
          </>
        ),
      },
      {
        q: "How does LocateFlow protect account data?",
        plain: "LocateFlow uses access controls, TLS, password hashing, rate limits, logging, and security procedures. It does not claim perfect security or a certification.",
        a: (
          <>
            LocateFlow uses access controls, TLS, password hashing, rate limits, logging, and security procedures. It does not claim perfect security or a certification. See the{" "}
            <Link href="/security" className="underline">Security overview</Link>.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  const faqItems = groups.flatMap((group) => group.items).map((item) => ({
    question: item.q,
    answer: item.plain,
  }));

  return (
    <>
      <JsonLd id="ld-faq" data={faqPageSchema(faqItems)} />
      <JsonLd
        id="ld-faq-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "FAQ", url: absoluteUrl("/faq") },
        ])}
      />
      <PublicPageShell
        eyebrow="FAQ"
        title="Questions, answered."
        description="Answers to common product, billing, privacy, provider, mobile, and security questions. Policy pages control if any summary here differs."
      >
        <p className="text-sm text-muted-foreground">{policyLastUpdatedLabel()}</p>

        {groups.map((group) => (
          <PublicSection key={group.title} title={group.title}>
            <div className="space-y-3">
              {group.items.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-xl border bg-background/60"
                >
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-sm font-medium text-foreground">
                    <span>{faq.q}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </PublicSection>
        ))}

        <PublicSection title="Still have a question?">
          <p>
            If you cannot find what you need in the public FAQ, reach us through the contact page or sign in for account-specific support.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/contact">
              <Button variant="outline" size="lg">
                <LifeBuoy className="mr-2 h-4 w-4" /> Contact us <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </PublicSection>
      </PublicPageShell>
    </>
  );
}

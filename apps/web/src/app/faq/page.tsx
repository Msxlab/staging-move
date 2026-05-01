import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ArrowRight, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { JsonLd, breadcrumbSchema, faqPageSchema } from "@/components/seo/json-ld";
import { absoluteUrl, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Billing, data, trial, cancellation, and security - answers to the questions people ask before signing up for LocateFlow.",
  alternates: {
    canonical: "/faq",
  },
};

type Faq = { q: string; a: string };

const groups: Array<{ title: string; items: Faq[] }> = [
  {
    title: "Trial & billing",
    items: [
      {
        q: "What is the difference between Free Access and Free Trial?",
        a: "Free Access does not require a payment method and does not auto-charge. Free Trial is attached to Individual Annual, requires a payment method at checkout, and gives full access during the trial.",
      },
      {
        q: "When does annual billing start?",
        a: "Checkout shows the exact first charge date before you agree. For the current Individual Annual offer, the annual plan starts after the 3-month trial.",
      },
      {
        q: "Can I cancel online?",
        a: "Yes. You can cancel a trial or turn off annual renewal in Settings. Trial access continues through the scheduled trial end date; paid annual access continues through the paid period.",
      },
      {
        q: "Does LocateFlow update provider accounts for me?",
        a: "No. LocateFlow gives you local task tracking, provider directory guidance, and reminders. Completing a task updates LocateFlow only; you still confirm and complete changes with the provider.",
      },
    ],
  },
  {
    title: "Data & privacy",
    items: [
      {
        q: "Where does my data live?",
        a: "On encrypted infrastructure in the US. Addresses, services, documents, and budget data are scoped to your account. We never sell or rent your information.",
      },
      {
        q: "Can I export everything?",
        a: "Yes - at any time, from settings. Exports include your account data, addresses, services, custom providers, move tasks, and related records. Free-form notes are exported only when you request notes.",
      },
      {
        q: "What happens to my data if I cancel?",
        a: "Your data stays available for 30 days after cancellation in case you come back. Export first if you want to keep records.",
      },
      {
        q: "Is LocateFlow GDPR / CCPA compliant?",
        a: "Yes. Account data, service records, and documents are subject to full export and deletion on request. See the Privacy Policy for the authoritative list.",
      },
    ],
  },
  {
    title: "How it works",
    items: [
      {
        q: "What counts as a service?",
        a: "Anything that sends you a bill or statement tied to an address. Utility, bank accounts, insurance, streaming, gym, HOA, alarm monitoring, and similar services all count.",
      },
      {
        q: "Do reminders reach me by email?",
        a: "Yes. Reminders appear in the app and can be sent by email. Push delivery is not enabled until the mobile push provider integration is connected.",
      },
      {
        q: "Does the moving checklist work in every state?",
        a: "Move guidance can use destination state and ZIP context across 51 US jurisdictions. Service actions are local suggestions, and address-sensitive providers still need confirmation.",
      },
      {
        q: "Can I use LocateFlow for someone else's move?",
        a: "Only use LocateFlow with information you have permission to manage. The current product is built for personal moving workflows and local service tracking.",
      },
    ],
  },
  {
    title: "Mobile apps",
    items: [
      {
        q: "Are iOS and Android apps available?",
        a: "The mobile apps are in closed beta. Join the waitlist on the home page and we'll invite you as we expand the beta group.",
      },
      {
        q: "Can I use LocateFlow on the web?",
        a: "Yes. The web app is production-ready and covers every core workflow: addresses, services, reminders, moving, budget, documents, and export.",
      },
    ],
  },
];

export default function FaqPage() {
  const faqItems = groups.flatMap((group) => group.items).map((item) => ({
    question: item.q,
    answer: item.a,
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
        description="What you'll probably want to know before you sign up. Grouped by the thing you're thinking about."
      >
      {groups.map((group) => (
        <PublicSection key={group.title} title={group.title}>
          <div className="space-y-3">
            {group.items.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border bg-background/60"
              >
                <summary className="flex items-center justify-between cursor-pointer px-5 py-3.5 text-sm font-medium text-foreground">
                  <span>{faq.q}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </PublicSection>
      ))}

      <PublicSection title="Still have a question?">
        <p>
          If you can't find what you need in the public FAQ, reach us through the contact page or sign in for account-specific support.
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

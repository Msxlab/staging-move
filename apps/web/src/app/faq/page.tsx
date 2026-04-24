import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ArrowRight, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Billing, data, trial, cancellation, and security — answers to the questions people ask before signing up for LocateFlow.",
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
        q: "How does the 14-day free trial work?",
        a: "You can explore every Individual feature for 14 days without a credit card. If you don't upgrade, your account stays in read-only mode — your data is preserved for 30 days.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. Cancellation takes effect at the end of the current billing period, and no future charges are made. You can still export your data for 30 days after cancellation.",
      },
      {
        q: "Do you offer refunds?",
        a: "If something isn't right in the first 14 days of a paid plan, reach out and we'll refund the period. After that, cancellation ends future charges but does not pro-rate the current period.",
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
        a: "Your data stays available for 30 days after cancellation in case you come back. After 30 days we purge it. Export first if you want to keep records.",
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
        q: "What counts as a \"service\"?",
        a: "Anything that sends you a bill or statement tied to an address. Utility (power, water, gas, internet), bank accounts, insurance, streaming, gym, HOA, alarm monitoring — all count.",
      },
      {
        q: "Do reminders reach me by email or push?",
        a: "Both, by default. You can turn off either in settings. Reminders fire a few days before the auto-renew window so you have time to act.",
      },
      {
        q: "Does the moving checklist work in every state?",
        a: "Move guidance can use destination state and ZIP context across 51 US jurisdictions (50 states + DC). Service actions are local suggestions, and address-sensitive providers still need confirmation.",
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
        a: "Yes. The web app is production-ready and covers every core workflow — addresses, services, reminders, moving, budget, documents, and export.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
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
          The Help Center has step-by-step guides for every feature. If you can't find what you need, reach us through the contact page.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/help">
            <Button size="lg">
              <LifeBuoy className="mr-2 h-4 w-4" /> Open Help Center
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline" size="lg">
              Contact us <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}

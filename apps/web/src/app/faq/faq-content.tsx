import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_CONTACTS, mailto } from "@/lib/legal-info";
import { faqCopyGroups } from "./faq-data";

export type Faq = { q: string; a: ReactNode; plain: string };

const linkedAnswers: Record<string, ReactNode> = {
  "Is Move a provider marketplace?": (
    <>
      No. Move is an organizational tool and provider research aid. It does not sell provider services, guarantee
      availability, or act as a broker. See the{" "}
      <Link href="/disclaimer" className="underline">
        Disclaimer
      </Link>
      .
    </>
  ),
  "How does billing work?": (
    <>
      Web subscriptions are billed through Stripe. iOS purchases may be managed by Apple App Store and Android purchases
      by Google Play. See the{" "}
      <Link href="/billing-policy" className="underline">
        Billing Policy
      </Link>
      .
    </>
  ),
  "Are refunds available?": (
    <>
      Refund eligibility depends on the{" "}
      <Link href="/refund" className="underline">
        Refund Policy
      </Link>
      , the checkout offer, legal requirements, and Apple App Store or Google Play rules for store purchases.
    </>
  ),
  "What data does Move collect?": (
    <>
      Move may collect account, profile, address, service, moving, budget, support, billing, device, analytics,
      push, consent, audit, and security data. See the{" "}
      <Link href="/privacy" className="underline">
        Privacy Policy
      </Link>
      .
    </>
  ),
  "How do cookies and analytics work?": (
    <>
      Web analytics is consent-gated. Necessary cookies and storage may still be used for security and product operation.
      See the{" "}
      <Link href="/cookie-policy" className="underline">
        Cookie Policy
      </Link>
      .
    </>
  ),
  "Is Move GDPR or CCPA certified?": (
    <>
      Move does not claim privacy certification. It provides privacy tools and California privacy workflows where
      applicable. See the{" "}
      <Link href="/ccpa-privacy-notice" className="underline">
        California Privacy Notice
      </Link>
      .
    </>
  ),
  "How do I contact support, privacy, billing, legal, or security?": (
    <>
      Use the{" "}
      <Link href="/contact" className="underline">
        Contact page
      </Link>{" "}
      or email support at{" "}
      <a href={mailto(LEGAL_CONTACTS.support, "Move support request")} className="underline">
        {LEGAL_CONTACTS.support}
      </a>
      .
    </>
  ),
  "How does Move protect account data?": (
    <>
      Move uses access controls, TLS, password hashing, rate limits, logging, and security procedures. It does not
      claim perfect security or a certification. See the{" "}
      <Link href="/security" className="underline">
        Security overview
      </Link>
      .
    </>
  ),
};

export const faqGroups: Array<{ title: string; items: Faq[] }> = faqCopyGroups.map((group) => ({
  title: group.title,
  items: group.items.map((item) => ({
    ...item,
    a: linkedAnswers[item.q] ?? item.plain,
  })),
}));

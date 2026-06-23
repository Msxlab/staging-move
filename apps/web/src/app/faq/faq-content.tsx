import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_CONTACTS, mailto } from "@/lib/legal-info";
import { faqCopyGroups } from "./faq-data";

export type Faq = { q: string; a: ReactNode; plain: string };

const linkedAnswers: Record<string, ReactNode> = {
  "Is LocateFlow a provider marketplace?": (
    <>
      No. LocateFlow is an organizational tool and provider research aid. It does not sell provider services, guarantee
      availability, or act as a broker. See the{" "}
      <Link href="/disclaimer" className="underline">
        Disclaimer
      </Link>
      .
    </>
  ),
  "How does LocateFlow make money if it's free?": (
    <>
      LocateFlow earns referral or affiliate commissions when you choose certain providers or services through the app —
      the partner pays us, at no extra cost to you, and it never affects the price you pay or how we rank or recommend
      providers. There is no consumer subscription or charge. See{" "}
      <Link href="/why-free" className="underline">
        Why it&apos;s free
      </Link>
      .
    </>
  ),
  "Will I ever be charged?": (
    <>
      No. LocateFlow does not charge consumers, so there is nothing to bill or refund. Our{" "}
      <Link href="/billing-policy" className="underline">
        Billing Policy
      </Link>{" "}
      and{" "}
      <Link href="/refund" className="underline">
        Refund Policy
      </Link>{" "}
      are retained only in case paid plans are reintroduced in the future.
    </>
  ),
  "What data does LocateFlow collect?": (
    <>
      LocateFlow may collect account, profile, address, service, moving, budget, support, billing, device, analytics,
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
  "Is LocateFlow GDPR or CCPA certified?": (
    <>
      LocateFlow does not claim privacy certification. It provides privacy tools and California privacy workflows where
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
      <a href={mailto(LEGAL_CONTACTS.support, "LocateFlow support request")} className="underline">
        {LEGAL_CONTACTS.support}
      </a>
      .
    </>
  ),
  "How does LocateFlow protect account data?": (
    <>
      LocateFlow uses access controls, TLS, password hashing, rate limits, logging, and security procedures. It does not
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

import Link from "next/link";
import { FileCheck2, Scale, ShieldAlert, ShieldCheck } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { LEGAL_TERMS_DOCUMENT } from "@/lib/legal";
import {
  displayCompanyAddress,
  displayLegalEntityName,
  LEGAL_CONTACTS,
  mailto,
  policyLastUpdatedLabel,
} from "@/lib/legal-info";
import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: LEGAL_TERMS_DOCUMENT.title,
  description: LEGAL_TERMS_DOCUMENT.summary,
  path: "/terms",
});

const highlights = [
  {
    icon: FileCheck2,
    title: "Platform scope",
    description: LEGAL_TERMS_DOCUMENT.highlights[0],
  },
  {
    icon: Scale,
    title: "User responsibilities",
    description: LEGAL_TERMS_DOCUMENT.highlights[1],
  },
  {
    icon: ShieldAlert,
    title: "Independent verification",
    description: LEGAL_TERMS_DOCUMENT.highlights[2],
  },
  {
    icon: ShieldCheck,
    title: "Liability limits",
    description: LEGAL_TERMS_DOCUMENT.highlights[3],
  },
] as const;

const publicCompanyAddress = displayCompanyAddress();

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title={LEGAL_TERMS_DOCUMENT.title}
      description={LEGAL_TERMS_DOCUMENT.summary}
    >
      {/*
        Governing law / venue for these Terms is set to the State of Delaware, United States
        (sections 14, 16, and the arbitration section). Delaware is used as a common, defensible
        US-SaaS default. Owner action: confirm this jurisdiction (and the AAA Consumer Arbitration
        Rules choice) with licensed counsel, along with the legal entity name, mailing address,
        and registered DMCA Designated Copyright Agent, before relying on these clauses.
      */}
      <div className="rounded-2xl border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
        <p>{policyLastUpdatedLabel()}</p>
        <p>Terms effective date: June 7, 2026</p>
        <p>Legal entity: {displayLegalEntityName()}</p>
        <p>
          Legal notices:{" "}
          <a href={mailto(LEGAL_CONTACTS.legal, "LocateFlow legal notice")} className="underline">
            {LEGAL_CONTACTS.legal}
          </a>
        </p>
        {publicCompanyAddress ? <p>Mailing address: {publicCompanyAddress}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {highlights.map((item) => (
          <div key={item.title} className="rounded-2xl border bg-muted/30 p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>

      {LEGAL_TERMS_DOCUMENT.sections.map((section) => (
        <PublicSection key={section.heading} title={section.heading}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </PublicSection>
      ))}

      <PublicSection title="Related legal notice">
        <p>
          The separate policies below explain user-entered data, third-party provider information, billing, refunds, privacy, acceptable use, and legal-risk allocation inside LocateFlow.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/disclaimer" className="inline-flex text-sm font-medium text-primary hover:underline">Disclaimer</Link>
          <Link href="/privacy" className="inline-flex text-sm font-medium text-primary hover:underline">Privacy Policy</Link>
          <Link href="/billing-policy" className="inline-flex text-sm font-medium text-primary hover:underline">Billing Policy</Link>
          <Link href="/refund" className="inline-flex text-sm font-medium text-primary hover:underline">Refund Policy</Link>
          <Link href="/acceptable-use" className="inline-flex text-sm font-medium text-primary hover:underline">Acceptable Use</Link>
          <Link href="/dpa" className="inline-flex text-sm font-medium text-primary hover:underline">DPA</Link>
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}

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
      <div className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{policyLastUpdatedLabel()}</p>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Terms effective date: June 10, 2026</p>
        <p className="mt-2">Legal entity: {displayLegalEntityName()}</p>
        <p>
          Legal notices:{" "}
          <a href={mailto(LEGAL_CONTACTS.legal, "LocateFlow legal notice")} className="text-primary underline">
            {LEGAL_CONTACTS.legal}
          </a>
        </p>
        {publicCompanyAddress ? <p>Mailing address: {publicCompanyAddress}</p> : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {highlights.map((item) => (
          <div
            key={item.title}
            className="space-y-3 rounded-2xl border border-border bg-card p-7 transition hover:border-primary/40"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <h2 className="font-display text-base font-bold tracking-tight text-foreground">{item.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
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
          <Link href="/disclaimer" className="inline-flex rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-primary transition hover:border-primary/40">Disclaimer</Link>
          <Link href="/privacy" className="inline-flex rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-primary transition hover:border-primary/40">Privacy Policy</Link>
          <Link href="/billing-policy" className="inline-flex rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-primary transition hover:border-primary/40">Billing Policy</Link>
          <Link href="/refund" className="inline-flex rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-primary transition hover:border-primary/40">Refund Policy</Link>
          <Link href="/acceptable-use" className="inline-flex rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-primary transition hover:border-primary/40">Acceptable Use</Link>
          <Link href="/dpa" className="inline-flex rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-primary transition hover:border-primary/40">DPA</Link>
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}

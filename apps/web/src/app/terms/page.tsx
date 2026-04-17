import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2, Scale, ShieldAlert, ShieldCheck } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { LEGAL_TERMS_DOCUMENT } from "@/lib/legal";

export const metadata: Metadata = {
  title: LEGAL_TERMS_DOCUMENT.title,
  description: LEGAL_TERMS_DOCUMENT.summary,
  alternates: {
    canonical: "/terms",
  },
};

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

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title={LEGAL_TERMS_DOCUMENT.title}
      description={LEGAL_TERMS_DOCUMENT.summary}
    >
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
          The separate disclaimer explains how user-entered data, third-party provider information, and legal-risk allocation are handled inside LocateFlow.
        </p>
        <Link href="/disclaimer" className="inline-flex text-sm font-medium text-primary hover:underline">
          Read the User-Entered Data and Legal Risk Disclaimer
        </Link>
      </PublicSection>
    </PublicPageShell>
  );
}

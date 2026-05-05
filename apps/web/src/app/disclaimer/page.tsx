import { Database, FileWarning, Lock, ShieldAlert } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { LEGAL_DISCLAIMER_DOCUMENT } from "@/lib/legal";
import { policyLastUpdatedLabel } from "@/lib/legal-info";
import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: LEGAL_DISCLAIMER_DOCUMENT.title,
  description: LEGAL_DISCLAIMER_DOCUMENT.summary,
  path: "/disclaimer",
});

const highlights = [
  { icon: Database, title: "Collected data scope", description: LEGAL_DISCLAIMER_DOCUMENT.highlights[0] },
  { icon: ShieldAlert, title: "No regulated advice", description: LEGAL_DISCLAIMER_DOCUMENT.highlights[1] },
  { icon: Lock, title: "No commercial resale", description: LEGAL_DISCLAIMER_DOCUMENT.highlights[2] },
  { icon: FileWarning, title: "User responsibility", description: LEGAL_DISCLAIMER_DOCUMENT.highlights[3] },
] as const;

export default function DisclaimerPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title={LEGAL_DISCLAIMER_DOCUMENT.title}
      description={LEGAL_DISCLAIMER_DOCUMENT.summary}
    >
      <p className="text-sm text-muted-foreground">{policyLastUpdatedLabel()}</p>

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

      {LEGAL_DISCLAIMER_DOCUMENT.sections.map((section) => (
        <PublicSection key={section.heading} title={section.heading}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </PublicSection>
      ))}
    </PublicPageShell>
  );
}

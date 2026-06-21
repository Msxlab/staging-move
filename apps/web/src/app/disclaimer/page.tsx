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
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{policyLastUpdatedLabel()}</p>

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

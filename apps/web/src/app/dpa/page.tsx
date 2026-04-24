import type { Metadata } from "next";
import { Database, FileSignature, Globe2, ShieldCheck } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";

export const metadata: Metadata = {
  title: "Data Processing Addendum",
  description: "LocateFlow's Data Processing Addendum for business and pro customers.",
  alternates: { canonical: "/dpa" },
};

const highlights = [
  {
    icon: FileSignature,
    title: "Who this is for",
    description: "Relocation managers, realtors, and any customer who uses LocateFlow to process personal data on behalf of identifiable individuals.",
  },
  {
    icon: Database,
    title: "Roles",
    description: "The customer acts as the data controller for the personal data they enter. LocateFlow acts as a data processor for that data.",
  },
  {
    icon: ShieldCheck,
    title: "Security commitments",
    description: "LocateFlow maintains access controls, encryption in transit, and auditing suitable for the type of data typically stored in the product.",
  },
  {
    icon: Globe2,
    title: "International transfers",
    description: "Where data is transferred outside the customer's region, LocateFlow relies on standard contractual clauses or another lawful transfer mechanism.",
  },
] as const;

export default function DpaPage() {
  return (
    <PublicPageShell
      eyebrow="Legal · For business / Pro customers"
      title="Data Processing Addendum"
      description="This page summarizes LocateFlow's Data Processing Addendum (DPA). It applies in addition to the Terms of Use when you use LocateFlow to process personal data about other identifiable individuals."
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

      <PublicSection title="1. Definitions">
        <p>
          Capitalized terms used but not defined here have the meaning given in the LocateFlow <a href="/terms" className="underline">Terms of Use</a>. &quot;Personal Data&quot;, &quot;Data Subject&quot;, &quot;Data Controller&quot;, &quot;Data Processor&quot; and &quot;Processing&quot; have the meanings given under applicable data-protection law (including GDPR and CCPA, as applicable).
        </p>
      </PublicSection>

      <PublicSection title="2. Role of the parties">
        <p>
          When you use LocateFlow to store or process Personal Data about identifiable individuals (for example, a client whose relocation you are managing), you are the Data Controller and LocateFlow is the Data Processor. You instruct LocateFlow to process Personal Data for the purposes of providing the service.
        </p>
      </PublicSection>

      <PublicSection title="3. Processing instructions">
        <p>
          LocateFlow will process Personal Data only to (a) provide, operate, and secure the service; (b) comply with written instructions given through the product or through support channels; and (c) comply with applicable law. LocateFlow will not sell Personal Data and will not use it to build advertising profiles.
        </p>
      </PublicSection>

      <PublicSection title="4. Sub-processors">
        <p>
          LocateFlow relies on limited sub-processors for hosting, authentication, payments, transactional email, and error monitoring. A current list is available on request via the <a href="/contact" className="underline">Contact page</a>. LocateFlow imposes on each sub-processor written terms that are no less protective than those in this DPA.
        </p>
      </PublicSection>

      <PublicSection title="5. Security">
        <p>
          LocateFlow maintains technical and organizational measures including role-based access controls, encrypted transport (TLS), audit logging on sensitive operations, least-privilege credentials, and scheduled review of internal access. For more detail, see the <a href="/security" className="underline">Security overview</a>.
        </p>
      </PublicSection>

      <PublicSection title="6. Data subject rights">
        <p>
          You are responsible for responding to requests from data subjects (access, deletion, rectification, portability, objection). LocateFlow provides in-product tools — export, account deletion, and data correction — to help you comply. On reasonable request, LocateFlow will provide additional assistance.
        </p>
      </PublicSection>

      <PublicSection title="7. Breach notification">
        <p>
          LocateFlow will notify affected customers without undue delay after becoming aware of a personal data breach that materially affects the security of Personal Data processed under this DPA, together with the information reasonably required to meet the customer&apos;s own notification obligations.
        </p>
      </PublicSection>

      <PublicSection title="8. International transfers">
        <p>
          Where Personal Data is transferred across borders, LocateFlow relies on Standard Contractual Clauses or another lawful transfer mechanism. LocateFlow will cooperate with reasonable customer requests regarding such transfers.
        </p>
      </PublicSection>

      <PublicSection title="9. Return or deletion">
        <p>
          On termination, LocateFlow will delete or return Personal Data in accordance with the retention commitments in the Privacy Policy, subject to legal-hold and backup-rotation exceptions.
        </p>
      </PublicSection>

      <PublicSection title="10. Accepting this DPA">
        <p>
          By using LocateFlow to process Personal Data about identifiable third parties, you accept this DPA. Business and Pro customers who require a counter-signed copy can request one via <a href="/contact" className="underline">/contact</a>.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}

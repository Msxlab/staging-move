import { Database, FileSignature, Globe2, ShieldCheck } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import {
  displayLegalEntityName,
  LEGAL_CONTACTS,
  mailto,
  policyLastUpdatedLabel,
} from "@/lib/legal-info";
import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "Data Processing Addendum",
  description: "Move's Data Processing Addendum summary for customers processing personal data for others.",
  path: "/dpa",
});

const highlights = [
  {
    icon: FileSignature,
    title: "Who this is for",
    description: "Customers who use Move to process personal data on behalf of clients, households, employees, or other identifiable people.",
  },
  {
    icon: Database,
    title: "Roles",
    description: "The customer is generally controller for personal data they enter; Move acts as processor for that customer data.",
  },
  {
    icon: ShieldCheck,
    title: "Security measures",
    description: "Move uses access controls, TLS, logging, credential controls, and operational security practices appropriate to the data involved.",
  },
  {
    icon: Globe2,
    title: "Transfers",
    description: "International transfer terms and SCCs require counsel-finalized paperwork before full business launch.",
  },
] as const;

export default function DpaPage() {
  return (
    <PublicPageShell
      eyebrow="Legal - Business data"
      title="Data Processing Addendum"
      description="This DPA summary applies when a customer uses Move to process personal data about identifiable third parties. It requires legal counsel finalization before enterprise or regulated use."
    >
      <div className="space-y-2 rounded-[22px] border border-border bg-background/60 p-7 text-sm leading-6 text-muted-foreground">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{policyLastUpdatedLabel()}</p>
        <p>Legal entity: {displayLegalEntityName()}</p>
        <p>
          DPA contact:{" "}
          <a href={mailto(LEGAL_CONTACTS.dpa, "LocateFlow DPA inquiry")} className="text-primary underline">
            {LEGAL_CONTACTS.dpa}
          </a>
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {highlights.map((item) => (
          <div
            key={item.title}
            className="space-y-3 rounded-[22px] border border-border bg-background/60 p-7 transition hover:border-primary/40"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <h2 className="font-display text-base font-bold tracking-tight text-foreground">{item.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>

      <PublicSection title="1. Scope, duration, and roles">
        <p>
          This DPA applies only to personal data that a customer submits to Move for processing on behalf of another identifiable person. The customer determines the purposes and means of processing. Move processes that data to provide, secure, support, and improve the service.
        </p>
        <p>
          Processing lasts for the term of the customer's use of Move and any additional retention period described in the Privacy Policy, Terms, Billing Policy, security logs, backups, legal records, or processor records.
        </p>
      </PublicSection>

      <PublicSection title="2. Data subjects and personal data">
        <p>
          Data subjects may include customers, household members, clients, employees, contractors, support contacts, and other people whose relocation or service information is entered into Move.
        </p>
        <p>
          Personal data may include identifiers, contact data, addresses, service-provider records, moving plans, task records, budget records, document metadata, notes, support messages, subscription records, consent records, device/session data, and security/audit logs.
        </p>
      </PublicSection>

      <PublicSection title="3. Processing instructions and assistance">
        <p>
          Move will process personal data only to provide the service, follow documented customer instructions, comply with law, secure the platform, prevent abuse, and support billing or account operations.
        </p>
        <p>
          Move provides export, correction, deletion, and support workflows to help customers respond to data subject requests. Additional assistance may be provided where reasonable and legally required.
        </p>
      </PublicSection>

      <PublicSection title="4. Subprocessors">
        <p>
          Known subprocessor categories include hosting/database providers, Cloudflare R2 or object storage, Stripe, Apple App Store, Google Play, Resend or email delivery providers, Google Analytics/Google Tag Manager when configured, Google Maps/address autocomplete when configured, Expo or push notification providers, and Sentry/GlitchTip or error-monitoring providers when configured.
        </p>
        <p>
          A production subprocessor list with legal names, locations, and processing purposes must be finalized before full business launch. Subprocessor questions can be sent to <a href={mailto(LEGAL_CONTACTS.dpa, "LocateFlow subprocessor inquiry")} className="text-primary underline">{LEGAL_CONTACTS.dpa}</a>.
        </p>
      </PublicSection>

      <PublicSection title="5. Security measures">
        <p>
          Move maintains technical and organizational measures such as TLS for transport, account authentication, optional MFA where supported, role-based access controls for internal tools, rate limiting, audit logging for sensitive operations, least-privilege credential practices, backup procedures, and incident review workflows.
        </p>
        <p>
          These measures are not a certification. Specific enterprise audit rights, penetration-test sharing, security appendices, and technical-organizational-measures schedules require legal and security review.
        </p>
      </PublicSection>

      <PublicSection title="6. Breach notice, deletion, and return">
        <p>
          Move will notify affected customers without undue delay after becoming aware of a personal data breach that materially affects personal data processed under this DPA, with information reasonably available to support the customer's notification obligations.
        </p>
        <p>
          At termination, Move will delete or return personal data according to available product tools and the Privacy Policy, subject to backup, legal-hold, billing, audit, fraud-prevention, and security exceptions.
        </p>
      </PublicSection>

      <PublicSection title="7. Transfers, precedence, and counsel review">
        <p>
          International transfer terms, Standard Contractual Clauses, data-transfer impact assessments, liability allocation, audit rights, and jurisdiction-specific addenda must be finalized by legal counsel before Move relies on this DPA for enterprise or regulated customers.
        </p>
        <p>
          If this DPA conflicts with the Terms, Privacy Policy, Billing Policy, Refund Policy, or Acceptable Use Policy, the document most specific to the subject controls unless a signed agreement says otherwise.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}

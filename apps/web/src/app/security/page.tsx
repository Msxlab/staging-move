import { Fingerprint, KeyRound, Lock, ServerCog } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { LEGAL_CONTACTS, STORE_PURCHASE_DISTINCTION, mailto, policyLastUpdatedLabel } from "@/lib/legal-info";
import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "Security",
  description: "How Move protects accounts and the data you store, with current security limitations stated plainly.",
  path: "/security",
});

const highlights = [
  {
    icon: Lock,
    title: "Transport protection",
    description: "Move uses TLS for browser and API traffic in production configurations.",
  },
  {
    icon: KeyRound,
    title: "Authentication",
    description: "Password sign-in, optional OAuth, rate limiting, login lockouts, and MFA support help protect accounts.",
  },
  {
    icon: Fingerprint,
    title: "Session controls",
    description: "Session and device signals support account protection and session revocation where available.",
  },
  {
    icon: ServerCog,
    title: "Operational controls",
    description: "Access controls, audit logging, credential management, and monitoring are used according to role and environment.",
  },
] as const;

export default function SecurityPage() {
  return (
    <PublicPageShell
      eyebrow="Trust"
      title="Security overview"
      description="A practical summary of security practices Move uses today. This page does not claim SOC 2, HIPAA, PCI certification by Move, or perfect security."
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

      <PublicSection title="Account protection">
        <p>
          Passwords are stored as salted password hashes rather than plaintext. Failed login attempts are throttled. OAuth sign-in may be available when configured. Authenticator-app MFA is supported in account security settings where enabled.
        </p>
      </PublicSection>

      <PublicSection title="Data protection">
        <p>
          Move uses TLS for traffic in production. Some sensitive application fields may be encrypted at the field level when configured, and infrastructure providers may provide at-rest encryption for databases, object storage, and backups depending on deployment.
        </p>
        <p>
          Do not treat this page as a claim that every field, log, backup, processor copy, or third-party system is separately field-encrypted by Move.
        </p>
      </PublicSection>

      <PublicSection title="Access, logging, and monitoring">
        <p>
          Internal access should be limited to authorized operators who need it for support, security, billing, or operations. Admin actions and sensitive workflows may be logged for audit, fraud prevention, and incident review.
        </p>
        <p>
          Secrets and credentials should be managed through environment configuration and secret-management practices. If a secret exposure is suspected, it should be rotated and investigated.
        </p>
      </PublicSection>

      <PublicSection title="Backups and recovery">
        <p>
          Move maintains backup and recovery procedures appropriate to the deployment. Restore testing should be completed and documented before full production launch or enterprise commitments are made.
        </p>
      </PublicSection>

      <PublicSection title="Payment security">
        <p>{STORE_PURCHASE_DISTINCTION}</p>
        <p>
          Move does not store full payment card numbers. Card entry and payment processing are handled by payment processors or app stores. Those providers may have their own PCI obligations and security practices.
        </p>
      </PublicSection>

      <PublicSection title="Responsible disclosure">
        <p>
          To report a vulnerability, email <a href={mailto(LEGAL_CONTACTS.security, "Move security disclosure")} className="underline">{LEGAL_CONTACTS.security}</a> with a brief description, steps to reproduce, affected URLs or account context, and any suggested remediation. Do not send passwords, payment card numbers, private keys, or real user data.
        </p>
        <p>
          Good-faith testing should avoid service degradation, social engineering, persistence, data exfiltration, destructive actions, and public disclosure before Move has had a reasonable opportunity to respond.
        </p>
      </PublicSection>

      <PublicSection title="Incident response">
        <p>
          If Move determines that a security incident materially affects customer data, Move will use reasonable efforts to notify affected users and regulators when required by applicable law. DPA-level breach terms are summarized in the Data Processing Addendum.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}

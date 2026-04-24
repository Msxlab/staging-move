import type { Metadata } from "next";
import { Fingerprint, KeyRound, Lock, ServerCog } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";

export const metadata: Metadata = {
  title: "Security",
  description: "How LocateFlow protects accounts and the data you store.",
  alternates: { canonical: "/security" },
};

const highlights = [
  {
    icon: Lock,
    title: "Encryption",
    description: "All traffic between your device and LocateFlow uses TLS. Sensitive fields at rest are encrypted using keys managed by our infrastructure provider.",
  },
  {
    icon: KeyRound,
    title: "Authentication",
    description: "Password-based sign-in with optional OAuth (Google, Apple). Rate limiting and login lockouts protect against brute-force attempts.",
  },
  {
    icon: Fingerprint,
    title: "Session integrity",
    description: "Sessions are tied to device signals and regenerated on sensitive actions such as password change. Suspicious sessions can be revoked.",
  },
  {
    icon: ServerCog,
    title: "Operational rigor",
    description: "Audit logs track admin actions. Dependencies and infrastructure receive scheduled security updates. Secrets never land in source control.",
  },
] as const;

export default function SecurityPage() {
  return (
    <PublicPageShell
      eyebrow="Trust"
      title="Security overview"
      description="A practical summary of the controls LocateFlow uses to protect your account and the data you store — written in plain English, not compliance jargon."
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

      <PublicSection title="Account protection">
        <p>
          Passwords are hashed with a modern, salted, slow-hash algorithm — LocateFlow never stores them in the clear. Failed login attempts are throttled per account and per IP. OAuth sign-in (Google, Apple) is available as an alternative. Two-factor authentication via authenticator apps is supported and can be enabled from <em>Settings → Privacy &amp; Security</em>.
        </p>
      </PublicSection>

      <PublicSection title="Data in transit & at rest">
        <p>
          All client traffic uses TLS 1.2 or higher. Databases, object storage, and backups are encrypted at rest using keys managed by our infrastructure provider. Access to production systems is restricted to a small number of authorized engineers and is audited.
        </p>
      </PublicSection>

      <PublicSection title="Backups & recovery">
        <p>
          Production databases are backed up on a regular rolling schedule. Backups are encrypted at rest and retained only long enough to support operational recovery. Restore procedures are documented and periodically exercised.
        </p>
      </PublicSection>

      <PublicSection title="Payment security">
        <p>
          LocateFlow does not store full credit-card numbers. Web billing is processed by <strong>Stripe</strong>; iOS and Android subscriptions are processed by Apple and Google. Those providers are PCI-DSS compliant and handle card data directly.
        </p>
      </PublicSection>

      <PublicSection title="Responsible disclosure">
        <p>
          Security researchers are welcome. If you believe you have found a vulnerability, contact us via the <a href="/contact" className="underline">Contact page</a> with a brief description, steps to reproduce, and any suggested remediation. Please do not publicly disclose the issue until we have had a reasonable opportunity to respond.
        </p>
        <p>
          Do not exfiltrate real user data, degrade service, or attempt social-engineering attacks on our staff during testing. Acting in good faith keeps you within our safe-harbor expectations.
        </p>
      </PublicSection>

      <PublicSection title="Incident response">
        <p>
          If a security incident materially affects the confidentiality, integrity, or availability of customer data, LocateFlow will notify affected users and any required regulators without undue delay. See the <a href="/dpa" className="underline">Data Processing Addendum</a> for DPA-level breach-notification commitments.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}

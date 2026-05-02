import type { Metadata } from "next";
import Link from "next/link";
import { Database, Lock, Shield, UserCheck } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { LEGAL_CONTACTS, LEGAL_INFO, mailto, policyLastUpdatedLabel } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How LocateFlow handles account, address, service, moving, billing, analytics, mobile, support, and security data.",
  alternates: {
    canonical: "/privacy",
  },
};

const highlights = [
  {
    icon: Database,
    title: "Data you create",
    description: "LocateFlow stores account, profile, address, service, moving, budget, document, support, and notification records you create or submit.",
  },
  {
    icon: Shield,
    title: "Security and logs",
    description: "Authentication, access controls, audit logs, rate limits, and security logs help protect accounts and investigate abuse.",
  },
  {
    icon: Lock,
    title: "Operational processors",
    description: "Payment, hosting, storage, email, analytics, mapping, push, and error-monitoring providers may process limited data for the service.",
  },
  {
    icon: UserCheck,
    title: "User controls",
    description: "Export, correction, consent, notification, and deletion tools are available, subject to legal, billing, backup, audit, and security exceptions.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      description="This policy explains how LocateFlow uses data required to run account, address, service, moving, billing, support, analytics, mobile, and security features."
    >
      <div className="rounded-2xl border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
        <p>{policyLastUpdatedLabel()}</p>
        <p>Legal entity: {LEGAL_INFO.legalEntityName}</p>
        <p>
          Privacy contact:{" "}
          <a href={mailto(LEGAL_CONTACTS.privacy, "LocateFlow privacy request")} className="underline">
            {LEGAL_CONTACTS.privacy}
          </a>
        </p>
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

      <PublicSection title="Information LocateFlow may collect">
        <ul className="list-disc space-y-1 pl-6">
          <li>Account and profile data, such as name, email, password hash, locale, authentication status, OAuth provider identifiers, and legal consent records.</li>
          <li>Address, moving, service, custom-provider, provider recommendation, task, checklist, document metadata, note, and budget or expense records you enter.</li>
          <li>Support tickets, support messages, billing-support requests, privacy requests, security reports, and related communications.</li>
          <li>Subscription and billing data, such as plan, trial, renewal, cancellation, Stripe customer/subscription identifiers, store purchase status, receipt metadata, invoice status, and refund status.</li>
          <li>Device, app, mobile, push notification, IP address, user-agent, session, cookie consent, CCPA opt-out, analytics event, crash/error, rate-limit, admin, audit, and security log data.</li>
          <li>Optional sensitive profile information only when the product asks for explicit consent and you choose to provide it.</li>
        </ul>
      </PublicSection>

      <PublicSection title="How the data is used">
        <p>
          LocateFlow uses data to provide account access, organize relocation workflows, store records, generate local checklists, support provider research, process subscriptions, send notices and reminders, answer support requests, maintain security, prevent abuse, debug errors, satisfy legal obligations, and improve product reliability.
        </p>
        <p>
          Recommendations, reminders, and checklist suggestions are informational and depend on the data you enter, location context, seed data, public sources, and product rules.
        </p>
      </PublicSection>

      <PublicSection title="Sharing and processors">
        <p>
          LocateFlow does not sell user-entered relocation data for commercial advertising or broker-style resale. We do share limited data with processors when needed to operate the product.
        </p>
        <p>
          Processors may include Stripe for web payments, Apple App Store and Google Play for mobile purchases, email providers such as Resend, hosting/database providers, Cloudflare R2 or other object storage, Google Analytics or Google Tag Manager when consented and configured, Google Maps/address autocomplete when configured, push notification providers such as Expo, and error-monitoring providers such as Sentry or GlitchTip when configured.
        </p>
        <p>
          Third-party providers operate under their own terms and privacy policies. LocateFlow may also disclose data when required by law, to protect rights or security, to investigate abuse, or in connection with a business transaction.
        </p>
      </PublicSection>

      <PublicSection title="Cookies, analytics, and mobile data">
        <p>
          Web analytics is consent-gated. If Google Analytics or Google Tag Manager is configured, it should not load until analytics consent is accepted. Internal signed-in usage tracking also respects analytics consent. See the <Link href="/cookie-policy" className="underline">Cookie Policy</Link>.
        </p>
        <p>
          Mobile apps may collect device, app version, push token, consent, crash/error, and analytics event data when enabled. Push notifications can be controlled through app settings, device settings, and notification preferences.
        </p>
      </PublicSection>

      <PublicSection title="Retention, export, and deletion">
        <p>
          Data is generally retained while your account is active, while needed to provide the service, or while required for security, billing, tax, legal, audit, dispute, backup, or fraud-prevention purposes.
        </p>
        <p>
          Export and deletion tools are available in account settings. A deletion request may remove active account records, but some data may remain in backups, audit logs, legal records, billing records, security logs, processor records, or records we must retain to comply with law or protect the service.
        </p>
      </PublicSection>

      <PublicSection title="Privacy rights">
        <p>
          Depending on where you live, you may have rights to access, correct, delete, export, or object to certain processing of personal information. California residents should also review the <Link href="/ccpa-privacy-notice" className="underline">California Privacy Notice</Link>.
        </p>
        <p>
          EEA/UK rights may apply if LocateFlow offers the service to users in those regions or otherwise processes personal data subject to applicable law. LocateFlow does not claim a privacy certification or legal compliance approval on this page.
        </p>
      </PublicSection>

      <PublicSection title="Children's privacy">
        <p>
          LocateFlow is not intended for children under 13, and users must satisfy the age and authority requirements in the Terms. Do not submit information about children unless you have the authority and lawful basis to manage it.
        </p>
      </PublicSection>

      <PublicSection title="Contact">
        <p>
          For privacy requests, email <a href={mailto(LEGAL_CONTACTS.privacy, "LocateFlow privacy request")} className="underline">{LEGAL_CONTACTS.privacy}</a> or use the account settings tools when available.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}

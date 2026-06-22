import Link from "next/link";
import { Ban, Eye, MailMinus, UserCog } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { CcpaOptOutControls } from "@/components/shared/ccpa-opt-out-controls";
import { LEGAL_CONTACTS, mailto, policyLastUpdatedLabel } from "@/lib/legal-info";
import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "California Privacy Notice (CCPA / CPRA)",
  description: "California privacy rights, personal information categories, request methods, and Do Not Sell or Share controls.",
  path: "/ccpa-privacy-notice",
});

const highlights = [
  {
    icon: Eye,
    title: "Right to know",
    description: "California residents can request categories and specific pieces of personal information collected about them.",
  },
  {
    icon: UserCog,
    title: "Correct and delete",
    description: "You can request correction or deletion, subject to legal, billing, audit, backup, fraud-prevention, and security exceptions.",
  },
  {
    icon: Ban,
    title: "Do Not Sell or Share",
    description: "LocateFlow does not sell user-entered relocation data and provides an opt-out path for sale/share requests.",
  },
  {
    icon: MailMinus,
    title: "Non-discrimination",
    description: "LocateFlow will not discriminate against you for exercising California privacy rights.",
  },
] as const;

export default function CcpaNoticePage() {
  return (
    <PublicPageShell
      eyebrow="Legal - California residents"
      title="California Privacy Notice"
      description="This notice applies to California residents and describes rights under the California Consumer Privacy Act, as amended by the California Privacy Rights Act."
    >
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{policyLastUpdatedLabel()}</p>

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

      <PublicSection title="Categories collected">
        <ul className="list-disc space-y-1 pl-6">
          <li>Identifiers: name, email, account ID, OAuth identifiers, IP address, device identifiers, and support identifiers.</li>
          <li>Customer records and commercial information: subscription plan, billing status, Stripe or store purchase identifiers, invoices, refunds, and support requests.</li>
          <li>Internet or network activity: product usage, analytics events, session records, user-agent, rate-limit, error, crash, and security logs.</li>
          <li>Geolocation-related information: addresses, ZIP codes, destinations, service territories, and location context you provide or request.</li>
          <li>Inferences: service suggestions, provider recommendations, task suggestions, budget summaries, and move workflow context derived from data you enter.</li>
          <li>Sensitive personal information where applicable: account credentials, precise address records, optional sensitive profile fields, billing-related records, and security information.</li>
        </ul>
      </PublicSection>

      <PublicSection title="Sources, purposes, and recipients">
        <p>
          Sources include you, your device, product interactions, support communications, payment processors, app stores, authentication providers, address/map providers, analytics tools when consented, and service providers that operate LocateFlow.
        </p>
        <p>
          We use personal information to provide the service, process subscriptions, secure accounts, prevent abuse, provide support, send notices, maintain records, comply with law, debug errors, and improve reliability.
        </p>
        <p>
          Recipients may include processors for hosting, database, storage, email, payments, app stores, analytics, maps/address autocomplete, push notifications, and error monitoring, plus authorities or third parties when legally required or necessary to protect rights and security.
        </p>
      </PublicSection>

      <PublicSection title="Do Not Sell or Share">
        <p>
          LocateFlow does not sell user-entered relocation data for money or broker-style resale. LocateFlow also configures analytics to avoid ad personalization by default. Because California law defines "share" broadly, you may submit a Do Not Sell or Share request below.
        </p>
        <CcpaOptOutControls />
      </PublicSection>

      <PublicSection title="Your rights">
        <ul className="list-disc space-y-1 pl-6">
          <li>Know/access the categories and specific pieces of personal information collected about you.</li>
          <li>Delete personal information, subject to exceptions for security, billing, legal, audit, backup, fraud-prevention, and operational needs.</li>
          <li>Correct inaccurate personal information.</li>
          <li>Opt out of sale or sharing where applicable.</li>
          <li>Limit use of sensitive personal information where the law grants that right.</li>
          <li>Use an authorized agent, subject to verification and proof of authority.</li>
          <li>Receive non-discriminatory treatment for exercising your rights.</li>
        </ul>
      </PublicSection>

      <PublicSection title="How to submit a request">
        <p>
          Signed-in users can use Settings - Privacy and Security - Privacy tools where available. You can also email <a href={mailto(LEGAL_CONTACTS.privacy, "LocateFlow California privacy request")} className="underline">{LEGAL_CONTACTS.privacy}</a>.
        </p>
        <p>
          We will verify your identity before acting on access, deletion, or correction requests. Authorized agents must provide written proof of authorization, and we may require the consumer to verify directly.
        </p>
      </PublicSection>

      <PublicSection title="Retention">
        <p>
          LocateFlow retains personal information for as long as needed to provide the service and for security, billing, legal, tax, dispute, audit, backup, fraud-prevention, and operational purposes. See the <Link href="/privacy" className="underline">Privacy Policy</Link> for more context.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}

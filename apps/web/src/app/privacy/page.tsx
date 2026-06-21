import Link from "next/link";
import { Database, Lock, Shield, UserCheck } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { createPublicPageMetadata } from "@/lib/seo";
import {
  displayCompanyAddress,
  displayLegalEntityName,
  LEGAL_CONTACTS,
  mailto,
  policyLastUpdatedLabel,
} from "@/lib/legal-info";

export const metadata = createPublicPageMetadata({
  title: "Privacy Policy",
  description: "How LocateFlow handles account, address, service, moving, billing, analytics, mobile, support, and security data.",
  path: "/privacy",
});

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
    description: "Payment, hosting, storage, email, analytics, mapping, push, error-monitoring, public government data, and AI providers may process limited data for the service.",
  },
  {
    icon: UserCheck,
    title: "User controls",
    description: "Export, correction, consent, notification, and deletion tools are available, subject to legal, billing, backup, audit, and security exceptions.",
  },
] as const;

const publicCompanyAddress = displayCompanyAddress();

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      description="This policy explains how LocateFlow uses data required to run account, address, service, moving, billing, support, analytics, mobile, and security features."
    >
      <div className="space-y-1 rounded-[22px] border border-border bg-background/60 p-7 text-sm leading-6 text-muted-foreground">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{policyLastUpdatedLabel()}</p>
        <p>Legal entity: {displayLegalEntityName()}</p>
        <p>
          Privacy contact:{" "}
          <a href={mailto(LEGAL_CONTACTS.privacy, "LocateFlow privacy request")} className="text-primary underline">
            {LEGAL_CONTACTS.privacy}
          </a>
        </p>
        {publicCompanyAddress ? <p>Mailing address: {publicCompanyAddress}</p> : null}
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

      <PublicSection title="Information LocateFlow may collect">
        <ul className="list-disc space-y-1 pl-6">
          <li>Account and profile data, such as name, email, password hash, locale, authentication status, OAuth provider identifiers, and legal consent records.</li>
          <li>User-entered address, ZIP, city, approximate relocation context, moving, service, custom-provider, provider recommendation, task, checklist, document metadata, note, and budget or expense records you enter. LocateFlow does not use device GPS location in the mobile app.</li>
          <li>Derived location-context records attached to an address you save, such as flood zone, hazard index, radon zone, school district, broadband availability, electric utility, water system, air quality, and weather data returned by the public-data lookups described below, plus vehicle details and recall status when you choose to enter a VIN.</li>
          <li>Support tickets, support messages, billing-support requests, privacy requests, security reports, and related communications.</li>
          <li>Subscription and billing data, such as plan, trial, renewal, cancellation, Stripe customer/subscription identifiers, store purchase status, receipt metadata, invoice status, and refund status.</li>
          <li>Device, app, mobile, push notification, IP address, user-agent, session, cookie consent, CCPA opt-out, consent-gated analytics events such as screen views, taps, and search length, crash/error, rate-limit, admin, audit, and security log data.</li>
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
          LocateFlow does not sell user-entered relocation data for commercial advertising or broker-style resale. We transfer limited data to service providers and processors acting on LocateFlow's instructions when needed to operate the product.
        </p>
        <p>
          Processors may include Stripe for web payments, Apple App Store and Google Play for mobile purchases, email providers such as Resend, hosting/database providers, Cloudflare R2 or other object storage, Google Analytics or Google Tag Manager when consented and configured, Google Maps/address autocomplete when configured, push notification providers such as Expo, and error-monitoring providers such as Sentry or GlitchTip when configured.
        </p>
        <p>
          When the related features are enabled, limited location data is also sent to the public and government data services described in the next section, and coarse de-identified signals are sent to the AI provider described below.
        </p>
        <p>
          Third-party providers operate under their own terms and privacy policies. LocateFlow may also disclose data when required by law, to protect rights or security, to investigate abuse, or in connection with a business transaction.
        </p>
      </PublicSection>

      <PublicSection title="Address-derived public-data lookups">
        <p>
          When you save an address, LocateFlow may enrich it with public, government-published context about that location. To do this, the address coordinates — or, where a service needs them, city/state or other area identifiers — are sent to public and government data services. If you typed the address by hand instead of picking it from autocomplete, the street, city, state, and ZIP you entered may first be sent to the U.S. Census Bureau geocoder to convert it into coordinates. Only that location data (or the VIN described below) is sent. Your name, email, and account identifiers are never sent to these services.
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>FEMA — flood zone and National Risk Index hazard information.</li>
          <li>EPA — radon zone, public drinking-water system records, and AirNow air quality data.</li>
          <li>NCES — school district information.</li>
          <li>NWS — weather forecasts and alerts.</li>
          <li>FCC — broadband availability.</li>
          <li>DOE/OpenEI — electric utility information.</li>
          <li>NHTSA — vehicle details and open recalls, only when you choose to enter a VIN; the VIN is the only value sent.</li>
        </ul>
        <p>
          Results are stored with your address record and shown for information only. They are not professional advice and are not insurance, lending, legal, or safety determinations. Accuracy and currency follow the public source, which can be incomplete, outdated, or temporarily unavailable; when a lookup fails or is not configured, the product simply shows less information for that address.
        </p>
      </PublicSection>

      <PublicSection title="AI-generated move briefings">
        <p>
          When the briefing feature is enabled, move-briefing text may be generated by a third-party AI provider (Anthropic). Only coarse, de-identified signals are sent to the AI provider: state-level location (a two-letter state code), household shape (for example whether the household includes kids, pets, or a senior), an approximate vehicle count, and a rough days-until-move range. Your name, email, street address, and account identifiers are never sent to the AI provider.
        </p>
        <p>
          The generated text is display-only guidance to help organize a move. It is not legal, tax, financial, insurance, or other professional advice, and it does not make decisions about your account. When AI generation is disabled or unavailable, the product falls back to rule-based suggestions built from the same coarse signals.
        </p>
      </PublicSection>

      <PublicSection title="Cookies, analytics, and mobile data">
        <p>
          Web analytics is consent-gated. If Google Analytics or Google Tag Manager is configured, it should not load until analytics consent is accepted. Internal signed-in usage tracking also respects analytics consent. See the <Link href="/cookie-policy" className="text-primary underline">Cookie Policy</Link>.
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
          Depending on where you live, you may have rights to access, correct, delete, export, or object to certain processing of personal information. California residents should also review the <Link href="/ccpa-privacy-notice" className="text-primary underline">California Privacy Notice</Link>.
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
          For privacy requests, email <a href={mailto(LEGAL_CONTACTS.privacy, "LocateFlow privacy request")} className="text-primary underline">{LEGAL_CONTACTS.privacy}</a> or use the account settings tools when available.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}

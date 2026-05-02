import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, LockKeyhole, MonitorSmartphone, SlidersHorizontal } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { CookiePreferenceControls } from "@/components/shared/cookie-preference-controls";
import { LEGAL_CONTACTS, mailto, policyLastUpdatedLabel } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How LocateFlow uses cookies, local storage, consent records, analytics, and mobile analytics.",
  alternates: {
    canonical: "/cookie-policy",
  },
};

const highlights = [
  {
    icon: Cookie,
    title: "Necessary storage",
    description: "Session, auth, locale, security, CSRF, and consent storage keep the site and app working.",
  },
  {
    icon: LockKeyhole,
    title: "Security storage",
    description: "Temporary tokens, session controls, rate-limit signals, and request validation help protect accounts and APIs.",
  },
  {
    icon: SlidersHorizontal,
    title: "Preferences",
    description: "Local storage may remember theme, onboarding, consent, language, install prompts, and user-facing preferences.",
  },
  {
    icon: MonitorSmartphone,
    title: "Analytics",
    description: "Web analytics is consent-gated; mobile analytics is controlled separately through in-app consent.",
  },
] as const;

export default function CookiePolicyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Cookie Policy"
      description="This page explains how LocateFlow uses cookies, browser storage, consent records, analytics tags, and similar technologies."
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

      <PublicSection title="Categories of storage">
        <ul className="list-disc space-y-1 pl-6">
          <li>Necessary: sign-in, session, locale, security, CSRF, rate-limit, consent, and app routing storage.</li>
          <li>Preferences: theme, onboarding state, language, remembered product preferences, and install-prompt state.</li>
          <li>Analytics: Google Analytics or Google Tag Manager tags when configured and accepted, plus consent-gated internal signed-in usage events.</li>
          <li>Marketing: LocateFlow does not currently load advertising cookies through the public cookie banner. If marketing tags are added later, this policy and consent UI should be updated before use.</li>
        </ul>
      </PublicSection>

      <PublicSection title="Consent behavior">
        <p>
          The public cookie banner lets visitors accept analytics or decline non-essential analytics storage. The browser stores the choice in local storage under <code>locateflow_cookie_consent</code> and mirrors it to a first-party <code>cookie_consent</code> cookie for server-side consent checks.
        </p>
        <p>
          If you decline, Google analytics storage is denied and internal analytics tracking is disabled. Necessary cookies and storage may still be used because the service cannot operate securely without them.
        </p>
        <CookiePreferenceControls />
      </PublicSection>

      <PublicSection title="Google Analytics and Google Tag Manager">
        <p>
          LocateFlow supports Google Analytics 4 and Google Tag Manager when configured. These tags should not load until analytics consent is accepted. Ad storage, ad user data, and ad personalization are set to denied by default in the current implementation.
        </p>
        <p>
          Web analytics events are designed to avoid raw email, phone, address, name, provider account ID, Stripe ID, OAuth ID, token, support message, budget detail, and raw search query values.
        </p>
      </PublicSection>

      <PublicSection title="Mobile analytics">
        <p>
          Mobile analytics is controlled through in-app consent and does not use the web cookie banner. Mobile apps may send screen views, taps, errors, feature use, and aggregate search metadata when analytics consent is enabled.
        </p>
      </PublicSection>

      <PublicSection title="CCPA opt-out relationship">
        <p>
          California opt-out requests may be recorded separately through account settings or the California privacy endpoint. Anonymous opt-out state may use a first-party <code>ccpa_opt_out</code> cookie. See the <Link href="/ccpa-privacy-notice" className="underline">California Privacy Notice</Link>.
        </p>
      </PublicSection>

      <PublicSection title="Managing cookies and storage">
        <p>
          You can use the controls above, browser settings, or device settings to clear or block storage. Blocking necessary storage may prevent sign-in, checkout, security checks, preferences, or app features from working.
        </p>
        <p>
          Questions can be sent to <a href={mailto(LEGAL_CONTACTS.privacy, "LocateFlow cookie question")} className="underline">{LEGAL_CONTACTS.privacy}</a>.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}

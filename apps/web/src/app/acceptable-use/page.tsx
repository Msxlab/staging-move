import type { Metadata } from "next";
import { Ban, ShieldAlert, UsersRound, Wrench } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { policyLastUpdatedLabel } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: "What you can and can't do on LocateFlow.",
  alternates: { canonical: "/acceptable-use" },
};

const highlights = [
  {
    icon: UsersRound,
    title: "Personal & household use",
    description: "LocateFlow is built for individuals, households, and professionals tracking services on behalf of clients. Keep your records scoped to that purpose.",
  },
  {
    icon: Ban,
    title: "No illegal content",
    description: "Don't upload, store, or share material that is illegal, infringes rights, or violates applicable federal, state, or local law.",
  },
  {
    icon: ShieldAlert,
    title: "No abuse of others",
    description: "Don't use the product to harass, dox, impersonate, or target other people — including third-party service providers you list.",
  },
  {
    icon: Wrench,
    title: "No tampering",
    description: "Don't probe, scrape, reverse-engineer, or interfere with the platform, its APIs, or the data of other users.",
  },
] as const;

export default function AcceptableUsePage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Acceptable Use Policy"
      description="LocateFlow is an organizational tool for relocation workflows. This page lists the uses we allow and the uses that will get an account suspended."
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

      <PublicSection title="Prohibited uses">
        <p>By using LocateFlow you agree not to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Upload, store, or transmit content that is illegal, harassing, threatening, hateful, or otherwise harmful.</li>
          <li>Infringe on intellectual property, privacy, publicity, or contractual rights of any person or entity.</li>
          <li>Store personal data about other identifiable individuals without a lawful basis and, where required, their consent.</li>
          <li>Use the product to phish, spam, defraud, launder money, or facilitate any criminal activity.</li>
          <li>Abuse trials, promotions, refunds, payment disputes, chargebacks, or billing systems.</li>
          <li>Abuse support channels, submit false reports, or use support to harass LocateFlow personnel or other users.</li>
          <li>Misuse provider directory data, provider recommendations, or public-source data for scraping, resale, harassment, or unauthorized outreach.</li>
          <li>Attempt to gain unauthorized access to any account, server, database, or network connected to the service.</li>
          <li>Circumvent plan limits, authentication, rate limiting, or any technical restriction.</li>
          <li>Scrape the product, reverse engineer it, or build a competing service from its output or data.</li>
          <li>Introduce malware, automated abuse, or anything that could degrade service for other users.</li>
          <li>Misrepresent your identity, role, or authority (e.g., falsely claim to be a relocation manager acting for a client).</li>
        </ul>
      </PublicSection>

      <PublicSection title="Content you upload">
        <p>
          You remain responsible for everything you enter into LocateFlow — addresses, services, documents, messages, billing, or household records. You represent that you have the right to store that content and that doing so does not violate any law or third-party agreement.
        </p>
      </PublicSection>

      <PublicSection title="Automated traffic & API use">
        <p>
          LocateFlow APIs are intended for legitimate product use. Automated or programmatic access must respect rate limits, must not crawl or mirror the product, and must not be used to build derivative datasets without prior written permission.
        </p>
      </PublicSection>

      <PublicSection title="Enforcement">
        <p>
          LocateFlow may investigate suspected violations, throttle or suspend accounts, remove content, and cooperate with law enforcement where required. Serious or repeated violations may result in permanent termination of the account with no refund.
        </p>
        <p>
          If you believe content on LocateFlow violates this policy, contact us via the <a href="/contact" className="underline">Contact page</a>.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { JsonLd, breadcrumbSchema } from "@/components/seo/json-ld";
import { absoluteUrl, createPublicPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "About LocateFlow",
  description:
    "What LocateFlow is, who it is for, and what it does and does not do for moving, address, and provider organization.",
  path: "/about",
});

const principles = [
  "LocateFlow helps people keep track of addresses, service-provider records, moving tasks, reminders, and exports.",
  "LocateFlow is not a provider marketplace, broker, mover, utility company, government agency, or official address-change service.",
  "LocateFlow does not automatically update external provider accounts. Users still verify and complete changes with each provider or agency.",
  "Provider and moving guidance is informational and may be incomplete or outdated, so users should confirm details with authoritative sources.",
] as const;

export default function AboutPage() {
  return (
    <>
      <JsonLd
        id="ld-about-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "About", url: absoluteUrl("/about") },
        ])}
      />
      <PublicPageShell
        eyebrow="About"
        title="LocateFlow is a home-service and moving organization app."
        description="It gives individuals one place to manage the records that follow an address: utilities, banks, insurance, subscriptions, renewal dates, and moving tasks."
      >
        <PublicSection title="What LocateFlow is">
          <p>
            LocateFlow is built for people who want a reliable list of every service,
            renewal, and task tied to where they live. It is especially
            useful before, during, and after a move because address changes tend to
            scatter across providers, agencies, inboxes, apps, and paper records.
          </p>
          <p>
            The product is intentionally practical: save the provider, attach the
            address, note the renewal date, and export the record
            when you need a copy.
          </p>
        </PublicSection>

        <PublicSection title="What LocateFlow does not do">
          <div className="space-y-3">
            {principles.slice(1).map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </PublicSection>

        <PublicSection title="Who it is for">
          <p>
            LocateFlow is for renters, homeowners, frequent movers, students,
            caregivers, and anyone who manages household services across one or more
            addresses. It is also useful for people who want a clean export of their
            own provider and address records.
          </p>
        </PublicSection>

        <PublicSection title="Where to learn more">
          <div className="flex flex-wrap gap-3">
            <Link href="/how-it-works">
              <Button size="lg">
                How it works <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/provider-coverage">
              <Button variant="outline" size="lg">Provider coverage</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg">Pricing</Button>
            </Link>
          </div>
        </PublicSection>
      </PublicPageShell>
    </>
  );
}

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
          <p className="text-[15px] leading-relaxed text-foreground/90">
            LocateFlow is built for people who want a reliable list of every service,
            renewal, and task tied to where they live. It is especially
            useful before, during, and after a move because address changes tend to
            scatter across providers, agencies, inboxes, apps, and paper records.
          </p>
          <p className="text-[15px] leading-relaxed text-foreground/90">
            The product is intentionally practical: save the provider, attach the
            address, note the renewal date, and export the record
            when you need a copy.
          </p>
        </PublicSection>

        <PublicSection title="What LocateFlow does not do">
          <div className="space-y-4">
            {principles.slice(1).map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-[22px] border border-border bg-background/60 p-5 transition hover:border-primary/40"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <p className="text-[15px] leading-relaxed text-foreground/90">{item}</p>
              </div>
            ))}
          </div>
        </PublicSection>

        <PublicSection title="Who it is for">
          <p className="text-[15px] leading-relaxed text-foreground/90">
            LocateFlow is for renters, homeowners, frequent movers, students,
            caregivers, and anyone who manages household services across one or more
            addresses. It is also useful for people who want a clean export of their
            own provider and address records.
          </p>
        </PublicSection>

        <section className="overflow-hidden rounded-[26px] border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center shadow-sm sm:p-12">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Where to learn more
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/how-it-works">
                How it works <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/provider-coverage">Provider coverage</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/pricing">Pricing</Link>
            </Button>
          </div>
        </section>
      </PublicPageShell>
    </>
  );
}

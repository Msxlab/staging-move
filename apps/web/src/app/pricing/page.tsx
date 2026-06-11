import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PricingSection } from "@/components/marketing/pricing-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { getUserSession } from "@/lib/user-auth";
import { resolveMarketingCtaTarget } from "@/lib/marketing-cta";
import { getPublicSubscriptionOffersViewModel } from "@/lib/acquisition-campaigns";
import { absoluteUrl, createPublicPageMetadata, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, softwareApplicationSchema } from "@/components/seo/json-ld";

export const metadata = createPublicPageMetadata({
  title: "Pricing",
  description:
    "LocateFlow pricing for Individual, Family, and Pro plans, including monthly and annual pricing, trial disclosures, cancellation terms, and refund policy links.",
  path: "/pricing",
});

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await getUserSession();
  const userId = session?.userId ?? null;
  const [ctaTarget, publicCampaign] = await Promise.all([
    resolveMarketingCtaTarget(userId),
    getPublicSubscriptionOffersViewModel(),
  ]);
  const tPricing = await getTranslations("pricing");

  const faqs = [
    { q: tPricing("faq_trial_q"), a: tPricing("faq_trial_a") },
    { q: tPricing("faq_cancel_q"), a: tPricing("faq_cancel_a") },
    { q: tPricing("faq_refund_q"), a: tPricing("faq_refund_a") },
    { q: tPricing("faq_data_q"), a: tPricing("faq_data_a") },
  ];
  const schemaContext = {
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    logoUrl: absoluteUrl("/logo.svg"),
  };

  return (
    <div className="min-h-screen bg-background">
      <JsonLd
        id="ld-pricing-software"
        data={softwareApplicationSchema(schemaContext, {
          description: SITE_DESCRIPTION,
          price: "39.99",
          priceCurrency: "USD",
        })}
      />
      <JsonLd
        id="ld-pricing-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Pricing", url: absoluteUrl("/pricing") },
        ])}
      />
      <MarketingHeader userId={userId} />
      <PricingSection
        ctaHref={ctaTarget.href}
        ctaLabelLoggedIn={!!userId}
        ctaIntent={ctaTarget.intent}
        offers={publicCampaign}
        headingLevel="h1"
      />

      <section className="container pb-4">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-card/60 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            LocateFlow tracks moving workflows and local services. It does not
            log into or change your accounts with any provider on your behalf —
            you complete each change yourself with guided checklists, reminders,
            and links. Provider availability varies by address.
          </p>
        </div>
      </section>

      <section className="bg-muted/40 py-16">
        <div className="container max-w-3xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">{tPricing("faq_title")}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-xl border bg-card">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-medium">
                  {faq.q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-4 text-sm text-muted-foreground">{faq.a}</div>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Still unsure?{" "}
            <Link href="/contact" className="underline hover:text-foreground">
              Contact us
            </Link>{" "}
            — we&apos;ll help you pick the right plan.
          </p>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}

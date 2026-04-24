import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PricingSection } from "@/components/marketing/pricing-section";
import { getUserSession } from "@/lib/user-auth";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Pricing · ${SITE_NAME}`,
  description:
    "Simple pricing for LocateFlow. Free trial, Individual plan, and Family / Pro tiers on the way.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: `Pricing · ${SITE_NAME}`,
    description:
      "Free trial, Individual plan, and Family / Pro tiers on the way.",
    url: absoluteUrl("/pricing"),
  },
};

export default async function PricingPage() {
  const session = await getUserSession();
  const userId = session?.userId ?? null;
  const ctaHref = userId ? "/settings/subscription" : "/sign-up";
  const tPricing = await getTranslations("pricing");

  const faqs = [
    { q: tPricing("faq_trial_q"), a: tPricing("faq_trial_a") },
    { q: tPricing("faq_cancel_q"), a: tPricing("faq_cancel_a") },
    { q: tPricing("faq_refund_q"), a: tPricing("faq_refund_a") },
    { q: tPricing("faq_data_q"), a: tPricing("faq_data_a") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PricingSection ctaHref={ctaHref} ctaLabelLoggedIn={!!userId} />

      {/* Transparency note — Family/Pro aren't purchasable yet. Say so on
          the pricing page so visitors don't click the teaser and assume
          it's broken. */}
      <section className="container pb-4">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-card/60 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Family</strong> and{" "}
            <strong className="text-foreground">Pro</strong> tiers are on the
            roadmap but not yet open for purchase. Use the
            {" "}<em>Notify me at launch</em>{" "} button to join the waitlist —
            we&apos;ll email the moment either opens.
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
    </div>
  );
}

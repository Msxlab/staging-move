import Link from "next/link";
import { headers } from "next/headers";
import { ChevronDown, ArrowRight, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { SITE_URL, createPublicPageMetadata } from "@/lib/seo";
import { policyLastUpdatedLabel } from "@/lib/legal-info";
import { FaqJsonLd } from "./faq-json-ld";
import { faqGroups } from "./faq-content";

export const metadata = createPublicPageMetadata({
  title: "Frequently Asked Questions",
  description:
    "Billing, trials, refunds, privacy, cookies, provider recommendations, mobile subscriptions, and security answers for Move.",
  path: "/faq",
});

export default async function FaqPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <FaqJsonLd nonce={nonce} siteUrl={SITE_URL} />
      <PublicPageShell
        eyebrow="FAQ"
        title="Questions, answered."
        description="Answers to common product, billing, privacy, provider, mobile, and security questions. Policy pages control if any summary here differs."
      >
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{policyLastUpdatedLabel()}</p>

        {faqGroups.map((group) => (
          <PublicSection key={group.title} title={group.title}>
            <div className="space-y-3">
              {group.items.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-[18px] border border-border bg-background/60 transition hover:border-primary/40"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold tracking-tight text-foreground">
                    <span>{faq.q}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </PublicSection>
        ))}

        <section className="overflow-hidden rounded-[26px] border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center shadow-sm sm:p-12">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LifeBuoy className="h-6 w-6" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Still have a question?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            If you cannot find what you need in the public FAQ, reach us through the contact page or sign in for account-specific support.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">
                <LifeBuoy className="mr-2 h-4 w-4" /> Contact us <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </PublicPageShell>
    </>
  );
}

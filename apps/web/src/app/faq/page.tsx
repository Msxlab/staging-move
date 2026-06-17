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
    "Billing, trials, refunds, privacy, cookies, provider recommendations, mobile subscriptions, and security answers for LocateFlow.",
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
        <p className="text-sm text-muted-foreground">{policyLastUpdatedLabel()}</p>

        {faqGroups.map((group) => (
          <PublicSection key={group.title} title={group.title}>
            <div className="space-y-3">
              {group.items.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-xl border bg-background/60"
                >
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-sm font-medium text-foreground">
                    <span>{faq.q}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </PublicSection>
        ))}

        <PublicSection title="Still have a question?">
          <p>
            If you cannot find what you need in the public FAQ, reach us through the contact page or sign in for account-specific support.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">
                <LifeBuoy className="mr-2 h-4 w-4" /> Contact us <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </PublicSection>
      </PublicPageShell>
    </>
  );
}

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { JsonLd, breadcrumbSchema, faqPageSchema, webPageSchema } from "@/components/seo/json-ld";
import { absoluteUrl, createPublicPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "Provider Coverage",
  description:
    "How Move treats provider listings, coverage suggestions, availability limits, and user verification responsibilities.",
  path: "/provider-coverage",
});

const limits = [
  "Provider availability can vary by address, ZIP code, building, account type, service tier, and local infrastructure.",
  "A provider appearing in Move is not a guarantee that it serves a specific address. Internet and electric suggestions are cross-checked against the public FCC National Broadband Map and utility service-territory data at the area level — coverage reported by providers to the FCC, not a service guarantee.",
  "Provider names, websites, categories, and availability context may be incomplete, outdated, or unavailable.",
  "Users should verify price, licensing, insurance, plan details, cancellation rules, and availability directly with the provider.",
] as const;

const coverageFaqs = [
  {
    question: "How does Move determine provider coverage?",
    answer:
      "Move uses provider records, user-entered service details, and available coverage context to help users decide what to check next. The result is guidance for organizing follow-up, not a confirmed service order.",
  },
  {
    question: "Are provider listings guaranteed?",
    answer:
      "No. A provider listing is not a guarantee that the provider serves a specific address, offers a specific plan, or can support a specific account type.",
  },
  {
    question: "Does Move verify exact address-level availability?",
    answer:
      "Not at the exact-address level. For internet and electric service, Move cross-checks availability against the public FCC National Broadband Map and utility service-territory data at the area level. That coverage is reported by providers to the FCC, and exact address-level availability can still change by building, unit, infrastructure, plan, timing, and provider rules — it is not a guarantee, so confirm with the provider before relying on it.",
  },
  {
    question: "What does provider confidence mean?",
    answer:
      "Provider confidence is a planning signal that helps prioritize what to review. It should not be treated as eligibility, endorsement, licensing, insurance, or availability confirmation.",
  },
  {
    question: "Why should I confirm directly with the provider?",
    answer:
      "Providers and agencies control current pricing, eligibility, terms, transfer options, cancellation rules, and address-level service decisions. Direct confirmation reduces the risk of acting on outdated or incomplete information.",
  },
] as const;

export default function ProviderCoveragePage() {
  const pageUrl = absoluteUrl("/provider-coverage");
  const siteContext = {
    siteUrl: SITE_URL,
    siteName: "Move",
    logoUrl: `${SITE_URL}/logo.svg`,
  };

  return (
    <>
      <JsonLd
        id="ld-provider-coverage-webpage"
        data={webPageSchema(siteContext, {
          url: pageUrl,
          name: "Provider Coverage",
          description:
            "How Move treats provider listings, coverage suggestions, availability limits, and user verification responsibilities.",
        })}
      />
      <JsonLd
        id="ld-provider-coverage-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Provider coverage", url: pageUrl },
        ])}
      />
      <JsonLd id="ld-provider-coverage-faq" data={faqPageSchema([...coverageFaqs])} />
      <PublicPageShell
        eyebrow="Provider coverage"
        title="Provider suggestions are a starting point, not a guarantee."
        description="Move can help organize provider records and moving tasks, but it does not guarantee that a provider is available, endorsed, licensed, insured, or appropriate for a specific address."
      >
        <PublicSection title="How provider information is used">
          <p className="text-foreground/90">
            Move helps users keep a personal record of the providers connected
            to their addresses. When provider suggestions or public-source details are
            shown, they are meant to help users remember what to check next.
          </p>
          <p className="text-foreground/90">
            Move does not act as a broker, reseller, mover, utility company, or
            provider marketplace. It does not complete provider account updates on a
            user&apos;s behalf.
          </p>
        </PublicSection>

        <PublicSection title="Coverage limits">
          <div className="space-y-3">
            {limits.map((item) => (
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

        <PublicSection title="What users should verify">
          <p className="text-foreground/90">
            Before relying on a provider record, confirm the current service area,
            pricing, contract terms, cancellation rules, installation timing,
            identity requirements, fees, license status, insurance, and address
            eligibility directly with the provider or applicable agency.
          </p>
          <p className="text-foreground/90">
            For government or regulated tasks, use official government websites or
            qualified professionals. Move does not claim official government
            partnership or authority.
          </p>
        </PublicSection>

        <PublicSection title="Provider coverage FAQ">
          <div className="space-y-3">
            {coverageFaqs.map((faq) => (
              <details
                key={faq.question}
                className="rounded-[22px] border border-border bg-background/60 transition hover:border-primary/40"
              >
                <summary className="cursor-pointer px-5 py-3.5 font-display text-base font-bold tracking-tight text-foreground">
                  {faq.question}
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </PublicSection>

        <PublicSection title="Related policies">
          <p className="text-foreground/90">
            The <Link href="/disclaimer" className="font-medium text-primary underline underline-offset-4">Disclaimer</Link>{" "}
            controls provider, task, government, legal, financial, insurance, and
            moving guidance limitations. The <Link href="/faq" className="font-medium text-primary underline underline-offset-4">FAQ</Link>{" "}
            answers common product-scope questions.
          </p>
        </PublicSection>
      </PublicPageShell>
    </>
  );
}

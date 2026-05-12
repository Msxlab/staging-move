import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { JsonLd, breadcrumbSchema, faqPageSchema, webPageSchema } from "@/components/seo/json-ld";
import { absoluteUrl, createPublicPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "Provider Coverage",
  description:
    "How LocateFlow treats provider listings, coverage suggestions, availability limits, and user verification responsibilities.",
  path: "/provider-coverage",
});

const limits = [
  "Provider availability can vary by address, ZIP code, building, account type, service tier, and local infrastructure.",
  "A provider appearing in LocateFlow is not a guarantee that it serves a specific address.",
  "Provider names, websites, categories, and availability context may be incomplete, outdated, or unavailable.",
  "Users should verify price, licensing, insurance, plan details, cancellation rules, and availability directly with the provider.",
] as const;

const coverageFaqs = [
  {
    question: "How does LocateFlow determine provider coverage?",
    answer:
      "LocateFlow uses provider records, user-entered service details, and available coverage context to help users decide what to check next. The result is guidance for organizing follow-up, not a confirmed service order.",
  },
  {
    question: "Are provider listings guaranteed?",
    answer:
      "No. A provider listing is not a guarantee that the provider serves a specific address, offers a specific plan, or can support a specific account type.",
  },
  {
    question: "Does LocateFlow verify exact address-level availability?",
    answer:
      "No. Exact address-level availability can change by building, unit, infrastructure, plan, timing, and provider rules. Users should confirm directly with the provider or official agency.",
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
    siteName: "LocateFlow",
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
            "How LocateFlow treats provider listings, coverage suggestions, availability limits, and user verification responsibilities.",
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
        description="LocateFlow can help organize provider records and moving tasks, but it does not guarantee that a provider is available, endorsed, licensed, insured, or appropriate for a specific address."
      >
        <PublicSection title="How provider information is used">
          <p>
            LocateFlow helps users keep a personal record of the providers connected
            to their addresses. When provider suggestions or public-source details are
            shown, they are meant to help users remember what to check next.
          </p>
          <p>
            LocateFlow does not act as a broker, reseller, mover, utility company, or
            provider marketplace. It does not complete provider account updates on a
            user&apos;s behalf.
          </p>
        </PublicSection>

        <PublicSection title="Coverage limits">
          <div className="space-y-3">
            {limits.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </PublicSection>

        <PublicSection title="What users should verify">
          <p>
            Before relying on a provider record, confirm the current service area,
            pricing, contract terms, cancellation rules, installation timing,
            identity requirements, fees, license status, insurance, and address
            eligibility directly with the provider or applicable agency.
          </p>
          <p>
            For government or regulated tasks, use official government websites or
            qualified professionals. LocateFlow does not claim official government
            partnership or authority.
          </p>
        </PublicSection>

        <PublicSection title="Provider coverage FAQ">
          <div className="space-y-3">
            {coverageFaqs.map((faq) => (
              <details key={faq.question} className="rounded-xl border bg-background/60">
                <summary className="cursor-pointer px-5 py-3.5 text-sm font-medium text-foreground">
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
          <p>
            The <Link href="/disclaimer" className="underline">Disclaimer</Link>{" "}
            controls provider, task, government, legal, financial, insurance, and
            moving guidance limitations. The <Link href="/faq" className="underline">FAQ</Link>{" "}
            answers common product-scope questions.
          </p>
        </PublicSection>
      </PublicPageShell>
    </>
  );
}

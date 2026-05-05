import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { JsonLd, breadcrumbSchema } from "@/components/seo/json-ld";
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

export default function ProviderCoveragePage() {
  return (
    <>
      <JsonLd
        id="ld-provider-coverage-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Provider coverage", url: absoluteUrl("/provider-coverage") },
        ])}
      />
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

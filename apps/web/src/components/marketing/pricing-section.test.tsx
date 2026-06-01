import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : href?.pathname || "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: any) => <svg aria-hidden="true" {...props} />;
  return {
    Baby: Icon,
    Bell: Icon,
    Building2: Icon,
    CheckCircle2: Icon,
    Crown: Icon,
    Download: Icon,
    FileText: Icon,
    Home: Icon,
    Languages: Icon,
    Map: Icon,
    ShieldCheck: Icon,
    Smartphone: Icon,
    Sparkles: Icon,
    Truck: Icon,
    Users: Icon,
    Wallet: Icon,
    Wrench: Icon,
  };
});

import { PricingSection } from "./pricing-section";

describe("PricingSection", () => {
  it("renders active campaign headline, price, and trial copy", () => {
    const html = renderToStaticMarkup(
      <PricingSection
        ctaHref="/settings/subscription"
        ctaLabelLoggedIn={false}
        ctaIntent="upgrade"
        campaign={{
          accessType: "FREE_TRIAL",
          publicHeadline: "Start with 90 days free",
          publicSubheadline: "Individual Annual starts after your trial.",
          displayPriceLabel: "$39.99/year",
          trialDays: 90,
          billingInterval: "YEAR",
          ctaText: "Start 3 months free",
          priceCopy: "$39.99/year after trial",
          trialLabel: "3 months",
        }}
      />,
    );

    expect(html).toContain("Start with 90 days free");
    expect(html).toContain("Individual Annual starts after your trial.");
    expect(html).toContain("$39.99");
    expect(html).toContain("/year after trial");
    expect(html).toContain("Start 3 months free");
  });

  it("renders safe generic annual copy when no active campaign exists", () => {
    const html = renderToStaticMarkup(
      <PricingSection
        ctaHref="/settings/subscription"
        ctaLabelLoggedIn={false}
        ctaIntent="upgrade"
        campaign={null}
      />,
    );

    expect(html).toContain("Simple pricing for every move and household");
    expect(html).toContain("Choose Individual");
    expect(html).not.toContain("Today: $0");
    expect(html).not.toContain("3 months free, then annual billing");
  });

  it("can render the section headline as an h1 on the standalone pricing page", () => {
    const html = renderToStaticMarkup(
      <PricingSection
        ctaHref="/sign-up"
        ctaLabelLoggedIn={false}
        headingLevel="h1"
      />,
    );

    expect(html).toContain("<h1");
    expect(html).toContain("Individual");
  });

  it("renders annual and monthly campaign offers together", () => {
    const html = renderToStaticMarkup(
      <PricingSection
        ctaHref="/settings/subscription"
        ctaLabelLoggedIn={false}
        ctaIntent="upgrade"
        offers={{
          annualTrial: {
            accessType: "FREE_TRIAL",
            publicHeadline: "Start with 90 days free",
            publicSubheadline: "Individual Annual starts after your trial.",
            displayPriceLabel: "$39.99/year",
            trialDays: 90,
            billingInterval: "YEAR",
            ctaText: "Start 3 months free",
            priceCopy: "$39.99/year after trial",
            trialLabel: "3 months",
          },
          monthlyPaid: {
            accessType: "PAID",
            publicHeadline: "Subscribe monthly",
            publicSubheadline: "Simple monthly billing.",
            displayPriceLabel: "$3.99/month",
            trialDays: null,
            billingInterval: "MONTH",
            ctaText: "Subscribe monthly",
            priceCopy: "$3.99/month",
            trialLabel: null,
          },
        }}
      />,
    );

    expect(html).toContain("Start with 90 days free");
    expect(html).toContain("Monthly");
    expect(html).toContain("Family");
    expect(html).toContain("Pro");
    expect(html).toContain("$39.99");
    expect(html).toContain("/year after trial");
    expect(html).toContain('id="tab-monthly"');
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
          displayPriceLabel: "$79/year",
          trialDays: 90,
          billingInterval: "YEAR",
          ctaText: "Start 3 months free",
          priceCopy: "$79/year after trial",
          trialLabel: "3 months",
        }}
      />,
    );

    expect(html).toContain("Start with 90 days free");
    expect(html).toContain("Individual Annual starts after your trial.");
    expect(html).toContain("$79");
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

    expect(html).toContain("Individual Annual");
    expect(html).toContain("Continue with annual");
    expect(html).not.toContain("Today: $0");
    expect(html).not.toContain("3 months free, then annual billing");
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
            displayPriceLabel: "$79/year",
            trialDays: 90,
            billingInterval: "YEAR",
            ctaText: "Start 3 months free",
            priceCopy: "$79/year after trial",
            trialLabel: "3 months",
          },
          monthlyPaid: {
            accessType: "PAID",
            publicHeadline: "Subscribe monthly",
            publicSubheadline: "Simple monthly billing.",
            displayPriceLabel: "$9/month",
            trialDays: null,
            billingInterval: "MONTH",
            ctaText: "Subscribe monthly",
            priceCopy: "$9/month",
            trialLabel: null,
          },
        }}
      />,
    );

    expect(html).toContain("Start with 90 days free");
    expect(html).toContain("Individual Monthly");
    expect(html).toContain("$9");
    expect(html).toContain("/month");
    expect(html).toContain("Subscribe monthly");
  });
});

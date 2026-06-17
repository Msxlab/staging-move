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
    Car: Icon,
    Check: Icon,
    CheckCircle2: Icon,
    CloudRain: Icon,
    Crown: Icon,
    Download: Icon,
    FileText: Icon,
    Headset: Icon,
    Home: Icon,
    Languages: Icon,
    Map: Icon,
    Minus: Icon,
    ShieldCheck: Icon,
    Smartphone: Icon,
    Sparkles: Icon,
    Truck: Icon,
    Users: Icon,
    Wallet: Icon,
    Wifi: Icon,
    Wrench: Icon,
  };
});

// The embedded PlanCompareTable resolves its strings through next-intl;
// resolve from the REAL en.json catalog (same pattern as
// move-briefing-card.test.tsx) so shipped copy is what gets pinned.
vi.mock("next-intl", async () => {
  const en = (await import("@/i18n/messages/en.json")).default as Record<string, unknown>;
  const resolvePath = (root: unknown, dotted: string): unknown =>
    dotted.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], root);
  const useTranslations = (namespace: string) => {
    return (key: string, vars?: Record<string, unknown>) => {
      const raw = resolvePath(en, `${namespace}.${key}`);
      if (typeof raw !== "string") throw new Error(`Missing ${namespace}.${key} in en.json`);
      return raw.replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
    };
  };
  return { useTranslations, useLocale: () => "en-US" };
});

import { BILLING_PLAN_DEFINITIONS } from "@locateflow/shared";
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
          displayPriceLabel: "$24/year",
          trialDays: 90,
          billingInterval: "YEAR",
          ctaText: "Start 3 months free",
          priceCopy: "$24/year after trial",
          trialLabel: "3 months",
        }}
      />,
    );

    expect(html).toContain("Start with 90 days free");
    expect(html).toContain("Individual Annual starts after your trial.");
    expect(html).toContain("$24");
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

  it("lists AI briefing on Family+Pro only, the dossier on every paid card, smart suggestions everywhere", () => {
    const html = renderToStaticMarkup(
      <PricingSection ctaHref="/sign-up" ctaLabelLoggedIn={false} />,
    );

    // AI move briefing is Family+Pro only now (FEATURES.aiBriefing) - Individual
    // does NOT list it. The Family card states it; the Pro card rolls it up under
    // "Everything in Family". So: Family card bullet + one compare-table row = 2.
    expect(html.match(/AI move briefing/g)).toHaveLength(2);
    expect(html).toContain("New Home Dossier: flood zone, school district");
    expect(html).toContain("New Home Dossier PDF export");
    // Individual + Family card bullets + the subscription-terms box line = 3
    // (the Pro card rolls it up under "Everything in Family"; the compare-table
    // row label is worded without "with", so neither is counted).
    expect(html.match(/Smart provider suggestions with FCC broadband/g)).toHaveLength(3);
    // Honesty guardrail: the FCC data-check is Individual and up; Free gets
    // catalog suggestions only. Must NOT claim FCC suggestions on the Free tier.
    expect(html).toContain("included on Individual and up");
    expect(html).toContain("Free gets");
    expect(html).not.toContain("including Free");
    // Honesty guardrail: reported coverage data, never a guarantee.
    expect(html).toContain("reported coverage data");
    expect(html).toContain("not a guarantee of service at your address");
  });

  it("surfaces the new Individual-tier and Pro-only differentiators on the cards", () => {
    const html = renderToStaticMarkup(
      <PricingSection ctaHref="/sign-up" ctaLabelLoggedIn={false} />,
    );

    // Individual+ value (FEATURES.vehicleCheck / weatherDigest).
    expect(html).toContain("Vehicle VIN decode");
    expect(html).toContain("Move-week weather alerts");
    // Family+ real map (FEATURES.realMap).
    expect(html).toContain("Real map on route");
    // Pro-only differentiators (FEATURES.moverSuggestions / dossierPdf /
    // concurrentPlanLimit / prioritySupport).
    expect(html).toContain("FMCSA-registered mover suggestions");
    expect(html).toContain("New Home Dossier PDF export");
    expect(html).toContain("Up to 3 concurrent move plans");
    expect(html).toContain("Priority support");
  });

  it("keeps card bullets in sync with the post-2026-06-10 tier matrix", () => {
    const indiv = BILLING_PLAN_DEFINITIONS.INDIVIDUAL.features.join("\n");
    const family = BILLING_PLAN_DEFINITIONS.FAMILY.features.join("\n");
    const pro = BILLING_PLAN_DEFINITIONS.PRO.features.join("\n");
    const free = BILLING_PLAN_DEFINITIONS.FREE_TRIAL.features.join("\n");

    // Individual: data-checked suggestions + dossier + VIN + weather; NO AI.
    expect(indiv).toContain("Data-checked provider suggestions");
    expect(indiv).toContain("New Home Dossier");
    expect(indiv).not.toContain("New Home Dossier PDF export");
    expect(indiv).toContain("VIN recall check");
    expect(indiv).toContain("weather alerts & weekly digest");
    expect(indiv).not.toContain("AI move briefing");

    // Family: AI + real map, inherits Individual; movers stay Pro-only.
    expect(family).toContain("Everything in Individual");
    expect(family).toContain("AI move briefing");
    expect(family).toContain("Real route map");
    expect(family).not.toContain("mover suggestions");

    // Pro: inherits Family + the Pro-only differentiators.
    expect(pro).toContain("Everything in Family");
    expect(pro).toContain("Licensed mover suggestions");
    expect(pro).toContain("New Home Dossier PDF exports");
    expect(pro).toContain("Up to 3 move plans at once");
    expect(pro).toContain("Priority support");

    // Free: generous preview tier - catalog suggestions + Home Dossier preview, no data-check / AI / full dossier.
    expect(free).toContain("Provider suggestions from our catalog");
    expect(free).toContain("Home Dossier preview");
    expect(free).not.toContain("Data-checked");
    expect(free).not.toContain("AI move briefing");
    expect(free).not.toContain("New Home Dossier:");
  });

  it("renders the compare-plans matrix under the cards with a $0 Free column", () => {
    const html = renderToStaticMarkup(
      <PricingSection ctaHref="/sign-up" ctaLabelLoggedIn={false} />,
    );

    expect(html).toContain("Compare plans");
    // The Free tier has no card, but it must appear in the matrix with its
    // real enforced limits (PLAN_LIMITS / FEATURES - see plan-compare-table).
    expect(html).toContain("plan-free");
    expect(html).toContain("$0");
    // The matrix renders after the card grid.
    expect(html.indexOf("Compare plans")).toBeGreaterThan(html.indexOf('id="pricing-plan-grid"'));
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
            displayPriceLabel: "$24/year",
            trialDays: 90,
            billingInterval: "YEAR",
            ctaText: "Start 3 months free",
            priceCopy: "$24/year after trial",
            trialLabel: "3 months",
          },
          monthlyPaid: {
            accessType: "PAID",
            publicHeadline: "Subscribe monthly",
            publicSubheadline: "Simple monthly billing.",
            displayPriceLabel: "$4.99/month",
            trialDays: null,
            billingInterval: "MONTH",
            ctaText: "Subscribe monthly",
            priceCopy: "$4.99/month",
            trialLabel: null,
          },
        }}
      />,
    );

    expect(html).toContain("Start with 90 days free");
    expect(html).toContain("Monthly");
    expect(html).toContain("Family");
    expect(html).toContain("Pro");
    expect(html).toContain("$24");
    expect(html).toContain("/year after trial");
    expect(html).toContain('id="tab-monthly"');
  });
});

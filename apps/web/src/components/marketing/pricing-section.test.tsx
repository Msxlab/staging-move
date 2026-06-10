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
    Check: Icon,
    CheckCircle2: Icon,
    Crown: Icon,
    Download: Icon,
    FileText: Icon,
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

  it("lists AI move briefing and New Home Dossier on every paid card, smart suggestions everywhere", () => {
    const html = renderToStaticMarkup(
      <PricingSection ctaHref="/sign-up" ctaLabelLoggedIn={false} />,
    );

    // One bullet per paid card (Individual, Family, Pro) + one compare-table
    // row label each. Assert on substrings without "&" —
    // renderToStaticMarkup escapes it to &amp;.
    expect(html.match(/AI move briefing/g)).toHaveLength(4);
    expect(html.match(/New Home Dossier/g)).toHaveLength(4);
    // 3 card bullets + the Free mention in the subscription-terms area (the
    // compare-table row label is worded without "with", so it's not counted).
    expect(html.match(/Smart provider suggestions with FCC broadband/g)).toHaveLength(4);
    expect(html).toContain("including Free");
    // Honesty guardrail: reported coverage data, never a guarantee.
    expect(html).toContain("reported coverage data");
    expect(html).toContain("not a guarantee of service at your address");
  });

  it("keeps card bullets in sync with BILLING_PLAN_DEFINITIONS marketing features", () => {
    const paidLines = [
      "AI move briefing — your move, explained",
      "New Home Dossier: flood zone, school district & moving-day weather",
      "Smart provider suggestions with FCC broadband & utility data",
    ];
    for (const plan of ["INDIVIDUAL", "FAMILY", "PRO"] as const) {
      for (const line of paidLines) {
        expect(BILLING_PLAN_DEFINITIONS[plan].features).toContain(line);
      }
    }
    // Free tier gets the smart-suggestions line only — AI briefing and the
    // dossier are paid-plan features (FREE/FREE_TRIAL sees an upgrade teaser).
    const free = BILLING_PLAN_DEFINITIONS.FREE_TRIAL.features;
    expect(free).toContain("Smart provider suggestions with FCC broadband & utility data");
    expect(free.join("\n")).not.toContain("AI move briefing");
    expect(free.join("\n")).not.toContain("New Home Dossier");
  });

  it("renders the compare-plans matrix under the cards with a $0 Free column", () => {
    const html = renderToStaticMarkup(
      <PricingSection ctaHref="/sign-up" ctaLabelLoggedIn={false} />,
    );

    expect(html).toContain("Compare plans");
    // The Free tier has no card, but it must appear in the matrix with its
    // real enforced limits (PLAN_LIMITS / FEATURES — see plan-compare-table).
    expect(html).toContain("plan-free");
    expect(html).toContain("$0");
    expect(html).toContain("Unlimited");
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

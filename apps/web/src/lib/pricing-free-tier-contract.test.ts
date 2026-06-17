import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BILLING_PLAN_DEFINITIONS,
  billingPriceLabelForInterval,
  planFeatures,
} from "@locateflow/shared";
import { buildPlanComparison } from "../../../mobile/src/lib/plan-comparison";

type BillingPlan = "FREE_TRIAL" | "INDIVIDUAL" | "FAMILY" | "PRO";
type PaidPlan = Exclude<BillingPlan, "FREE_TRIAL">;

const PLANS: BillingPlan[] = ["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"];

const CANONICAL = {
  trialDays: 14,
  prices: {
    INDIVIDUAL: { yearly: "$24/year", monthly: "$4.99/month", yearlyUsd: 24, monthlyUsd: 4.99 },
    FAMILY: { yearly: "$39/year", monthly: "$7.99/month", yearlyUsd: 39, monthlyUsd: 7.99 },
    PRO: { yearly: "$59/year", monthly: "$11.99/month", yearlyUsd: 59, monthlyUsd: 11.99 },
  } satisfies Record<PaidPlan, { yearly: string; monthly: string; yearlyUsd: number; monthlyUsd: number }>,
  limits: {
    FREE_TRIAL: { addresses: 3, services: 10, seats: 1 },
    INDIVIDUAL: { addresses: 10, services: 100, seats: 1 },
    FAMILY: { addresses: 15, services: 500, seats: 6 },
    PRO: { addresses: 25, services: 1000, seats: 10 },
  } satisfies Record<BillingPlan, { addresses: number; services: number; seats: number }>,
};

function findRepoRoot(start = process.cwd()) {
  let current = start;
  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    current = path.dirname(current);
  }
  throw new Error("Unable to locate repository root.");
}

const REPO_ROOT = findRepoRoot();

function readRepoFile(...segments: string[]) {
  return readFileSync(path.join(REPO_ROOT, ...segments), "utf8");
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readRepoFile(...segments)) as T;
}

function featureKeys(entries: ReturnType<typeof buildPlanComparison>, plan: BillingPlan) {
  return entries.find((entry) => entry.key === plan)?.features.map((feature) => feature.key) ?? [];
}

function expectAbsent(text: string, patterns: Array<string | RegExp>, label: string) {
  const hits = patterns
    .map((pattern) => {
      if (typeof pattern === "string") return text.includes(pattern) ? pattern : null;
      return pattern.test(text) ? String(pattern) : null;
    })
    .filter(Boolean);
  expect(hits, `${label} contains stale literals: ${hits.join(", ")}`).toEqual([]);
}

describe("annual-first pricing and free-preview contract", () => {
  it("pins canonical annual-first price labels and primary intervals", () => {
    for (const plan of ["INDIVIDUAL", "FAMILY", "PRO"] as const) {
      const definition = BILLING_PLAN_DEFINITIONS[plan];
      expect(definition.primaryBillingInterval).toBe("YEAR");
      expect(definition.yearlyPriceLabel).toBe(CANONICAL.prices[plan].yearly);
      expect(definition.monthlyPriceLabel).toBe(CANONICAL.prices[plan].monthly);
      expect(definition.yearlyPriceUsd).toBe(CANONICAL.prices[plan].yearlyUsd);
      expect(definition.monthlyPriceUsd).toBe(CANONICAL.prices[plan].monthlyUsd);
      expect(billingPriceLabelForInterval(plan, "YEAR")).toBe(CANONICAL.prices[plan].yearly);
      expect(billingPriceLabelForInterval(plan, "MONTH")).toBe(CANONICAL.prices[plan].monthly);
    }
    expect(BILLING_PLAN_DEFINITIONS.FREE_TRIAL.priceLabel).toBe("Free");
  });

  it("pins the feature ladder that lower tiers must not leak through APIs", () => {
    expect(planFeatures("FREE_TRIAL")).toMatchObject({
      seatLimit: CANONICAL.limits.FREE_TRIAL.seats,
      homeDossierPreview: true,
      homeDossier: false,
      aiBriefing: false,
      dossierPdf: false,
      neighborhoodIntel: false,
    });
    expect(planFeatures("INDIVIDUAL")).toMatchObject({
      seatLimit: CANONICAL.limits.INDIVIDUAL.seats,
      homeDossierPreview: true,
      homeDossier: true,
      vehicleCheck: true,
      weatherDigest: true,
      aiBriefing: false,
      dossierPdf: false,
      neighborhoodIntel: false,
    });
    expect(planFeatures("FAMILY")).toMatchObject({
      seatLimit: CANONICAL.limits.FAMILY.seats,
      aiBriefing: true,
      realMap: true,
      dossierPdf: false,
      neighborhoodIntel: false,
    });
    expect(planFeatures("PRO")).toMatchObject({
      seatLimit: CANONICAL.limits.PRO.seats,
      aiBriefing: true,
      dossierPdf: true,
      neighborhoodIntel: true,
      moverSuggestions: true,
      partnerHub: true,
      prioritySupport: true,
      concurrentPlanLimit: 3,
    });
  });

  it("keeps mobile plan comparison cells aligned with the canonical entitlement matrix", () => {
    const entries = buildPlanComparison({
      currentPlanKey: null,
      isNativeStorePlatform: false,
      mobileStoreCommerceAdvertisable: false,
      hasAvailableNativeSku: () => false,
    });

    expect(entries.map((entry) => entry.key)).toEqual(PLANS);
    for (const plan of PLANS) {
      const keys = featureKeys(entries, plan);
      expect(keys).toContain("subscription_featAddresses");
      expect(keys).toContain("subscription_featServices");
      expect(entries.find((entry) => entry.key === plan)?.priceLabel).toBe(
        plan === "FREE_TRIAL"
          ? "Free"
          : `${CANONICAL.prices[plan].yearly} - ${CANONICAL.prices[plan].monthly}`,
      );
    }

    expect(featureKeys(entries, "FREE_TRIAL")).toContain("subscription_featHomeDossierPreview");
    expect(featureKeys(entries, "FREE_TRIAL")).not.toContain("subscription_featHomeDossier");
    expect(featureKeys(entries, "FREE_TRIAL")).not.toContain("subscription_featAiBriefing");
    expect(featureKeys(entries, "INDIVIDUAL")).not.toContain("subscription_featAiBriefing");
    expect(featureKeys(entries, "FAMILY")).toContain("subscription_featAiBriefing");
    expect(featureKeys(entries, "PRO")).toContain("subscription_featAiBriefing");
    for (const lower of ["FREE_TRIAL", "INDIVIDUAL", "FAMILY"] as const) {
      expect(featureKeys(entries, lower)).not.toContain("subscription_featDossierPdf");
    }
    expect(featureKeys(entries, "PRO")).toContain("subscription_featDossierPdf");
  });

  it("keeps dossier-preview copy honest about Free, Individual, and Pro boundaries", () => {
    const en = readJson<{ pricing: Record<string, string>; dashboard: Record<string, string> }>(
      "apps",
      "web",
      "src",
      "i18n",
      "messages",
      "en.json",
    );
    const es = readJson<{ pricing: Record<string, string>; dashboard: Record<string, string> }>(
      "apps",
      "web",
      "src",
      "i18n",
      "messages",
      "es.json",
    );
    const copy = [
      en.pricing.plan_free_feature_4,
      en.dashboard.dossier_preview_unlock_title,
      en.dashboard.dossier_preview_unlock_body,
      en.dashboard.dossier_preview_unlock_cta,
      es.pricing.plan_free_feature_4,
      es.dashboard.dossier_preview_unlock_title,
      es.dashboard.dossier_preview_unlock_body,
      es.dashboard.dossier_preview_unlock_cta,
      BILLING_PLAN_DEFINITIONS.FREE_TRIAL.features.join("\n"),
    ].join("\n");

    expect(copy).toContain("full Home Dossier");
    expect(copy).toContain("Individual");
    expect(copy).toContain("Pro");
    expectAbsent(copy, [
      "full report and PDF",
      "Unlock the full Home Dossier + PDF",
      /neighborhood context.*Individual/i,
      /PDF export unlocks? with Individual/i,
      /FCC|ISP|broadband|provider availability/i,
    ], "dossier preview/free copy");
  });

  it("has no stale pricing, limits, or monthly-first claims on selected user-facing/operator surfaces", () => {
    const surfaces = {
      webPricing: readRepoFile("apps", "web", "src", "components", "marketing", "pricing-section.tsx"),
      webCompare: readRepoFile("apps", "web", "src", "components", "marketing", "plan-compare-table.tsx"),
      webEn: readRepoFile("apps", "web", "src", "i18n", "messages", "en.json"),
      webEs: readRepoFile("apps", "web", "src", "i18n", "messages", "es.json"),
      mobileCompare: readRepoFile("apps", "mobile", "src", "lib", "plan-comparison.ts"),
      mobileEn: readRepoFile("apps", "mobile", "src", "i18n", "messages", "en.json"),
      mobileEs: readRepoFile("apps", "mobile", "src", "i18n", "messages", "es.json"),
      adminCampaigns: readRepoFile(
        "apps",
        "admin",
        "src",
        "app",
        "(admin)",
        "acquisition-campaigns",
        "acquisition-campaigns-client.tsx",
      ),
      deployBillingChecklist: readRepoFile("docs", "deploy", "billing-and-iap-setup-checklist.md"),
      deployMobileRunbook: readRepoFile("docs", "deploy", "mobile-and-places-release-runbook.md"),
      setupIap: readRepoFile("docs", "setup", "oauth-and-iap.md"),
    };
    const text = Object.entries(surfaces)
      .map(([name, value]) => `--- ${name} ---\n${value}`)
      .join("\n")
      // Allowed non-plan prices: illustrative ClassPass mock alert and Apple
      // Developer Program setup cost are not LocateFlow subscription prices.
      .replace(/^.*hero_mock_alert_classpass_b.*$/gm, "")
      .replace(/^.*\$99\/year Apple Developer Program.*$/gm, "");

    for (const expected of [
      "$24/year",
      "$4.99/month",
      "$39/year",
      "$7.99/month",
      "$59/year",
      "$11.99/month",
      "locateflow_individual_annual",
      "locateflow_family_annual",
      "locateflow_pro_annual",
      "com.locateflow.individual.annual",
      "com.locateflow.family.annual",
      "com.locateflow.pro.annual",
    ]) {
      expect(text).toContain(expected);
    }

    expectAbsent(text, [
      "$3.99",
      "$9.99",
      "$14.99",
      "$19.99",
      "$39.99",
      "$99/year",
      "$99.99",
      "$199",
      "Unlimited addresses",
      "Enterprise",
      "Save 17%",
      "save 17%",
      "4 others",
      "17 addresses",
      "250 services",
      "monthly or annually",
      "Monthly / Annual",
    ], "selected pricing surfaces");
  });

  it("flags trial copy and defaults that are not the canonical 14 days", () => {
    const sharedAcquisition = readRepoFile("packages", "shared", "src", "acquisition.ts");
    const webBilling = readRepoFile("apps", "web", "src", "lib", "billing.ts");
    const mobileEn = readRepoFile("apps", "mobile", "src", "i18n", "messages", "en.json");
    const mobileEs = readRepoFile("apps", "mobile", "src", "i18n", "messages", "es.json");
    const adminCampaigns = readRepoFile(
      "apps",
      "admin",
      "src",
      "app",
      "(admin)",
      "acquisition-campaigns",
      "acquisition-campaigns-client.tsx",
    );
    const operatorDocs = [
      readRepoFile("docs", "deploy", "billing-and-iap-setup-checklist.md"),
      readRepoFile("docs", "deploy", "mobile-and-places-release-runbook.md"),
      readRepoFile("docs", "setup", "oauth-and-iap.md"),
    ].join("\n");
    const failures: string[] = [];
    const sharedTrialDays = sharedAcquisition.match(/INDIVIDUAL_ANNUAL_TRIAL_DAYS\s*=\s*(\d+)/)?.[1];
    const webTrialDays = webBilling.match(/DEFAULT_STRIPE_ANNUAL_TRIAL_DAYS\s*=\s*(\d+)/)?.[1];
    if (sharedTrialDays !== String(CANONICAL.trialDays)) {
      failures.push(`packages/shared/src/acquisition.ts trial default is ${sharedTrialDays ?? "missing"}`);
    }
    if (webTrialDays !== String(CANONICAL.trialDays)) {
      failures.push(`apps/web/src/lib/billing.ts Stripe annual trial default is ${webTrialDays ?? "missing"}`);
    }

    const trialText = [sharedAcquisition, mobileEn, mobileEs, adminCampaigns, operatorDocs].join("\n");
    for (const stale of [
      "3 months free",
      "3 months",
      "90-day",
      "90 days",
      "3 meses",
      "Trial: 3 months",
      "STRIPE_ANNUAL_TRIAL_DAYS=90",
    ]) {
      if (trialText.includes(stale)) failures.push(`trial surfaces still contain "${stale}"`);
    }
    expect(failures).toEqual([]);
  });
});

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Stub = (props: { className?: string }) => <svg data-lucide={name} className={props.className} />;
    Stub.displayName = name;
    return Stub;
  };
  return { Check: icon("check"), Minus: icon("minus") };
});

// Resolve translations from the REAL en.json catalog (same pattern as
// move-briefing-card.test.tsx) so a catalog regression fails here.
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

import { COMPARE_GROUPS, PlanCompareTable, type CompareCell } from "./plan-compare-table";
import {
  BILLING_PLAN_DEFINITIONS,
  billingPriceLabelForInterval,
  planFeatures,
} from "@locateflow/shared";

type Plan = "FREE_TRIAL" | "INDIVIDUAL" | "FAMILY" | "PRO";
const PLANS: Plan[] = ["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"];

function row(labelKey: string) {
  const found = COMPARE_GROUPS.flatMap((group) => group.rows).find((r) => r.labelKey === labelKey);
  if (!found) throw new Error(`No compare row ${labelKey}`);
  return found;
}

function cells(labelKey: string): CompareCell[] {
  return PLANS.map((plan) => row(labelKey).cell(plan));
}

const included = { kind: "included" } as const;
const excluded = { kind: "excluded" } as const;
const value = (v: number) => ({ kind: "value", value: v }) as const;

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

describe("COMPARE_GROUPS - every cell pinned to the enforced ground truth", () => {
  it("addresses mirror PLAN_LIMITS.maxAddresses (3/10/15/25)", () => {
    // Mirrored literals: PLAN_LIMITS in apps/web/src/lib/plan-limits.ts is
    // server-only (prisma import) and unexported, so this test is the drift
    // guard for the copies inside plan-compare-table.tsx.
    expect(cells("rowAddresses")).toEqual([value(3), value(10), value(15), value(25)]);
  });

  it("services mirror PLAN_LIMITS.maxServices (10 / 100 / 500 / 1000 - Free is a thin tier now)", () => {
    expect(cells("rowServices")).toEqual([value(10), value(100), value(500), value(1000)]);
  });

  it("providers/reminders on every tier; data-checked smart suggestions are Individual and up (Free is catalog-only)", () => {
    expect(cells("rowProvidersReminders")).toEqual([included, included, included, included]);
    // Derived from FEATURES[plan].addressValidation - Free has no data-checked
    // (FCC/utility) suggestions, so the cell is honestly excluded for Free.
    expect(cells("rowSmartSuggestions")).toEqual([excluded, included, included, included]);
  });

  it("move plan, New Home Dossier, VIN check, weather digest, address validation, CSV/PDF export: Individual and up", () => {
    const paidOnly = [excluded, included, included, included];
    expect(cells("rowMovePlan")).toEqual(paidOnly); // canCreateMovingPlan gate
    expect(cells("rowHomeDossier")).toEqual(paidOnly); // FEATURES.homeDossier (the dossier screen)
    expect(cells("rowVehicleCheck")).toEqual(paidOnly); // FEATURES.vehicleCheck
    expect(cells("rowWeatherDigest")).toEqual(paidOnly); // FEATURES.weatherDigest
    expect(cells("rowAddressValidation")).toEqual(paidOnly); // FEATURES.addressValidation
    expect(cells("rowExport")).toEqual(paidOnly); // "Export anytime (CSV, PDF)"
  });

  it("AI move briefing and real map are Family and Pro only (Individual does NOT get AI)", () => {
    const familyUp = [excluded, excluded, included, included];
    expect(cells("rowAiBriefing")).toEqual(familyUp); // FEATURES.aiBriefing - cost-control cap, not a tier line
    expect(cells("rowRealMap")).toEqual(familyUp); // FEATURES.realMap
  });

  it("dossier-PDF, movers, and priority support are Pro only", () => {
    const proOnly = [excluded, excluded, excluded, included];
    expect(cells("rowMoverSuggestions")).toEqual(proOnly); // FEATURES.moverSuggestions
    expect(cells("rowDossierPdf")).toEqual(proOnly); // FEATURES.dossierPdf
    expect(cells("rowPrioritySupport")).toEqual(proOnly); // FEATURES.prioritySupport
    expect(cells("rowConcurrentPlans")).toEqual([value(1), value(1), value(1), value(3)]); // FEATURES.concurrentPlanLimit
  });

  it("members mirror FEATURES.seatLimit (1/1/6/10); sharing and child accounts are Family and up", () => {
    expect(cells("rowMembers")).toEqual([value(1), value(1), value(6), value(10)]);
    const familyUp = [excluded, excluded, included, included];
    expect(cells("rowSharedWorkspace")).toEqual(familyUp);
    expect(cells("rowChildAccounts")).toEqual(familyUp);
  });

  it("Partner Hub and tax & property export are Pro only", () => {
    const proOnly = [excluded, excluded, excluded, included];
    expect(cells("rowPartnerHub")).toEqual(proOnly); // FEATURES.partnerHub
    expect(cells("rowTaxExport")).toEqual(proOnly); // FEATURES.advancedExport
  });
});

describe("PlanCompareTable markup", () => {
  const html = renderToStaticMarkup(<PlanCompareTable />);

  it("renders all four plan columns, including a $0 Free column with no card equivalent", () => {
    expect(html).toContain("Compare plans");
    for (const name of ["Free", "Individual", "Family", "Pro"]) expect(html).toContain(name);
    // Free column header price line and real paid prices from BILLING_PLAN_DEFINITIONS.
    expect(html).toContain("$0");
    expect(html).toContain("$24/year");
    expect(html).toContain("$39/year");
    expect(html).toContain("$59/year");
  });

  it("colors column headers with the canonical plan-accent classes (Individual = base Aurora, no class)", () => {
    expect(html.match(/plan-free/g)).toHaveLength(1);
    expect(html.match(/plan-family/g)).toHaveLength(1);
    expect(html.match(/plan-pro/g)).toHaveLength(1);
    expect(html).not.toContain("plan-individual");
  });

  it("renders value cells, checks, and dashes honestly", () => {
    // Limits as plain values (1,000 is locale-formatted).
    for (const valueCell of [">3<", ">10<", ">15<", ">25<", ">100<", ">500<", ">1,000<", ">6<"]) {
      expect(html).toContain(valueCell);
    }
    // Paid-only rows leave honest dashes in the Free column, with sr text.
    expect(html).toContain("Included");
    expect(html).toContain("Not included");
    expect(html).toContain('data-lucide="check"');
    expect(html).toContain('data-lucide="minus"');
  });

  it("keeps the FCC honesty disclaimer next to the matrix", () => {
    expect(html).toContain("reported coverage data");
    expect(html).toContain("not a guarantee of service at your address");
  });

  it("scrolls horizontally on small screens instead of clipping", () => {
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("min-w-[640px]");
  });
});

describe("i18n catalogs", () => {
  it("en and es expose the identical pricing.compare key set", async () => {
    const en = (await import("@/i18n/messages/en.json")).default as { pricing: { compare: Record<string, string> } };
    const es = (await import("@/i18n/messages/es.json")).default as { pricing: { compare: Record<string, string> } };
    expect(Object.keys(es.pricing.compare).sort()).toEqual(Object.keys(en.pricing.compare).sort());
    // Every row/group label the component references exists in the catalog.
    const referenced = [
      ...COMPARE_GROUPS.map((group) => group.labelKey),
      ...COMPARE_GROUPS.flatMap((group) => group.rows.map((r) => r.labelKey)),
    ];
    for (const key of referenced) {
      expect(typeof en.pricing.compare[key]).toBe("string");
      expect(typeof es.pricing.compare[key]).toBe("string");
    }
  });

  it("keeps displayed plan price, limit, and seat copy aligned with canonical plan data", async () => {
    type PricingCatalog = Record<string, string> & { compare: Record<string, string> };
    const en = (await import("@/i18n/messages/en.json")).default as unknown as {
      premiumReveal: Record<string, string>;
      pricing: PricingCatalog;
    };
    const es = (await import("@/i18n/messages/es.json")).default as unknown as {
      premiumReveal: Record<string, string>;
      pricing: PricingCatalog;
    };
    const familyAddressCell = row("rowAddresses").cell("FAMILY");
    const familyServiceCell = row("rowServices").cell("FAMILY");
    const proAddressCell = row("rowAddresses").cell("PRO");
    if (
      familyAddressCell.kind !== "value" ||
      familyServiceCell.kind !== "value" ||
      proAddressCell.kind !== "value"
    ) {
      throw new Error("Expected value cells for Family/Pro limits.");
    }

    expect(en.pricing.plan_individual_price).toBe(BILLING_PLAN_DEFINITIONS.INDIVIDUAL.priceLabel);
    expect(en.pricing.plan_individual_per).toBe(BILLING_PLAN_DEFINITIONS.INDIVIDUAL.periodLabel);
    expect(en.pricing.plan_family_price).toBe(BILLING_PLAN_DEFINITIONS.FAMILY.priceLabel);
    expect(en.pricing.plan_family_per).toBe(BILLING_PLAN_DEFINITIONS.FAMILY.periodLabel);
    expect(en.pricing.familyFeature2).toContain(String(planFeatures("FAMILY").seatLimit));
    expect(en.pricing.familyFeature3).toContain(String(familyAddressCell.value));
    expect(en.pricing.familyFeature3).toContain(String(familyServiceCell.value));
    expect(en.premiumReveal.sub_family).toContain(String(planFeatures("FAMILY").seatLimit - 1));
    expect(en.premiumReveal.sub_pro).toContain(String(proAddressCell.value));
    expect(billingPriceLabelForInterval("PRO", "MONTH")).toBe("$11.99/month");

    expect(es.pricing.plan_individual_price).toBe(BILLING_PLAN_DEFINITIONS.INDIVIDUAL.priceLabel);
    expect(es.pricing.plan_family_price).toBe(BILLING_PLAN_DEFINITIONS.FAMILY.priceLabel);
    expect(es.pricing.familyFeature2).toContain(String(planFeatures("FAMILY").seatLimit));
    expect(es.pricing.familyFeature3).toContain(String(familyAddressCell.value));
    expect(es.pricing.familyFeature3).toContain(String(familyServiceCell.value));
    expect(es.premiumReveal.sub_family).toContain(String(planFeatures("FAMILY").seatLimit - 1));
    expect(es.premiumReveal.sub_pro).toContain(String(proAddressCell.value));

    const publicCopy = JSON.stringify({
      en: { premiumReveal: en.premiumReveal, pricing: en.pricing },
      es: { premiumReveal: es.premiumReveal, pricing: es.pricing },
    });
    for (const stale of [
      "$14.99",
      "Save 17%",
      "Unlimited addresses",
      "up to 4 others",
      "17 shared addresses",
      "250 services",
      "17 direcciones",
      "250 servicios",
    ]) {
      expect(publicCopy).not.toContain(stale);
    }
  });

  it("keeps current web, admin, mobile, email, and operator plan copy aligned with canonical plan data", () => {
    const canonical = {
      individualYearly: billingPriceLabelForInterval("INDIVIDUAL", "YEAR"),
      individualMonthly: billingPriceLabelForInterval("INDIVIDUAL", "MONTH"),
      familyYearly: billingPriceLabelForInterval("FAMILY", "YEAR"),
      familyMonthly: billingPriceLabelForInterval("FAMILY", "MONTH"),
      proYearly: billingPriceLabelForInterval("PRO", "YEAR"),
      proMonthly: billingPriceLabelForInterval("PRO", "MONTH"),
      familySeats: String(planFeatures("FAMILY").seatLimit),
      proSeats: String(planFeatures("PRO").seatLimit),
    };
    const currentSurfaces = {
      adminAcquisitionCampaigns: readRepoFile(
        "apps",
        "admin",
        "src",
        "app",
        "(admin)",
        "acquisition-campaigns",
        "acquisition-campaigns-client.tsx",
      ),
      mobilePlanComparison: readRepoFile("apps", "mobile", "src", "lib", "plan-comparison.ts"),
      mobilePlanComparisonTest: readRepoFile("apps", "mobile", "src", "lib", "plan-comparison.test.ts"),
      seededSubscriptionContent: readRepoFile("packages", "db", "prisma", "_migration-data.json"),
      billingAndIapChecklist: readRepoFile("docs", "deploy", "billing-and-iap-setup-checklist.md"),
      oauthAndIapSetup: readRepoFile("docs", "setup", "oauth-and-iap.md"),
      mobileStoreSubmissionCopy: readRepoFile("docs", "deploy", "mobile-store-submission-copy.md"),
      mobileReleaseRunbook: readRepoFile("docs", "deploy", "mobile-and-places-release-runbook.md"),
    };

    expect(currentSurfaces.adminAcquisitionCampaigns).toContain(canonical.individualYearly);
    expect(currentSurfaces.adminAcquisitionCampaigns).toContain(canonical.individualMonthly);
    expect(currentSurfaces.mobilePlanComparison).toContain("billingPriceLabelForInterval");
    expect(currentSurfaces.mobilePlanComparisonTest).toContain(
      `${canonical.individualYearly} - ${canonical.individualMonthly}`,
    );
    expect(currentSurfaces.mobilePlanComparisonTest).toContain(`${canonical.proYearly} - ${canonical.proMonthly}`);
    expect(currentSurfaces.seededSubscriptionContent).toContain(
      `Individual**: ${canonical.individualYearly} by default or ${canonical.individualMonthly}`,
    );
    expect(currentSurfaces.seededSubscriptionContent).toContain(
      `Family**: ${canonical.familyYearly} by default or ${canonical.familyMonthly}, up to ${canonical.familySeats} members`,
    );
    expect(currentSurfaces.seededSubscriptionContent).toContain(
      `Pro**: ${canonical.proYearly} by default or ${canonical.proMonthly}, up to ${canonical.proSeats} members`,
    );

    const currentCopy = JSON.stringify(currentSurfaces);
    for (const expected of [
      canonical.individualYearly,
      canonical.individualMonthly,
      canonical.familyYearly,
      canonical.familyMonthly,
      canonical.proYearly,
      canonical.proMonthly,
      "com.locateflow.individual.annual",
      "com.locateflow.family.annual",
      "com.locateflow.pro.annual",
      "locateflow_individual_annual",
      "locateflow_family_annual",
      "locateflow_pro_annual",
    ]) {
      expect(currentCopy).toContain(expected);
    }

    for (const stale of [
      "$3.99/month",
      "$39.99/year",
      "$9.99/month",
      "$19.99/month",
      "$199/year",
      "$199.99",
      "$14.99",
      "Unlimited addresses",
      "up to 4 others",
      "17 addresses",
      "250 services",
      "Save 17%",
      "save 20%",
      "monthly or annually",
    ]) {
      expect(currentCopy).not.toContain(stale);
    }
  });
});

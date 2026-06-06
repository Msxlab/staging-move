import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("subscription acquisition copy", () => {
  it("pricing renders Individual, Family, and Pro with monthly/annual tabs", () => {
    const source = readRepoFile("src/components/marketing/pricing-section.tsx");

    expect(source).toContain('type BillingCycle = "yearly" | "monthly"');
    expect(source).toContain('type PaidPlanId = "INDIVIDUAL" | "FAMILY" | "PRO"');
    expect(source).toContain('role="tablist"');
    expect(source).toContain("PLAN_FEATURES");
    expect(source).toContain("annualOffer?.publicHeadline");
    expect(source).toContain("monthlyOffer?.publicHeadline");
  });

  it("settings checkout copy keeps required terms clear without refund-heavy language", () => {
    const source = readRepoFile("src/components/settings/subscription-management.tsx");

    expect(source).toContain("Today");
    expect(source).toContain("Trial");
    expect(source).toContain("Annual plan starts");
    expect(source).toContain("/api/acquisition/public-trial-campaign");
    expect(source).toContain("publicCampaign?.publicHeadline");
    expect(source).toContain("monthlyOffer");
    expect(source).toContain("startMonthlyPlan");
    expect(source).toContain("buildTrialConsentLabel");
    expect(source).toContain("initialNowIso");
    expect(source).toContain("const stableNow = useMemo");
    expect(source).toContain("const offerFirstChargeDate");
    expect(source).toContain("firstChargeAt: offerFirstChargeDate");
    expect(source).toContain("buildTrialConsentLabel(offerFirstChargeDate)");
    expect(source).toContain("addDays(stableNow");
    expect(source).not.toContain("addDays(new Date()");
    expect(source).toContain("Manage access, plans, and billing");
    expect(source).toContain("Choose a plan to continue full access.");
    expect(source).not.toContain("Manage Individual access and billing");
    expect(source.toLowerCase()).not.toContain("refund");
  });

  it("subscription route passes a server-stable now value into the client screen", () => {
    const source = readRepoFile("src/app/(app)/settings/subscription/page.tsx");

    expect(source).toContain("SubscriptionManagementPage");
    expect(source).toContain('initialNowIso={new Date().toISOString()}');
  });

  it("settings renders the confirmed annual trial state from webhook-updated fields", () => {
    const source = readRepoFile("src/components/settings/subscription-management.tsx");

    expect(source).toContain('case "TRIALING":');
    expect(source).toContain("planDisplayName(subscription)");
    expect(source).toContain("`${planName} Annual Trial`");
    expect(source).toContain("isStripeCheckoutActivated");
    expect(source).toContain('subscription.provider !== "STRIPE"');
    expect(source).toContain('subscription.accessType === "FREE_ACCESS"');
  });

  it("settings shows pending plan change copy for scheduled downgrades", () => {
    const source = readRepoFile("src/components/settings/subscription-management.tsx");

    expect(source).toContain("const showGeneralPendingChangeNotice =");
    expect(source).toContain("Plan change scheduled");
    expect(source).toContain("Then");
    expect(source).toContain("starts automatically, with no extra charge today.");
    expect(source).toContain("Your");
  });

  it("trial reminder seed copy is calm and does not headline refunds", () => {
    const source = readFileSync(
      path.join(process.cwd(), "../../packages/db/prisma/seed-data/email-templates.ts"),
      "utf8",
    );

    expect(source).toContain("Your annual plan is scheduled to start after that.");
    expect(source).not.toContain("Refund!");
  });
});

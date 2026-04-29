import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("subscription acquisition copy", () => {
  it("pricing focuses on Individual offers and does not launch Family or Pro cards", () => {
    const source = readRepoFile("src/components/marketing/pricing-section.tsx");

    expect(source).toContain("Individual Annual");
    expect(source).toContain("Individual Monthly");
    expect(source).toContain("annualOffer?.publicHeadline");
    expect(source).toContain("monthlyOffer.displayPriceLabel");
    expect(source).not.toContain("FAMILY");
    expect(source).not.toContain("PRO");
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
    expect(source.toLowerCase()).not.toContain("refund");
  });

  it("settings renders the confirmed annual trial state from webhook-updated fields", () => {
    const source = readRepoFile("src/components/settings/subscription-management.tsx");

    expect(source).toContain('case "TRIALING":');
    expect(source).toContain("Individual Annual Trial");
    expect(source).toContain("isStripeCheckoutActivated");
    expect(source).toContain('subscription.provider !== "STRIPE"');
    expect(source).toContain('subscription.accessType === "FREE_ACCESS"');
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

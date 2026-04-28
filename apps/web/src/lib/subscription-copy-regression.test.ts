import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("subscription acquisition copy", () => {
  it("pricing focuses on Individual Annual and does not launch Family or Pro cards", () => {
    const source = readRepoFile("src/components/marketing/pricing-section.tsx");

    expect(source).toContain("Individual Annual");
    expect(source).toContain("3 months free, then annual billing");
    expect(source).not.toContain("FAMILY");
    expect(source).not.toContain("PRO");
  });

  it("settings checkout copy keeps required terms clear without refund-heavy language", () => {
    const source = readRepoFile("src/components/settings/subscription-management.tsx");

    expect(source).toContain("Today");
    expect(source).toContain("Trial");
    expect(source).toContain("Annual plan starts");
    expect(source).toContain("buildTrialConsentLabel");
    expect(source.toLowerCase()).not.toContain("refund");
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

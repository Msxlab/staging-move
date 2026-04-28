import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("budget page product copy", () => {
  it("presents service-cost planning instead of generic income and actual-expense tracking", () => {
    const page = read("src/app/(app)/budget/page.tsx");

    expect(page).toContain("Monthly Committed");
    expect(page).toContain("Monthly Budget Limit");
    expect(page).toContain("Projected This Month");
    expect(page).toContain("Over / Under Budget");
    expect(page).toContain("Services Missing Cost");
    expect(page).toContain("One-time Costs This Month");
    expect(page).toContain("Manage Budget Limits");
    expect(page).not.toContain("Actual Expenses");
    expect(page).not.toContain("GOVERNMENT_POSTAL");
    expect(page).not.toContain("UTILITY_ELECTRIC");
  });
});

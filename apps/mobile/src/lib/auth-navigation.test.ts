import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("mobile auth navigation", () => {
  it("registers the OAuth password setup screen in the root stack", () => {
    const layout = readFileSync(join(process.cwd(), "app/_layout.tsx"), "utf8");

    expect(layout).toContain('name="setup-password"');
  });

  it("does not force OAuth-only users through setup-password before onboarding", () => {
    const layout = readFileSync(join(process.cwd(), "app/_layout.tsx"), "utf8");

    expect(layout).not.toContain('router.replace("/setup-password")');
    expect(layout).toContain("Do not force OAuth-only users through setup-password on mobile.");
  });
});

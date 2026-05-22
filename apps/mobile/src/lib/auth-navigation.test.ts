import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("mobile auth navigation", () => {
  it("registers the OAuth password setup screen in the root stack", () => {
    const layout = readFileSync(join(process.cwd(), "app/_layout.tsx"), "utf8");

    expect(layout).toContain('name="setup-password"');
  });

  it("lets password setup win over onboarding redirects", () => {
    const layout = readFileSync(join(process.cwd(), "app/_layout.tsx"), "utf8");

    const passwordGateIndex = layout.indexOf("if (needsPasswordSetup) {");
    const passwordClearedIndex = layout.indexOf("if (inPasswordSetup) {", passwordGateIndex);
    const postAuthRedirectIndex = layout.indexOf("if (token && inAuthGroup)", passwordClearedIndex);

    expect(passwordGateIndex).toBeGreaterThan(-1);
    expect(passwordClearedIndex).toBeGreaterThan(passwordGateIndex);
    expect(postAuthRedirectIndex).toBeGreaterThan(passwordClearedIndex);

    const passwordGate = layout.slice(passwordGateIndex, passwordClearedIndex);
    expect(passwordGate).toContain('router.replace("/setup-password")');
    expect(passwordGate).toContain("return;");
  });
});

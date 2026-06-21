import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("CookieConsent responsive placement", () => {
  it("keeps the public banner compact and non-modal across auth surfaces", () => {
    const source = read("src/components/shared/cookie-consent.tsx");

    expect(source).toContain('role="region"');
    expect(source).toContain("aria-live=\"polite\"");
    expect(source).toContain('"/sign-in"');
    expect(source).toContain('"/sign-up"');
    expect(source).toContain("sm:max-w-xs");
    expect(source).toContain("max-w-[22rem]");
    expect(source).toContain("max-h-[calc(100svh-1.5rem)]");
    expect(source).not.toContain("md:max-w-md");
    expect(source).not.toContain("rounded-2xl");
  });
});

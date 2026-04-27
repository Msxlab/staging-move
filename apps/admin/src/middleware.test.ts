import { afterEach, describe, expect, it } from "vitest";
import { buildCspHeader } from "./middleware";

const ORIGINAL_R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

function directive(csp: string, name: string): string {
  return csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

function sources(cspDirective: string): string[] {
  return cspDirective.split(/\s+/).slice(1);
}

describe("admin middleware CSP", () => {
  afterEach(() => {
    process.env.R2_PUBLIC_BASE_URL = ORIGINAL_R2_PUBLIC_BASE_URL;
  });

  it("allows the production R2 logo asset host without broad image wildcards", () => {
    delete process.env.R2_PUBLIC_BASE_URL;

    const imgSrc = directive(buildCspHeader("test-nonce", false), "img-src");
    const imgSources = sources(imgSrc);

    expect(imgSrc).toBe("img-src 'self' data: blob: https://assets.locateflow.com");
    expect(imgSources).not.toContain("https:");
    expect(imgSources).not.toContain("*");
  });

  it("also allows the configured R2 public base URL origin", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com/provider-logo";

    const imgSrc = directive(buildCspHeader("test-nonce", false), "img-src");

    expect(imgSrc).toContain("https://assets.locateflow.com");
    expect(imgSrc).toContain("https://cdn.example.com");
    expect(imgSrc).not.toContain("/provider-logo");
  });
});

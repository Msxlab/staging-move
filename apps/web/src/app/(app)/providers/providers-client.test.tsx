import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";
import { ProviderLogoMark, shouldShowProviderLogo } from "./providers-client";

describe("ProviderLogoMark", () => {
  it("renders a provider logo image when logoUrl exists", () => {
    const markup = renderToStaticMarkup(
      <ProviderLogoMark
        provider={{
          name: "USPS",
          category: "GOVERNMENT_POSTAL",
          logoUrl: "https://assets.locateflow.com/providers/usps.png",
        }}
        className="h-12 w-12 rounded-xl"
        fallbackClassName="text-2xl"
      />,
    );

    expect(markup).toContain('src="https://assets.locateflow.com/providers/usps.png"');
    expect(markup).toContain('alt="USPS logo"');
    expect(markup).toContain("object-contain");
  });

  it("renders the category fallback icon when logoUrl is null", () => {
    const markup = renderToStaticMarkup(
      <ProviderLogoMark
        provider={{
          name: "USPS",
          category: "GOVERNMENT_POSTAL",
          logoUrl: null,
        }}
        className="h-12 w-12 rounded-xl"
        fallbackClassName="text-2xl"
      />,
    );

    expect(markup).not.toContain("<img");
    expect(markup).toContain(getMergedDisplayCategoryIcon("GOVERNMENT_POSTAL"));
  });

  it("uses the fallback branch after a logo URL has failed", () => {
    const logoUrl = "https://assets.locateflow.com/providers/usps.png";

    expect(shouldShowProviderLogo(logoUrl, null)).toBe(true);
    expect(shouldShowProviderLogo(logoUrl, logoUrl)).toBe(false);
    expect(shouldShowProviderLogo(null, null)).toBe(false);
  });

  it("falls back instead of requesting Google favicon placeholder URLs", () => {
    const markup = renderToStaticMarkup(
      <ProviderLogoMark
        provider={{
          name: "USPS",
          category: "GOVERNMENT_POSTAL",
          logoUrl: "https://www.google.com/s2/favicons?domain=usps.com&sz=64",
        }}
        className="h-12 w-12 rounded-xl"
        fallbackClassName="text-2xl"
      />,
    );

    expect(markup).not.toContain("<img");
    expect(markup).toContain(getMergedDisplayCategoryIcon("GOVERNMENT_POSTAL"));
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";
import {
  ServiceLogoMark,
  resolveServiceLogoUrl,
  shouldShowServiceLogo,
  type ServicesItem,
} from "./services-client";

function service(overrides: Partial<ServicesItem> = {}): ServicesItem {
  return {
    id: "service-1",
    category: "GOVERNMENT_POSTAL",
    providerName: "USPS",
    monthlyCost: 0,
    addressId: "address-1",
    ...overrides,
  };
}

function readWebSource(relativePath: string) {
  const cwd = process.cwd();
  const webRoot = cwd.endsWith(`${path.sep}apps${path.sep}web`)
    ? cwd
    : path.join(cwd, "apps", "web");
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("ServiceLogoMark", () => {
  it("renders the linked provider logo when one exists", () => {
    const markup = renderToStaticMarkup(
      <ServiceLogoMark
        service={service({
          provider: {
            id: "provider-1",
            name: "USPS",
            logoUrl: "https://assets.locateflow.com/providers/usps.png",
          },
        })}
      />,
    );

    expect(markup).toContain('src="https://assets.locateflow.com/providers/usps.png"');
    expect(markup).toContain('alt="USPS logo"');
    expect(markup).toContain("object-contain");
  });

  it("falls back to the category icon when no logo URL exists", () => {
    const markup = renderToStaticMarkup(<ServiceLogoMark service={service()} />);

    expect(markup).not.toContain("<img");
    expect(markup).toContain(getMergedDisplayCategoryIcon("GOVERNMENT_POSTAL"));
  });

  it("supports flattened logo fields and hides a logo after it fails", () => {
    const logoUrl = "https://assets.locateflow.com/providers/usps.png";

    expect(resolveServiceLogoUrl(service({ providerLogoUrl: logoUrl }))).toBe(logoUrl);
    expect(resolveServiceLogoUrl(service({ logoUrl }))).toBe(logoUrl);
    expect(shouldShowServiceLogo(logoUrl, null)).toBe(true);
    expect(shouldShowServiceLogo(logoUrl, logoUrl)).toBe(false);
    expect(shouldShowServiceLogo(null, null)).toBe(false);
  });
});

describe("service delete requests", () => {
  it("sends JSON mutation headers and an empty JSON body from user-facing delete calls", () => {
    const serviceDetail = readWebSource("src/app/(app)/services/[id]/page.tsx");
    const addressDetail = readWebSource("src/app/(app)/addresses/[id]/page.tsx");
    const useServices = readWebSource("src/hooks/use-services.ts");

    for (const source of [serviceDetail, addressDetail, useServices]) {
      expect(source).toContain('method: "DELETE"');
      expect(source).toContain('headers: { "Content-Type": "application/json" }');
      expect(source).toContain('credentials: "same-origin"');
      expect(source).toContain("body: JSON.stringify({})");
    }
  });

  it("uses provider logos and keeps failed bulk removals visible on address detail cards", () => {
    const addressDetail = readWebSource("src/app/(app)/addresses/[id]/page.tsx");

    expect(addressDetail).toContain("ServiceLogoMark service={service}");
    expect(addressDetail).toContain("const removedIds = new Set<string>()");
    expect(addressDetail).toContain("!removedIds.has(s.id)");
    expect(addressDetail).not.toContain("!bulkSelected.has(s.id)");
  });

  it("uses remove-from-account copy on the service detail delete flow", () => {
    const serviceDetail = readWebSource("src/app/(app)/services/[id]/page.tsx");

    expect(serviceDetail).toContain("Remove from my services");
    expect(serviceDetail).toContain("This removes the service from your account/address. It does not delete the provider from LocateFlow.");
    expect(serviceDetail).not.toContain("Delete Service");
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";
import {
  ServiceLogoMark,
  resolveServiceLogoUrl,
  resolveServiceRenewalSignal,
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
    expect(resolveServiceLogoUrl(service({ provider: { website: "https://www.usps.com" } }))).toBeNull();
    expect(resolveServiceLogoUrl(service({ logoUrl: "https://www.google.com/s2/favicons?domain=usps.com&sz=64" }))).toBeNull();
    expect(shouldShowServiceLogo(logoUrl, null)).toBe(true);
    expect(shouldShowServiceLogo(logoUrl, logoUrl)).toBe(false);
    expect(shouldShowServiceLogo(null, null)).toBe(false);
  });
});

describe("resolveServiceRenewalSignal", () => {
  // Fixed "now" so day math is deterministic: Wednesday, June 10, 2026.
  const now = new Date(2026, 5, 10);

  it("prefers the explicit contract end date over the recurring billing day", () => {
    // Local-noon timestamp (no Z) so the calendar-day math is timezone-stable.
    const renewal = resolveServiceRenewalSignal(
      service({ contractEndDate: "2026-06-13T12:00:00", billingDay: 11, billingCycle: "MONTHLY" }),
      now,
    );

    expect(renewal).not.toBeNull();
    expect(renewal!.source).toBe("contract");
    expect(renewal!.days).toBe(3);
  });

  it("reports overdue contract end dates with negative days (mobile parity)", () => {
    const renewal = resolveServiceRenewalSignal(
      service({ contractEndDate: "2026-06-08T12:00:00" }),
      now,
    );

    expect(renewal).toMatchObject({ source: "contract", days: -2 });
  });

  it("falls back to the next billing date when the contract date is invalid or absent", () => {
    const invalid = resolveServiceRenewalSignal(
      service({ contractEndDate: "not-a-date", billingDay: 12, billingCycle: "MONTHLY" }),
      now,
    );
    expect(invalid).toMatchObject({ source: "billing", days: 2 });

    const absent = resolveServiceRenewalSignal(
      service({ billingDay: 9, billingCycle: "MONTHLY" }),
      now,
    );
    // Day 9 already passed this month — next occurrence is July 9.
    expect(absent).toMatchObject({ source: "billing", days: 29 });
  });

  it("returns null when the service carries no usable date signal", () => {
    expect(resolveServiceRenewalSignal(service(), now)).toBeNull();
    // One-time bill whose day already passed has no future date either.
    expect(
      resolveServiceRenewalSignal(service({ billingDay: 9, billingCycle: "ONE_TIME" }), now),
    ).toBeNull();
  });
});

describe("services list payload completeness", () => {
  it("maps the renewal honesty fields (contractEndDate, autoRenewal) into the client payload", () => {
    const page = readWebSource("src/app/(app)/services/page.tsx");

    expect(page).toContain("contractEndDate:");
    expect(page).toContain("autoRenewal:");
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

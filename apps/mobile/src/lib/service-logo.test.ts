import { describe, expect, it } from "vitest";
import {
  resolveMobileServiceLogoAltName,
  resolveMobileServiceLogoUrl,
  resolveMobileServiceLogoUrls,
} from "./service-logo";

describe("mobile service logo helpers", () => {
  it("prefers the linked provider logo over flattened logo fields", () => {
    expect(
      resolveMobileServiceLogoUrl({
        provider: { name: "USPS", logoUrl: " https://assets.example/usps.png " },
        providerLogoUrl: "https://assets.example/provider-logo.png",
        logoUrl: "https://assets.example/service-logo.png",
      }),
    ).toBe("https://assets.example/usps.png");
  });

  it("falls back to flattened service logo fields", () => {
    expect(
      resolveMobileServiceLogoUrl({
        provider: { name: "USPS", logoUrl: " " },
        providerLogoUrl: null,
        logoUrl: "https://assets.example/service-logo.png",
      }),
    ).toBe("https://assets.example/service-logo.png");
  });

  it("derives provider logo fallbacks from the service website when stored logos are missing", () => {
    expect(
      resolveMobileServiceLogoUrls({
        providerName: "Con Edison",
        website: "https://www.coned.com/accounts",
      }),
    ).toEqual([
      "https://www.google.com/s2/favicons?domain=coned.com&sz=128",
      "https://logo.clearbit.com/coned.com",
    ]);
  });

  it("keeps stored provider logos ahead of derived website fallbacks", () => {
    expect(
      resolveMobileServiceLogoUrls({
        provider: {
          name: "UPS",
          logoUrl: "https://assets.locateflow.com/providers/ups.png",
          website: "https://www.ups.com",
        },
      }),
    ).toEqual([
      "https://assets.locateflow.com/providers/ups.png",
      "https://www.google.com/s2/favicons?domain=ups.com&sz=128",
      "https://logo.clearbit.com/ups.com",
    ]);
  });

  it("skips a stored .ico logo RN cannot render and uses website-derived fallbacks", () => {
    // Matches production: most provider logos are favicon .ico files, which a
    // browser <img> renders but React Native's <Image> cannot.
    expect(
      resolveMobileServiceLogoUrls({
        provider: {
          name: "USPS",
          logoUrl: "https://assets.locateflow.com/provider-logo/abc/def.ico",
          website: "https://www.usps.com",
        },
      }),
    ).toEqual([
      "https://www.google.com/s2/favicons?domain=usps.com&sz=128",
      "https://logo.clearbit.com/usps.com",
    ]);
  });

  it("skips .svg stored logos as well", () => {
    expect(
      resolveMobileServiceLogoUrls({
        provider: { name: "ACME", logoUrl: "https://cdn.example/acme.svg" },
        website: "https://acme.example",
      }),
    ).toEqual([
      "https://www.google.com/s2/favicons?domain=acme.example&sz=128",
      "https://logo.clearbit.com/acme.example",
    ]);
  });

  it("drops host-less / relative logo URLs that RN cannot resolve", () => {
    expect(
      resolveMobileServiceLogoUrls({
        provider: { name: "ACME", logoUrl: "/provider-logo/acme.png" },
      }),
    ).toEqual([]);
  });

  it("keeps a renderable .png stored logo", () => {
    expect(
      resolveMobileServiceLogoUrl({
        provider: { name: "UPS", logoUrl: "https://assets.locateflow.com/provider-logo/abc/ups.png" },
      }),
    ).toBe("https://assets.locateflow.com/provider-logo/abc/ups.png");
  });

  it("resolves a stable accessibility name", () => {
    expect(resolveMobileServiceLogoAltName({ provider: { name: " FedEx " }, providerName: "Postal" })).toBe("FedEx");
    expect(resolveMobileServiceLogoAltName({ customProvider: { name: " Local Gym " }, providerName: "Fitness" })).toBe("Local Gym");
    expect(resolveMobileServiceLogoAltName({ providerName: "GEICO" })).toBe("GEICO");
  });
});
